/* eslint-disable no-unused-vars */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./gcode-motion.js"));
  } else {
    root.GcodeCore = factory(root.GcodeMotion);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function gcodeCoreFactory(GcodeMotion) {
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
  const CENTER_OFFSET_FROM_START = [
    A1_CENTER[0] - A1_START[0],
    A1_CENTER[1] - A1_START[1],
  ];

  const WELL_POSITIONS_48 = {
    A1: [33.55, 48.6], A2: [33.55, 61.6], A3: [33.55, 74.6], A4: [33.55, 87.6],
    A5: [33.55, 100.6], A6: [33.55, 113.6], A7: [33.55, 126.6], A8: [33.55, 139.6],
    B1: [46.55, 48.6], B2: [46.55, 61.6], B3: [46.55, 74.6], B4: [46.55, 87.6],
    B5: [46.55, 100.6], B6: [46.55, 113.6], B7: [46.55, 126.6], B8: [46.55, 139.6],
    C1: [59.55, 48.6], C2: [59.55, 61.6], C3: [59.55, 74.6], C4: [59.55, 87.6],
    C5: [59.55, 100.6], C6: [59.55, 113.6], C7: [59.55, 126.6], C8: [59.55, 139.6],
    D1: [72.55, 48.6], D2: [72.55, 61.6], D3: [72.55, 74.6], D4: [72.55, 87.6],
    D5: [72.55, 100.6], D6: [72.55, 113.6], D7: [72.55, 126.6], D8: [72.55, 139.6],
    E1: [85.55, 48.6], E2: [85.55, 61.6], E3: [85.55, 74.6], E4: [85.55, 87.6],
    E5: [85.55, 100.6], E6: [85.55, 113.6], E7: [85.55, 126.6], E8: [85.55, 139.6],
    F1: [98.55, 48.6], F2: [98.55, 61.6], F3: [98.55, 74.6], F4: [98.55, 87.6],
    F5: [98.55, 100.6], F6: [98.55, 113.6], F7: [98.55, 126.6], F8: [98.55, 139.6],
  };

  const WELL_POSITIONS_12 = {
    A1: [84.3, 40.05], A2: [84.3, 66.06], A3: [84.3, 92.07], A4: [84.3, 118.08],
    B1: [110.31, 40.05], B2: [110.31, 66.06], B3: [110.31, 92.07], B4: [110.31, 118.08],
    C1: [136.32, 40.05], C2: [136.32, 66.06], C3: [136.32, 92.07], C4: [136.32, 118.08],
  };

  const WELL_POSITIONS_PEN = {
    A1: [42.9, 15.05],
    B1: [57.9, 15.05],
    C1: [72.9, 15.05],
  };

  function deriveCentersFromStarts(starts) {
    const centers = {};
    Object.entries(starts).forEach(([wellKey, [sx, sy]]) => {
      centers[wellKey] = [
        sx + CENTER_OFFSET_FROM_START[0],
        sy + CENTER_OFFSET_FROM_START[1],
      ];
    });
    return centers;
  }

  const DEFAULT_PLATE_TYPE = "24well";

  const PLATE_TYPES = {
    "24well": {
      id: "24well",
      label: "24-well",
      rowKeys: ["A", "B", "C", "D"],
      colKeys: [1, 2, 3, 4, 5, 6],
      bulkGridCols: 6,
      wellStarts: DEFAULT_24WELL_STARTS,
      wellCenters: DEFAULT_24WELL_CENTERS,
      wellDiamMm: 14.5,
      wellDepthMm: 15,
    },
    "48well": {
      id: "48well",
      label: "48-well",
      rowKeys: ["A", "B", "C", "D", "E", "F"],
      colKeys: [1, 2, 3, 4, 5, 6, 7, 8],
      bulkGridCols: 8,
      wellStarts: WELL_POSITIONS_48,
      wellCenters: deriveCentersFromStarts(WELL_POSITIONS_48),
      wellDiamMm: 11,
    },
    "12well": {
      id: "12well",
      label: "12-well",
      rowKeys: ["A", "B", "C"],
      colKeys: [1, 2, 3, 4],
      bulkGridCols: 4,
      wellStarts: WELL_POSITIONS_12,
      wellCenters: deriveCentersFromStarts(WELL_POSITIONS_12),
      wellDiamMm: 22,
    },
    pen: {
      id: "pen",
      label: "PEN membrane",
      rowKeys: ["A", "B", "C"],
      colKeys: [1],
      bulkGridCols: 1,
      wellStarts: WELL_POSITIONS_PEN,
      wellCenters: deriveCentersFromStarts(WELL_POSITIONS_PEN),
      wellDiamMm: 12,
    },
  };

  const PLATE_TYPE_OPTIONS = Object.values(PLATE_TYPES).map(({ id, label }) => ({ id, label }));

  function normalizePlateTypeId(plateTypeId) {
    return PLATE_TYPES[plateTypeId] ? plateTypeId : DEFAULT_PLATE_TYPE;
  }

  function getPlateType(plateTypeId = DEFAULT_PLATE_TYPE) {
    return PLATE_TYPES[normalizePlateTypeId(plateTypeId)];
  }

  function getWellStarts(plateTypeId = DEFAULT_PLATE_TYPE) {
    return getPlateType(plateTypeId).wellStarts;
  }

  function getWellCenters(plateTypeId = DEFAULT_PLATE_TYPE) {
    return getPlateType(plateTypeId).wellCenters;
  }

  function getWellDiamMm(plateTypeId = DEFAULT_PLATE_TYPE) {
    return getPlateType(plateTypeId).wellDiamMm;
  }

  function getWellRadiusMm(plateTypeId = DEFAULT_PLATE_TYPE) {
    return getWellDiamMm(plateTypeId) / 2;
  }

  function hydrogelFillHeightMm(volumeUl, wellDiamMm) {
    const volumeMm3 = Number(volumeUl);
    const diameterMm = Number(wellDiamMm);
    if (!Number.isFinite(volumeMm3) || volumeMm3 <= 0) return 0;
    if (!Number.isFinite(diameterMm) || diameterMm <= 0) return 0;
    const radiusMm = diameterMm / 2;
    return volumeMm3 / (Math.PI * radiusMm * radiusMm);
  }

  function listPlateTypes() {
    return PLATE_TYPE_OPTIONS.map(({ id, label }) => ({ id, label }));
  }

  function createPlateApi(plateTypeId = DEFAULT_PLATE_TYPE) {
    const id = normalizePlateTypeId(plateTypeId);
    const definition = getPlateType(id);
    const wellCenters = getWellCenters(id);
    const wellKeys = sortWellKeys(Object.keys(wellCenters), id);
    const first = wellCenters[wellKeys[0]] || [0, 0];
    const nextRow = wellCenters[`${definition.rowKeys[1] || definition.rowKeys[0]}${definition.colKeys[0]}`] || first;
    const nextCol = wellCenters[`${definition.rowKeys[0]}${definition.colKeys[1] || definition.colKeys[0]}`] || first;
    return {
      plateTypeId: id,
      wellCenters,
      wellKeys,
      wellDiamMm: definition.wellDiamMm,
      wellDepthMm: definition.wellDepthMm || 15,
      wellRadiusMm: definition.wellDiamMm / 2,
      pitchXmm: Math.abs(nextRow[0] - first[0]),
      pitchYmm: Math.abs(nextCol[1] - first[1]),
      getWellCenterMm: (wellKey) => getWellCenterMm(wellKey, id),
      isDotInsideWellMm: (x, y, wellKey) => isDotInsideWellMm(x, y, wellKey, id),
    };
  }

  function estimateGcodeRunTimeSec(gcodeText) {
    return GcodeMotion?.estimateGcodeRunTimeSec?.(gcodeText) || 0;
  }

  const Z_ELEVATION_COLOR_ANCHORS = [
    { z: 0.1, color: "#dc2626" }, { z: 0.2, color: "#f97316" },
    { z: 0.3, color: "#facc15" }, { z: 0.4, color: "#22c55e" },
    { z: 0.5, color: "#3b82f6" }, { z: 0.6, color: "#9333ea" },
  ];
  const Z_ELEVATION_RAISED_COLOR = "#475569";

  function colorForZElevation(absZ) {
    if (!Number.isFinite(absZ)) return Z_ELEVATION_COLOR_ANCHORS[0].color;
    if (absZ > 0.65) return Z_ELEVATION_RAISED_COLOR;
    let chosen = Z_ELEVATION_COLOR_ANCHORS[0].color;
    Z_ELEVATION_COLOR_ANCHORS.forEach((anchor) => {
      if (absZ >= anchor.z) chosen = anchor.color;
    });
    return chosen;
  }

  function colorForZSpan(absZ, minZ, maxZ) {
    const span = maxZ - minZ;
    const ratio = span > 0 ? Math.max(0, Math.min(1, (absZ - minZ) / span)) : 0;
    const index = Math.round(ratio * (Z_ELEVATION_COLOR_ANCHORS.length - 1));
    return Z_ELEVATION_COLOR_ANCHORS[index].color;
  }

  function rgb01ForZSpan(absZ, minZ, maxZ) {
    const hex = colorForZSpan(absZ, minZ, maxZ);
    return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  }

  function sortWellKeys(wellKeys, plateTypeId = DEFAULT_PLATE_TYPE) {
    const plate = getPlateType(plateTypeId);
    return [...wellKeys].sort((a, b) => {
      const rowA = plate.rowKeys.indexOf(a[0]);
      const rowB = plate.rowKeys.indexOf(b[0]);
      if (rowA !== rowB) return rowA - rowB;
      return Number.parseInt(a.slice(1), 10) - Number.parseInt(b.slice(1), 10);
    });
  }

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

  function getWellCenterMm(wellKey, plateTypeId = DEFAULT_PLATE_TYPE) {
    const centers = getWellCenters(plateTypeId);
    return centers[wellKey] || centers.A1;
  }

  function startPositionForCenterDotAtWellCenter(
    wellKey,
    numDots,
    dotsPerRow,
    spacingX,
    spacingY,
    plateTypeId = DEFAULT_PLATE_TYPE
  ) {
    const [wcx, wcy] = getWellCenterMm(wellKey, plateTypeId);
    if (dotsPerRow <= 0) return [wcx, wcy];
    const rows = Math.ceil(numDots / dotsPerRow);
    const centerCol = (dotsPerRow - 1) / 2;
    const centerRow = (rows - 1) / 2;
    return [wcx - centerCol * spacingX, wcy - centerRow * spacingY];
  }

  function isDotInsideWellMm(absX, absY, wellKey, plateTypeId = DEFAULT_PLATE_TYPE) {
    const [cx, cy] = getWellCenterMm(wellKey, plateTypeId);
    return Math.hypot(absX - cx, absY - cy) <= getWellRadiusMm(plateTypeId);
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

  function countDotsOutsideWell(params, wellKey = params.well, plateTypeId = DEFAULT_PLATE_TYPE) {
    const plateId = params.plateTypeId || plateTypeId;
    return resolveParamsDots(params).filter(
      (dot) => !isDotInsideWellMm(dot.absX, dot.absY, wellKey, plateId)
    ).length;
  }

  function validateDotsInsideWell(params, wellKey = params.well, plateTypeId = DEFAULT_PLATE_TYPE) {
    const plateId = params.plateTypeId || plateTypeId;
    const outsideCount = countDotsOutsideWell(params, wellKey, plateId);
    if (outsideCount === 0) return null;
    const noun = outsideCount === 1 ? "dot falls" : "dots fall";
    const wellDiamMm = getWellDiamMm(plateId);
    return `Error: ${outsideCount} ${noun} outside well ${wellKey} (Ø ${wellDiamMm} mm). Adjust start position, spacing, or circle radius.`;
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

  function translateStartForWell(
    refWell,
    targetWell,
    refStartX,
    refStartY,
    plateTypeId = DEFAULT_PLATE_TYPE
  ) {
    const starts = getWellStarts(plateTypeId);
    const refDefault = starts[refWell] || starts.A1;
    const targetDefault = starts[targetWell] || starts.A1;
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
    const plateId = params.plateTypeId || DEFAULT_PLATE_TYPE;
    const wellRadiusMm = getWellRadiusMm(plateId);
    if (!params.wellNumber) return "Error: Well number required.";
    if (params.numDots <= 0) return "Error: Number of dots must be > 0.";
    if (params.numDots > MAX_GRID_DOTS) {
      return `Error: Too many dots (${params.numDots}). Maximum is ${MAX_GRID_DOTS}.`;
    }
    if (params.radiusMm < 0) return "Error: Circle radius cannot be negative.";
    const passErr = validatePassSettingsFromValues(params.lowerZ, params.upperZ, params.extrusionE);
    if (passErr) return passErr;
    if (params.radiusMm > wellRadiusMm) {
      return `Error: Radius exceeds well (${formatCoordMm(wellRadiusMm)} mm max).`;
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
    DEFAULT_PLATE_TYPE,
    PLATE_TYPES,
    PLATE_TYPE_OPTIONS,
    WELL_POSITIONS_48,
    WELL_POSITIONS_12,
    WELL_POSITIONS_PEN,
    CENTER_OFFSET_FROM_START,
    listPlateTypes,
    createPlateApi,
    estimateGcodeRunTimeSec,
    Z_ELEVATION_COLOR_ANCHORS,
    Z_ELEVATION_RAISED_COLOR,
    colorForZElevation,
    colorForZSpan,
    rgb01ForZSpan,
    getPlateType,
    getWellStarts,
    getWellCenters,
    getWellDiamMm,
    getWellRadiusMm,
    hydrogelFillHeightMm,
    sortWellKeys,
    normalizePlateTypeId,
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
