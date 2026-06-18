/* eslint-disable no-unused-vars */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GcodeCore = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function gcodeCoreFactory() {
  const WELL_BOTTOM_Z = 2.35;
  const DEFAULT_LOWER_Z_OFFSET = 1.5;
  const DEFAULT_UPPER_Z_OFFSET = 1.51;
  const DEFAULT_EXTRUSION = 0.0105;
  const WELL_DIAM_MM = 14.5;
  const WELL_PITCH_X_MM = 19.3;
  const WELL_PITCH_Y_MM = 19.3;
  const ROW_KEYS = ["A", "B", "C", "D"];
  const COL_KEYS = [1, 2, 3, 4, 5, 6];
  const A1_START = [37.55, 46.3];
  const A1_CENTER = [38.9, 47.8];
  const WELL_RADIUS_MM = WELL_DIAM_MM / 2;
  const OVERLAP_TOLERANCE_MM = 0.02;
  const MAX_GRID_DOTS = 5000;
  const MAX_GRID_ROWS = 250;
  const MAX_GRID_PER_ROW = 250;
  const COORD_MM_DECIMALS = 2;
  const Z_MM_DECIMALS = 2;
  const EXTRUSION_E_DECIMALS = 4;

  function formatCoordMm(value) {
    return Number(value).toFixed(COORD_MM_DECIMALS);
  }

  function formatZMm(value) {
    return Number(value).toFixed(Z_MM_DECIMALS);
  }

  function formatExtrusionE(value) {
    return Number(value).toFixed(EXTRUSION_E_DECIMALS);
  }

  function formatGcodeXY(x, y) {
    return `X${formatCoordMm(x)} Y${formatCoordMm(y)}`;
  }

  function build24WellMap(a1X, a1Y) {
    const map = {};
    ROW_KEYS.forEach((rowKey, rIdx) => {
      COL_KEYS.forEach((colKey, cIdx) => {
        map[`${rowKey}${colKey}`] = [a1X + rIdx * WELL_PITCH_X_MM, a1Y + cIdx * WELL_PITCH_Y_MM];
      });
    });
    return map;
  }

  const DEFAULT_24WELL_STARTS = build24WellMap(A1_START[0], A1_START[1]);
  const DEFAULT_24WELL_CENTERS = build24WellMap(A1_CENTER[0], A1_CENTER[1]);

  function safeInt(v) {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }

  function safeFloat(v) {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }

  function parseEcalcFloat(v) {
    const raw = String(v).trim();
    if (raw === "") return null;
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : null;
  }

  function parsePatternFloat(v) {
    const n = parseEcalcFloat(v);
    return n === null ? 0 : n;
  }

  function getWellCenterMm(wellKey) {
    return DEFAULT_24WELL_CENTERS[wellKey] || DEFAULT_24WELL_CENTERS.A1;
  }

  function startPositionForCenterDotAtWellCenter(wellKey, numDots, dotsPerRow, spacingX, spacingY) {
    const [wcx, wcy] = getWellCenterMm(wellKey);
    if (dotsPerRow <= 0) return [wcx, wcy];
    const rows = Math.ceil(numDots / dotsPerRow);
    const centerCol = (dotsPerRow - 1) / 2;
    const centerRow = (rows - 1) / 2;
    return [wcx - centerCol * spacingX, wcy - centerRow * spacingY];
  }

  function isDotInsideWellMm(absX, absY, wellKey) {
    const [cx, cy] = getWellCenterMm(wellKey);
    return Math.hypot(absX - cx, absY - cy) <= WELL_RADIUS_MM;
  }

  function computeGridDotsFromParams(params) {
    const dots = [];
    const rows = params.perRow > 0 ? Math.ceil(params.numDots / params.perRow) : 0;
    let idx = 0;
    for (let rr = 0; rr < rows; rr += 1) {
      for (let cc = 0; cc < params.perRow; cc += 1) {
        if (idx >= params.numDots) break;
        dots.push({
          absX: params.startX + cc * params.spacingX,
          absY: params.startY + rr * params.spacingY,
        });
        idx += 1;
      }
    }
    return dots;
  }

  function resolveParamsDots(params) {
    if (params.customDots && params.customDots.length) return params.customDots;
    return computeGridDotsFromParams(params);
  }

  function countDotsOutsideWell(params, wellKey = params.well) {
    return resolveParamsDots(params).filter(
      (dot) => !isDotInsideWellMm(dot.absX, dot.absY, wellKey)
    ).length;
  }

  function validateDotsInsideWell(params, wellKey = params.well) {
    const outsideCount = countDotsOutsideWell(params, wellKey);
    if (outsideCount === 0) return null;
    const noun = outsideCount === 1 ? "dot falls" : "dots fall";
    return `Error: ${outsideCount} ${noun} outside well ${wellKey} (Ø ${WELL_DIAM_MM} mm). Adjust start position, spacing, or circle radius.`;
  }

  function applyProgressiveYOffset(baseDots, print1Dots, perRow, minDist, maxDist, sign = 1) {
    if (!baseDots.length) return [];
    return baseDots.map((dot, i) => {
      const col = perRow > 0 ? i % perRow : 0;
      const t = perRow > 1 ? col / (perRow - 1) : 0.5;
      const dist = minDist + (maxDist - minDist) * t;
      const ref = print1Dots[Math.min(i, print1Dots.length - 1)] || dot;
      return { absX: ref.absX, absY: ref.absY + dist * sign };
    });
  }

  function computeCircleDots(centerX, centerY, radiusMm, numDots, startAngleDeg = 0) {
    const dots = [];
    if (numDots <= 0 || radiusMm < 0) return dots;
    const startRad = (startAngleDeg * Math.PI) / 180;
    for (let i = 0; i < numDots; i += 1) {
      const theta = startRad + ((2 * Math.PI * i) / numDots);
      dots.push({
        absX: centerX + radiusMm * Math.cos(theta),
        absY: centerY + radiusMm * Math.sin(theta),
      });
    }
    return dots;
  }

  function translateStartForWell(refWell, targetWell, refStartX, refStartY) {
    const refDefault = DEFAULT_24WELL_STARTS[refWell] || DEFAULT_24WELL_STARTS.A1;
    const targetDefault = DEFAULT_24WELL_STARTS[targetWell] || DEFAULT_24WELL_STARTS.A1;
    const deltaX = refStartX - refDefault[0];
    const deltaY = refStartY - refDefault[1];
    return [targetDefault[0] + deltaX, targetDefault[1] + deltaY];
  }

  function validatePassSettingsFromValues(lower, upper, extrusion) {
    if (lower === null || upper === null || extrusion === null) {
      return "Error: Lower Z, Upper Z, and Extrusion (E) are required.";
    }
    if (lower < 0 || upper < 0) {
      return "Error: Z offsets cannot be negative.";
    }
    if (extrusion <= 0) {
      return "Error: Extrusion per dot (E) must be greater than 0.";
    }
    if (upper <= lower) {
      return "Error: Upper Z must be greater than Lower Z.";
    }
    return null;
  }

  function validatePassSettings(fields) {
    return validatePassSettingsFromValues(
      parseEcalcFloat(fields.lowerZ.value),
      parseEcalcFloat(fields.upperZ.value),
      parseEcalcFloat(fields.extrusionE.value)
    );
  }

  function validatePrintParams(params) {
    if (!params) return "Error: Invalid print parameters.";
    if (!params.wellNumber) return "Error: Well number required.";
    if (params.numDots <= 0 || params.perRow <= 0) {
      return "Error: Dots and Dots Per Row must be > 0.";
    }
    if (params.numDots > MAX_GRID_DOTS) {
      return `Error: Too many dots (${params.numDots}). Maximum is ${MAX_GRID_DOTS}.`;
    }
    const passErr = validatePassSettingsFromValues(params.lowerZ, params.upperZ, params.extrusionE);
    if (passErr) return passErr;
    return validateDotsInsideWell(params);
  }

  function validateAngleOffsetValues(firstCol, lastCol) {
    if (firstCol === null || lastCol === null) {
      return "Error: First- and last-column Y offsets are required when Y offset is enabled.";
    }
    if (firstCol < 0 || lastCol < 0) {
      return "Error: Y offset distances cannot be negative.";
    }
    return null;
  }

  function validateCircleParams(params) {
    if (!params.wellNumber) return "Error: Well number required.";
    if (params.numDots <= 0) return "Error: Number of dots must be > 0.";
    if (params.numDots > MAX_GRID_DOTS) {
      return `Error: Too many dots (${params.numDots}). Maximum is ${MAX_GRID_DOTS}.`;
    }
    if (params.radiusMm < 0) return "Error: Circle radius cannot be negative.";
    const passErr = validatePassSettingsFromValues(params.lowerZ, params.upperZ, params.extrusionE);
    if (passErr) return passErr;
    if (params.radiusMm > WELL_RADIUS_MM) {
      return `Error: Radius exceeds well (${formatCoordMm(WELL_RADIUS_MM)} mm max).`;
    }
    return validateDotsInsideWell(params);
  }

  function passSettingsMatch(a, b) {
    return a.lowerZ === b.lowerZ
      && a.upperZ === b.upperZ
      && a.extrusionE === b.extrusionE;
  }

  function applyPrint2PassSettings(params, passValues) {
    const lowerZ = parseEcalcFloat(passValues.lowerZ);
    const upperZ = parseEcalcFloat(passValues.upperZ);
    const extrusionE = parseEcalcFloat(passValues.extrusionE);
    return {
      ...params,
      lowerZ: lowerZ !== null ? lowerZ : params.lowerZ,
      upperZ: upperZ !== null ? upperZ : params.upperZ,
      extrusionE: extrusionE !== null ? extrusionE : params.extrusionE,
    };
  }

  function computeGridLayout(rawRows, rawPerRow) {
    let rows = Math.max(0, safeInt(rawRows));
    let perRow = Math.max(0, safeInt(rawPerRow));
    if (rows > MAX_GRID_ROWS) rows = MAX_GRID_ROWS;
    if (perRow > MAX_GRID_PER_ROW) perRow = MAX_GRID_PER_ROW;
    let dots = rows > 0 && perRow > 0 ? rows * perRow : 0;
    if (dots > MAX_GRID_DOTS && perRow > 0) {
      rows = Math.max(1, Math.floor(MAX_GRID_DOTS / perRow));
      dots = rows * perRow;
    }
    return { rows, perRow, dots };
  }

  function buildCombinedGcode(print1, print2, sameMode, paramsToGcode) {
    return buildCombinedMultiGcode(
      print1,
      [{ params: print2, sameMode, passNum: 2 }],
      paramsToGcode
    );
  }

  /**
   * @param {object} print1
   * @param {Array<{ params: object, sameMode: boolean, passNum: number }>} extraPasses
   * @param {function} paramsToGcode
   */
  function buildCombinedMultiGcode(print1, extraPasses, paramsToGcode) {
    const gcode1 = paramsToGcode(print1);
    let out = gcode1;
    (extraPasses || []).forEach((pass) => {
      const passNum = pass.passNum || 2;
      const samePattern = pass.sameMode && !pass.params.customDots;
      const repeatGcode = samePattern && passSettingsMatch(print1, pass.params);
      const gcodeN = repeatGcode ? gcode1 : paramsToGcode(pass.params);
      const sameNote = repeatGcode ? "; (same pattern as Print 1)\n" : "";
      out += `\n\n; === Print ${passNum} (pass ${passNum}, same well ${print1.wellNumber}) ===\n${sameNote}${gcodeN}`;
    });
    return out;
  }

  function defaultFileNameForParams(params, suffix) {
    return `well_${params.wellNumber}_Z${formatZMm(params.lowerZ)}${suffix}.txt`;
  }

  /**
   * Multi-print save tag: Y-offset range, or same vs different pattern in the same well.
   */
  function multiPrintFileNameSuffix({
    yOffsetEnabled = false,
    yOffsetMin = null,
    yOffsetMax = null,
    yOffsetNegative = false,
    print2PatternMode = "same",
  } = {}) {
    if (yOffsetEnabled) {
      if (yOffsetMin !== null && yOffsetMax !== null) {
        const range = `${formatCoordMm(yOffsetMin)}-${formatCoordMm(yOffsetMax)}`;
        return `_yOff${range}${yOffsetNegative ? "neg" : ""}`;
      }
      return "_yOff";
    }
    return print2PatternMode === "different" ? "_diffPat" : "_samePat";
  }

  function defaultMultiPrintFileName(params, passSuffix, modeOptions) {
    return `well_${params.wellNumber}_Z${formatZMm(params.lowerZ)}${passSuffix}${multiPrintFileNameSuffix(modeOptions)}.txt`;
  }

  function defaultBulkFileName(wells, lowerZ) {
    if (wells.length === 1) {
      return `well_${wells[0]}_Z${formatZMm(lowerZ)}.txt`;
    }
    const label = wells.length <= 6 ? wells.join("-") : `${wells.length}wells`;
    return `bulk_${label}_Z${formatZMm(lowerZ)}.txt`;
  }

  return {
    WELL_BOTTOM_Z,
    DEFAULT_LOWER_Z_OFFSET,
    DEFAULT_UPPER_Z_OFFSET,
    DEFAULT_EXTRUSION,
    WELL_DIAM_MM,
    WELL_RADIUS_MM,
    WELL_PITCH_X_MM,
    WELL_PITCH_Y_MM,
    ROW_KEYS,
    COL_KEYS,
    A1_START,
    A1_CENTER,
    OVERLAP_TOLERANCE_MM,
    MAX_GRID_DOTS,
    MAX_GRID_ROWS,
    MAX_GRID_PER_ROW,
    COORD_MM_DECIMALS,
    Z_MM_DECIMALS,
    EXTRUSION_E_DECIMALS,
    formatCoordMm,
    formatZMm,
    formatExtrusionE,
    formatGcodeXY,
    DEFAULT_24WELL_STARTS,
    DEFAULT_24WELL_CENTERS,
    build24WellMap,
    safeInt,
    safeFloat,
    parseEcalcFloat,
    parsePatternFloat,
    getWellCenterMm,
    startPositionForCenterDotAtWellCenter,
    isDotInsideWellMm,
    computeGridDotsFromParams,
    resolveParamsDots,
    countDotsOutsideWell,
    validateDotsInsideWell,
    applyProgressiveYOffset,
    computeCircleDots,
    translateStartForWell,
    validatePassSettingsFromValues,
    validatePassSettings,
    validatePrintParams,
    validateAngleOffsetValues,
    validateCircleParams,
    passSettingsMatch,
    applyPrint2PassSettings,
    computeGridLayout,
    buildCombinedGcode,
    buildCombinedMultiGcode,
    defaultFileNameForParams,
    defaultMultiPrintFileName,
    multiPrintFileNameSuffix,
    defaultBulkFileName,
  };
});
