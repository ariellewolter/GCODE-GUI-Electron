const WELL_BOTTOM_Z = 2.35;
const DEFAULT_LOWER_Z_OFFSET = 1.5;
const DEFAULT_UPPER_Z_OFFSET = 1.51;
const DEFAULT_EXTRUSION = 0.0105;
const WELL_DIAM_MM = 14.5;
const STEPS_PER_MM_ECALC = 10498.7;
const WELL_PITCH_X_MM = 19.3;
const WELL_PITCH_Y_MM = 19.3;
const ROW_KEYS = ["A", "B", "C", "D"];
const COL_KEYS = [1, 2, 3, 4, 5, 6];

// New printer anchors provided by user.
const A1_START = [37.55, 46.3];
const A1_CENTER = [38.9, 47.8];

function build24WellMap(a1X, a1Y) {
  const map = {};
  ROW_KEYS.forEach((rowKey, rIdx) => {
    COL_KEYS.forEach((colKey, cIdx) => {
      const wellKey = `${rowKey}${colKey}`;
      map[wellKey] = [a1X + rIdx * WELL_PITCH_X_MM, a1Y + cIdx * WELL_PITCH_Y_MM];
    });
  });
  return map;
}

const DEFAULT_24WELL_STARTS = build24WellMap(A1_START[0], A1_START[1]);
const DEFAULT_24WELL_CENTERS = build24WellMap(A1_CENTER[0], A1_CENTER[1]);

const el = {
  well: document.getElementById("well"),
  startX: document.getElementById("start-x"),
  startY: document.getElementById("start-y"),
  dots: document.getElementById("dots"),
  perRow: document.getElementById("per-row"),
  rows: document.getElementById("rows"),
  spacingX: document.getElementById("spacing-x"),
  spacingY: document.getElementById("spacing-y"),
  lowerZ: document.getElementById("lower-z"),
  upperZ: document.getElementById("upper-z"),
  wellNumber: document.getElementById("well-number"),
  extrusionE: document.getElementById("extrusion-e"),
  annotate: document.getElementById("annotate"),
  snap: document.getElementById("snap"),
  reset: document.getElementById("reset"),
  save: document.getElementById("save"),
  saveStatus: document.getElementById("save-status"),
  canvas: document.getElementById("preview-canvas"),
  canvasStd: document.getElementById("preview-canvas-std"),
  canvasCircle: document.getElementById("preview-canvas-circle"),
  bulkDetailCanvas: document.getElementById("bulk-detail-canvas"),
  bulkDetailWell: document.getElementById("bulk-detail-well"),
  previewMeta: document.getElementById("preview-meta"),
  previewMetaSingle: document.getElementById("preview-meta-single"),
  previewMetaCircle: document.getElementById("preview-meta-circle"),
  bulkDetailMeta: document.getElementById("bulk-detail-meta"),
  coordLabel: document.getElementById("coord-label"),
  ecalcToggle: document.getElementById("ecalc-toggle"),
  ecalcPanel: document.getElementById("ecalc-panel"),
  ecalcCells: document.getElementById("ecalc-cells"),
  ecalcVolUl: document.getElementById("ecalc-vol-ul"),
  ecalcNeedleRatio: document.getElementById("ecalc-needle-ratio"),
  ecalcTipMm: document.getElementById("ecalc-tip-mm"),
  ecalcConc: document.getElementById("ecalc-conc"),
  ecalcEVal: document.getElementById("ecalc-e-val"),
  ecalcStepsUl: document.getElementById("ecalc-steps-ul"),
  ecalcStepsInj: document.getElementById("ecalc-steps-inj"),
  ecalcVoidH: document.getElementById("ecalc-void-h"),
  print2Options: document.getElementById("print-2-options"),
  print2Controls: document.getElementById("print-2-controls"),
  p2startX: document.getElementById("p2-start-x"),
  p2startY: document.getElementById("p2-start-y"),
  p2dots: document.getElementById("p2-dots"),
  p2perRow: document.getElementById("p2-per-row"),
  p2rows: document.getElementById("p2-rows"),
  p2spacingX: document.getElementById("p2-spacing-x"),
  p2spacingY: document.getElementById("p2-spacing-y"),
  p2lowerZ: document.getElementById("p2-lower-z"),
  p2upperZ: document.getElementById("p2-upper-z"),
  p2extrusionE: document.getElementById("p2-extrusion-e"),
  p2snap: document.getElementById("p2-snap"),
  savePrint1: document.getElementById("save-print-1"),
  savePrint2: document.getElementById("save-print-2"),
  saveCombined: document.getElementById("save-combined"),
  saveBulkCombined: document.getElementById("save-bulk-combined"),
  saveBulkIndividual: document.getElementById("save-bulk-individual"),
  saveCircle: document.getElementById("save-circle"),
  circleCenterX: document.getElementById("circle-center-x"),
  circleCenterY: document.getElementById("circle-center-y"),
  circleDots: document.getElementById("circle-dots"),
  circleRadius: document.getElementById("circle-radius"),
  circleStartAngle: document.getElementById("circle-start-angle"),
  circleSnapCenter: document.getElementById("circle-snap-center"),
  bulkWellGrid: document.getElementById("bulk-well-grid"),
  bulkSelectAll: document.getElementById("bulk-select-all"),
  bulkSelectNone: document.getElementById("bulk-select-none"),
  bulkSelectRef: document.getElementById("bulk-select-ref"),
  bulkSelectionCount: document.getElementById("bulk-selection-count"),
  bulkRefWellLabel: document.getElementById("bulk-ref-well-label"),
  wellSelectLabel: document.getElementById("well-select-label"),
  wellNumberLabel: document.getElementById("well-number-label"),
  previewTargetWrap: document.getElementById("preview-target-wrap"),
  previewTarget: document.getElementById("preview-target"),
  print2AngleOptions: document.getElementById("print-2-angle-options"),
  p2AngleOffset: document.getElementById("p2-angle-offset"),
  p2AngleControls: document.getElementById("p2-angle-controls"),
  p2OffsetMin: document.getElementById("p2-offset-min"),
  p2OffsetMax: document.getElementById("p2-offset-max"),
  p2OffsetSide: document.getElementById("p2-offset-side"),
};

const PRINT1_DOT_COLOR = "#2196F3";
const PRINT2_DOT_COLOR = "#9333EA";
const OVERLAP_DOT_COLOR = "#E65100";
const OVERLAP_TOLERANCE_MM = 0.02;
const PRINT1_TOOLPATH_COLOR = "rgba(156, 163, 175, 0.6)";
const PRINT2_TOOLPATH_COLOR = "rgba(147, 51, 234, 0.55)";

let dotPositions = [];
let bulkDetailDotPositions = [];
let ecalcOpen = true;

function setPreviewMeta(text) {
  if (el.previewMeta) el.previewMeta.textContent = text;
  if (el.previewMetaSingle) el.previewMetaSingle.textContent = text;
  if (el.previewMetaCircle) el.previewMetaCircle.textContent = text;
}

function getBulkDetailWellKey() {
  const selected = getSelectedBulkWells();
  const ref = el.well.value;
  const pick = el.bulkDetailWell?.value;
  if (pick && selected.includes(pick)) return pick;
  if (ref && selected.includes(ref)) return ref;
  return selected[0] || ref;
}

function syncBulkDetailWellOptions() {
  if (!el.bulkDetailWell) return;
  const selected = getSelectedBulkWells();
  const ref = el.well.value;
  const wells = selected.length ? selected : (ref ? [ref] : []);
  const previous = el.bulkDetailWell.value;

  el.bulkDetailWell.innerHTML = "";
  wells.forEach((wellKey) => {
    const option = document.createElement("option");
    option.value = wellKey;
    option.textContent = wellKey;
    el.bulkDetailWell.appendChild(option);
  });

  if (wells.includes(previous)) {
    el.bulkDetailWell.value = previous;
  } else if (wells.includes(ref)) {
    el.bulkDetailWell.value = ref;
  } else if (wells.length) {
    el.bulkDetailWell.value = wells[0];
  }
}

function safeInt(v) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

function safeFloat(v) {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function getWellCenterMm(wellKey) {
  return DEFAULT_24WELL_CENTERS[wellKey] || DEFAULT_24WELL_CENTERS.A1;
}

function startPositionForCenterDotAtWellCenter(wellKey, numDots, dotsPerRow, spacingX, spacingY) {
  if (dotsPerRow <= 0) return getWellCenterMm(wellKey);
  const rows = Math.ceil(numDots / dotsPerRow);
  const centerCol = Math.floor((dotsPerRow - 1) / 2);
  const centerRow = Math.floor((rows - 1) / 2);
  const [wcx, wcy] = getWellCenterMm(wellKey);
  return [wcx - centerCol * spacingX, wcy - centerRow * spacingY];
}

function applyWellDefaults(target, wellKey) {
  target.dots.value = "30";
  target.perRow.value = "10";
  target.rows.value = "3";
  target.spacingX.value = "0.3";
  target.spacingY.value = "1.5";
  target.lowerZ.value = DEFAULT_LOWER_Z_OFFSET.toFixed(2);
  target.upperZ.value = DEFAULT_UPPER_Z_OFFSET.toFixed(2);
  if (target.wellNumber) target.wellNumber.value = wellKey;
  target.extrusionE.value = DEFAULT_EXTRUSION.toFixed(4);

  const [cx, cy] = DEFAULT_24WELL_STARTS[wellKey] || DEFAULT_24WELL_STARTS.A1;
  target.startX.value = cx.toFixed(2);
  target.startY.value = cy.toFixed(2);
}

function print1FieldTarget() {
  return {
    well: el.well,
    startX: el.startX,
    startY: el.startY,
    dots: el.dots,
    perRow: el.perRow,
    rows: el.rows,
    spacingX: el.spacingX,
    spacingY: el.spacingY,
    lowerZ: el.lowerZ,
    upperZ: el.upperZ,
    wellNumber: el.wellNumber,
    extrusionE: el.extrusionE,
  };
}

function print2FieldTarget() {
  return {
    startX: el.p2startX,
    startY: el.p2startY,
    dots: el.p2dots,
    perRow: el.p2perRow,
    rows: el.p2rows,
    spacingX: el.p2spacingX,
    spacingY: el.p2spacingY,
    lowerZ: el.p2lowerZ,
    upperZ: el.p2upperZ,
    extrusionE: el.p2extrusionE,
  };
}

function setDefaultsFromCurrentWell() {
  applyWellDefaults(print1FieldTarget(), el.well.value);
}

function setPrint2Defaults() {
  applyWellDefaults(print2FieldTarget(), el.well.value);
}

function getPrint2Mode() {
  const selected = document.querySelector('input[name="print-2-mode"]:checked');
  return selected ? selected.value : "same";
}

function collectPrintParams(fields) {
  return {
    well: fields.well.value,
    startX: safeFloat(fields.startX.value),
    startY: safeFloat(fields.startY.value),
    numDots: safeInt(fields.dots.value),
    perRow: safeInt(fields.perRow.value),
    spacingX: safeFloat(fields.spacingX.value),
    spacingY: safeFloat(fields.spacingY.value),
    lowerZ: safeFloat(fields.lowerZ.value),
    upperZ: safeFloat(fields.upperZ.value),
    wellNumber: fields.wellNumber.value.trim(),
    extrusionE: safeFloat(fields.extrusionE.value),
    annotate: el.annotate.checked,
  };
}

function collectPrint1Params() {
  return collectPrintParams(print1FieldTarget());
}

function collectPrint2PatternParams() {
  const fields = print2FieldTarget();
  const print1 = collectPrint1Params();
  return {
    well: print1.well,
    wellNumber: print1.wellNumber,
    startX: safeFloat(fields.startX.value),
    startY: safeFloat(fields.startY.value),
    numDots: safeInt(fields.dots.value),
    perRow: safeInt(fields.perRow.value),
    spacingX: safeFloat(fields.spacingX.value),
    spacingY: safeFloat(fields.spacingY.value),
    lowerZ: safeFloat(fields.lowerZ.value),
    upperZ: safeFloat(fields.upperZ.value),
    extrusionE: safeFloat(fields.extrusionE.value),
    annotate: el.annotate.checked,
  };
}

function getAngleOffsetSettings() {
  return {
    enabled: el.p2AngleOffset.checked,
    min: safeFloat(el.p2OffsetMin.value),
    max: safeFloat(el.p2OffsetMax.value),
    sign: el.p2OffsetSide.value === "negative" ? -1 : 1,
  };
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

function applyProgressiveYOffset(baseDots, print1Dots, perRow, minDist, maxDist, sign = 1) {
  if (!baseDots.length) return [];

  return baseDots.map((dot, i) => {
    const col = perRow > 0 ? i % perRow : 0;
    const t = perRow > 1 ? col / (perRow - 1) : 0;
    const dist = minDist + (maxDist - minDist) * t;
    const ref = print1Dots[Math.min(i, print1Dots.length - 1)] || dot;
    return {
      absX: ref.absX,
      absY: ref.absY + dist * sign,
    };
  });
}

function buildAngledPrint2Dots(print2Params) {
  const print1 = collectPrint1Params();
  const print1Dots = computeGridDotsFromParams(print1);
  if (!print1Dots.length) return computeGridDotsFromParams(print2Params);

  const baseDots = getPrint2Mode() === "same"
    ? print1Dots.map((dot) => ({ ...dot }))
    : computeGridDotsFromParams(print2Params);
  const { min, max, sign } = getAngleOffsetSettings();
  const perRow = print2Params.perRow > 0 ? print2Params.perRow : print1.perRow;
  return applyProgressiveYOffset(baseDots, print1Dots, perRow, min, max, sign);
}

function getAppMode() {
  return document.body.dataset.appMode || "standard";
}

function isSecondPassEnabled() {
  return getAppMode() === "multi-print";
}

function isBulkPrintEnabled() {
  return getAppMode() === "bulk-print";
}

function isCirclePrintEnabled() {
  return getAppMode() === "circle-print";
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

function applyCircleDefaults(wellKey) {
  const [cx, cy] = getWellCenterMm(wellKey);
  if (el.circleCenterX) el.circleCenterX.value = cx.toFixed(2);
  if (el.circleCenterY) el.circleCenterY.value = cy.toFixed(2);
  if (el.circleDots) el.circleDots.value = "12";
  if (el.circleRadius) el.circleRadius.value = "3";
  if (el.circleStartAngle) el.circleStartAngle.value = "0";
  if (el.wellNumber) el.wellNumber.value = wellKey;
  el.lowerZ.value = DEFAULT_LOWER_Z_OFFSET.toFixed(2);
  el.upperZ.value = DEFAULT_UPPER_Z_OFFSET.toFixed(2);
  el.extrusionE.value = DEFAULT_EXTRUSION.toFixed(4);
}

function collectCircleParams() {
  const well = el.well.value;
  const centerX = safeFloat(el.circleCenterX.value);
  const centerY = safeFloat(el.circleCenterY.value);
  const numDots = safeInt(el.circleDots.value);
  const radiusMm = safeFloat(el.circleRadius.value);
  const startAngleDeg = safeFloat(el.circleStartAngle.value);
  const customDots = computeCircleDots(centerX, centerY, radiusMm, numDots, startAngleDeg);
  return {
    well,
    wellNumber: el.wellNumber.value.trim() || well,
    centerX,
    centerY,
    numDots,
    radiusMm,
    startAngleDeg,
    lowerZ: safeFloat(el.lowerZ.value),
    upperZ: safeFloat(el.upperZ.value),
    extrusionE: safeFloat(el.extrusionE.value),
    annotate: el.annotate.checked,
    customDots,
  };
}

function validateCircleParams(params) {
  if (!params.wellNumber) return "Error: Well number required.";
  if (params.numDots <= 0) return "Error: Number of dots must be > 0.";
  if (params.radiusMm < 0) return "Error: Circle radius cannot be negative.";
  if (params.lowerZ < 0 || params.upperZ < 0) {
    return "Error: Z offsets cannot be negative.";
  }
  if (params.extrusionE <= 0) {
    return "Error: Extrusion per dot (E) must be greater than 0.";
  }
  const maxR = WELL_DIAM_MM / 2;
  if (params.radiusMm > maxR) {
    return `Error: Radius exceeds well (${maxR.toFixed(2)} mm max).`;
  }
  return null;
}

function circleParamsToGcode(params) {
  return buildGcode({
    startX: params.centerX,
    startY: params.centerY,
    numDots: params.numDots,
    spacingX: 0,
    spacingY: 0,
    lowerZ: params.lowerZ,
    upperZ: params.upperZ,
    wellNumber: params.wellNumber,
    dotsPerRow: params.numDots,
    annotate: params.annotate,
    extrusionE: params.extrusionE,
    customDots: params.customDots,
  });
}

function defaultCircleFileName(params) {
  return `well_${params.wellNumber}_circle_R${params.radiusMm.toFixed(2)}_Z${params.lowerZ.toFixed(2)}.txt`;
}

function translateStartForWell(refWell, targetWell, refStartX, refStartY) {
  const refDefault = DEFAULT_24WELL_STARTS[refWell] || DEFAULT_24WELL_STARTS.A1;
  const targetDefault = DEFAULT_24WELL_STARTS[targetWell] || DEFAULT_24WELL_STARTS.A1;
  const deltaX = refStartX - refDefault[0];
  const deltaY = refStartY - refDefault[1];
  return [targetDefault[0] + deltaX, targetDefault[1] + deltaY];
}

function collectBulkParamsForWell(wellKey) {
  const base = collectPrint1Params();
  const [startX, startY] = translateStartForWell(
    base.well,
    wellKey,
    base.startX,
    base.startY
  );
  return {
    ...base,
    well: wellKey,
    wellNumber: wellKey,
    startX,
    startY,
  };
}

function getSelectedBulkWells() {
  if (!el.bulkWellGrid) return [];
  return [...el.bulkWellGrid.querySelectorAll('input[type="checkbox"]:checked')]
    .map((input) => input.value)
    .sort((a, b) => {
      const rowA = ROW_KEYS.indexOf(a[0]);
      const rowB = ROW_KEYS.indexOf(b[0]);
      if (rowA !== rowB) return rowA - rowB;
      return Number.parseInt(a.slice(1), 10) - Number.parseInt(b.slice(1), 10);
    });
}

function setBulkWellChecked(wellKey, checked) {
  const input = el.bulkWellGrid?.querySelector(`input[value="${wellKey}"]`);
  if (input) input.checked = checked;
}

function setAllBulkWellsChecked(checked) {
  el.bulkWellGrid?.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.checked = checked;
  });
  updateBulkSelectionCount();
  drawPreview();
}

function updateBulkSelectionCount() {
  if (!el.bulkSelectionCount) return;
  const count = getSelectedBulkWells().length;
  const noun = count === 1 ? "well" : "wells";
  el.bulkSelectionCount.textContent = `${count} ${noun} selected`;
}

function getPlateBoundsMm() {
  const centers = Object.values(DEFAULT_24WELL_CENTERS);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  centers.forEach(([x, y]) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  });
  const pad = WELL_DIAM_MM / 2;
  return { minX: minX - pad, maxX: maxX + pad, minY: minY - pad, maxY: maxY + pad };
}

function plateMmToCanvas(x, y, bounds, cw, ch, margin) {
  const spanX = bounds.maxX - bounds.minX;
  const spanY = bounds.maxY - bounds.minY;
  const usablePx = Math.min(cw, ch) - (2 * margin);
  const scale = usablePx / Math.max(spanX, spanY, 1);
  return {
    px: margin + (x - bounds.minX) * scale,
    py: ch - margin - (y - bounds.minY) * scale,
    scale,
  };
}

function buildBulkCombinedGcode(wells) {
  return wells
    .map((wellKey) => {
      const params = collectBulkParamsForWell(wellKey);
      return `; === Well ${wellKey} ===\n${paramsToGcode(params)}`;
    })
    .join("\n\n");
}

function defaultBulkFileName(wells, lowerZ) {
  if (wells.length === 1) {
    return `well_${wells[0]}_Z${lowerZ.toFixed(2)}.txt`;
  }
  const label = wells.length <= 6
    ? wells.join("-")
    : `${wells.length}wells`;
  return `bulk_${label}_Z${lowerZ.toFixed(2)}.txt`;
}

function setAppMode(tabId) {
  document.body.dataset.appMode = tabId;
  if (tabId === "circle-print") {
    applyCircleDefaults(el.well.value);
  }
  updateModeUi();
  drawPreview();
}

function collectPrint2Params() {
  if (!isSecondPassEnabled()) return null;

  let params;
  if (getPrint2Mode() === "same") {
    params = collectPrint1Params();
  } else {
    params = collectPrint2PatternParams();
  }

  if (getAngleOffsetSettings().enabled) {
    const customDots = buildAngledPrint2Dots(params);
    return {
      ...params,
      numDots: customDots.length,
      customDots,
    };
  }
  return params;
}

function validatePrintParams(params) {
  if (!params.wellNumber) return "Error: Well number required.";
  if (params.numDots <= 0 || params.perRow <= 0) {
    return "Error: Dots and Dots Per Row must be > 0.";
  }
  if (params.lowerZ < 0 || params.upperZ < 0) {
    return "Error: Z offsets cannot be negative.";
  }
  if (params.extrusionE <= 0) {
    return "Error: Extrusion per dot (E) must be greater than 0.";
  }
  return null;
}

function validateAngleOffset() {
  if (!isSecondPassEnabled() || !el.p2AngleOffset.checked) return null;
  const angle = getAngleOffsetSettings();
  if (angle.min < 0 || angle.max < 0) {
    return "Error: Y offset distances cannot be negative.";
  }
  if (angle.min > angle.max) {
    return "Error: Min Y offset must be ≤ max Y offset.";
  }
  return null;
}

function paramsToGcode(params) {
  return buildGcode({
    startX: params.startX,
    startY: params.startY,
    numDots: params.numDots,
    spacingX: params.spacingX,
    spacingY: params.spacingY,
    lowerZ: params.lowerZ,
    upperZ: params.upperZ,
    wellNumber: params.wellNumber,
    dotsPerRow: params.perRow,
    annotate: params.annotate,
    extrusionE: params.extrusionE,
    customDots: params.customDots,
  });
}

function buildCombinedGcode(print1, print2, sameMode) {
  const gcode1 = paramsToGcode(print1);
  const repeatGcode = sameMode && !print2.customDots;
  const gcode2 = repeatGcode ? gcode1 : paramsToGcode(print2);
  const sameNote = repeatGcode ? "; (same pattern as Print 1)\n" : "";
  return `${gcode1}\n\n; === Print 2 (second pass, same well ${print1.wellNumber}) ===\n${sameNote}\n${gcode2}`;
}

function defaultFileNameForParams(params, suffix) {
  return `well_${params.wellNumber}_Z${params.lowerZ.toFixed(2)}${suffix}.txt`;
}

function updateModeUi() {
  const multi = isSecondPassEnabled();
  const bulk = isBulkPrintEnabled();
  const circle = isCirclePrintEnabled();

  el.p2AngleControls.hidden = !multi || !el.p2AngleOffset.checked;
  el.print2Controls.hidden = !multi || getPrint2Mode() !== "different";

  el.save.hidden = multi || bulk || circle;
  el.savePrint1.hidden = !multi;
  el.savePrint2.hidden = !multi;
  el.saveCombined.hidden = !multi;
  if (el.saveBulkCombined) el.saveBulkCombined.hidden = !bulk;
  if (el.saveBulkIndividual) el.saveBulkIndividual.hidden = !bulk;
  if (el.saveCircle) el.saveCircle.hidden = !circle;

  el.previewTargetWrap.hidden = !multi;

  if (el.wellSelectLabel) {
    el.wellSelectLabel.textContent = bulk
      ? "Reference well (pattern template)"
      : "Select Well Position";
  }
  if (el.wellNumberLabel) {
    el.wellNumberLabel.textContent = bulk ? "Reference well number" : "Well Number";
  }
  if (el.bulkRefWellLabel) {
    el.bulkRefWellLabel.textContent = el.well.value;
  }

  if (bulk) {
    const selected = getSelectedBulkWells();
    if (!selected.includes(el.well.value)) {
      setBulkWellChecked(el.well.value, true);
      updateBulkSelectionCount();
    }
  }
}

function getPreviewView() {
  if (!isSecondPassEnabled()) return "1";
  return el.previewTarget.value || "both";
}

function syncPrint2Rows() {
  const dots = safeInt(el.p2dots.value);
  const perRow = safeInt(el.p2perRow.value);
  if (dots > 0 && perRow > 0) el.p2rows.value = String(Math.ceil(dots / perRow));
}

function appendDotSequence(lines, dotCoords, params, annotate, zApproach, zRetract, zSafe) {
  const { lowerZ, upperZ, extrusionE } = params;
  dotCoords.forEach((coord, dotIndex) => {
    const x = coord.absX;
    const y = coord.absY;
    lines.push("");
    lines.push(`; Begin dot ${dotIndex + 1}`);
    if (annotate) {
      lines.push(`G1 X${x.toFixed(2)} Y${y.toFixed(2)} F350  ; Move to dot position (X, Y) at 350 mm/min`);
      lines.push(`G4 P200                ; Pause 200ms to stabilize`);
      lines.push(`G1 Z${zApproach.toFixed(2)} F250          ; Move down to approach height at 250 mm/min`);
      lines.push(`G4 P200                ; Pause 200ms`);
      lines.push(`G1 Z${lowerZ.toFixed(2)} F30        ; Slowly descend to lower position (${lowerZ.toFixed(2)}mm) at 30 mm/min`);
      lines.push(`G4 P500                ; Pause 500ms at lower position`);
      lines.push(`G1 Z${upperZ.toFixed(2)} E ${extrusionE.toFixed(4)} F3 ; Move up to upper position (${upperZ.toFixed(2)}mm), extrude ${extrusionE.toFixed(4)}, slow at 3 mm/min`);
      lines.push(`G4 S1.5                ; Wait 1.5 seconds for dispensing`);
      lines.push(`G1 Z${zRetract.toFixed(2)} F80           ; Retract to ${zRetract.toFixed(2)}mm at 80 mm/min`);
      lines.push(`G4 P750                ; Pause 750ms`);
      lines.push(`G1 Z${zSafe.toFixed(2)} F350             ; Lift to safe height (${zSafe.toFixed(2)}mm) at 350 mm/min`);
      lines.push(`G4 P200                ; Final pause 200ms`);
    } else {
      lines.push(`G1 X${x.toFixed(2)} Y${y.toFixed(2)} F350`);
      lines.push(`G4 P200`);
      lines.push(`G1 Z${zApproach.toFixed(2)} F250`);
      lines.push(`G4 P200`);
      lines.push(`G1 Z${lowerZ.toFixed(2)} F30`);
      lines.push(`G4 P500`);
      lines.push(`G1 Z${upperZ.toFixed(2)} E ${extrusionE.toFixed(4)} F3`);
      lines.push(`G4 S1.5`);
      lines.push(`G1 Z${zRetract.toFixed(2)} F80`);
      lines.push(`G4 P750`);
      lines.push(`G1 Z${zSafe.toFixed(2)} F350`);
      lines.push(`G4 P200`);
    }
  });
}

function buildGcode(params) {
  const {
    startX, startY, numDots, spacingX, spacingY, lowerZ, upperZ,
    wellNumber, dotsPerRow, annotate, extrusionE, customDots,
  } = params;
  const now = new Date().toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).replace(",", "");

  const zApproach = 4.71;
  const zRetract = 4.31;
  const zSafe = 6.21;
  const wellLetter = /^[A-Za-z]/.test(wellNumber) ? wellNumber[0].toUpperCase() : "A";
  const rowNum = wellLetter.charCodeAt(0) - "A".charCodeAt(0) + 1;
  const lines = [];

  lines.push(`; G-code generated ${now}`);
  lines.push(`; Well ${wellNumber} | Lower Z ${lowerZ.toFixed(2)} mm | Upper Z ${upperZ.toFixed(2)} mm | E ${extrusionE.toFixed(4)}`);
  lines.push("");
  lines.push(`BottomElevation: ${WELL_BOTTOM_Z.toFixed(2)}`);
  lines.push("; Zbottom: ");
  lines.push("; Zplus: ");
  lines.push("; Zplusplus: ");
  lines.push("; Zvoid: ");
  lines.push(`; num2str(t) ;WORKING ON ROW ${rowNum} OF THE 24 WELL TRAY`);
  lines.push(`; Well number ${wellNumber}`);
  lines.push("");
  lines.push("M83");
  lines.push("");
  lines.push("G4 P100");
  lines.push("");

  const dotCoords = customDots && customDots.length
    ? customDots
    : computeGridDotsFromParams({
      startX, startY, numDots, spacingX, spacingY, perRow: dotsPerRow,
    });
  appendDotSequence(
    lines,
    dotCoords,
    { lowerZ, upperZ, extrusionE },
    annotate,
    zApproach,
    zRetract,
    zSafe
  );
  lines.push("");
  lines.push("; === End sequence ===");
  if (annotate) {
    lines.push("G1 Z23 F250            ; Move to final safe height (23mm) at 250 mm/min");
    lines.push("G4 P100                ; Final pause 100ms");
  } else {
    lines.push("G1 Z23 F250");
    lines.push("G4 P100");
  }
  return lines.join("\n");
}

function drawArrow(ctx, tailX, tailY, tipX, tipY, options = {}) {
  const {
    color = "#6b7280",
    lineWidth = 2,
    headLength = 8,
    headWidth = 6,
  } = options;
  const dx = tipX - tailX;
  const dy = tipY - tailY;
  const len = Math.hypot(dx, dy);
  if (len < 4) return;

  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const hl = Math.min(headLength, len * 0.38);
  const hw = headWidth * 0.5;
  const shaftEndX = tipX - ux * hl;
  const shaftEndY = tipY - uy * hl;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(tailX, tailY);
  ctx.lineTo(shaftEndX, shaftEndY);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(shaftEndX + nx * hw, shaftEndY + ny * hw);
  ctx.lineTo(shaftEndX - nx * hw, shaftEndY - ny * hw);
  ctx.closePath();
  ctx.fill();
}

function drawDimensionLabel(ctx, text, x, y, color, vertical) {
  ctx.save();
  ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (vertical) {
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(text, 0, 0);
  } else {
    ctx.fillText(text, x, y);
  }
  ctx.restore();
}

function drawHorizontalSpacing(ctx, x1, x2, bottomRowY, spacingMm, dotR) {
  const color = "#FF9800";
  const len = Math.abs(x2 - x1);
  if (len < 4) return;
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  const dotEdge = bottomRowY + dotR;
  const dimY = dotEdge + 34;
  const labelY = dimY + 12;

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(left, dotEdge);
  ctx.lineTo(left, dimY);
  ctx.moveTo(right, dotEdge);
  ctx.lineTo(right, dimY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, dimY);
  ctx.lineTo(right, dimY);
  ctx.stroke();

  drawArrow(ctx, left, dimY, left + 7, dimY, { color, lineWidth: 2, headLength: 6, headWidth: 5 });
  drawArrow(ctx, right, dimY, right - 7, dimY, { color, lineWidth: 2, headLength: 6, headWidth: 5 });
  drawDimensionLabel(ctx, `ΔX: ${spacingMm.toFixed(3)} mm`, (left + right) / 2, labelY, color, false);
}

function drawVerticalSpacing(ctx, x, y1, y2, spacingMm, dotR) {
  const color = "#4CAF50";
  const len = Math.abs(y2 - y1);
  if (len < 4) return;
  const top = Math.min(y1, y2);
  const bottom = Math.max(y1, y2);
  const dotEdge = x + dotR;
  const dimX = dotEdge + 28;

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(dotEdge, top);
  ctx.lineTo(dimX, top);
  ctx.moveTo(dotEdge, bottom);
  ctx.lineTo(dimX, bottom);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(dimX, top);
  ctx.lineTo(dimX, bottom);
  ctx.stroke();

  drawArrow(ctx, dimX, top, dimX, top + 7, { color, lineWidth: 2, headLength: 6, headWidth: 5 });
  drawArrow(ctx, dimX, bottom, dimX, bottom - 7, { color, lineWidth: 2, headLength: 6, headWidth: 5 });
  drawDimensionLabel(ctx, `ΔY: ${spacingMm.toFixed(3)} mm`, dimX + 22, (top + bottom) / 2, color, true);
}

function lastDotInRow(dotPositions, rowIndex, perRow) {
  const start = rowIndex * perRow;
  const end = Math.min(start + perRow, dotPositions.length);
  if (end <= start) return null;
  return dotPositions[end - 1];
}

function rowSpacingPair(dotPositions, rowIndex, perRow) {
  const start = rowIndex * perRow;
  if (start + 1 >= dotPositions.length) return null;
  const first = dotPositions[start];
  const second = dotPositions[start + 1];
  if (Math.abs(first.absY - second.absY) > 0.01) return null;
  return [first, second];
}

function drawToolpath(ctx, dotPositions, dotR, strokeColor = PRINT1_TOOLPATH_COLOR) {
  if (dotPositions.length < 2) return;

  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.25;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();

  for (let i = 1; i < dotPositions.length; i += 1) {
    const prev = dotPositions[i - 1];
    const curr = dotPositions[i];
    const dx = curr.px - prev.px;
    const dy = curr.py - prev.py;
    const len = Math.hypot(dx, dy);
    if (len < 0.01) continue;
    const ux = dx / len;
    const uy = dy / len;
    const x1 = prev.px + ux * dotR;
    const y1 = prev.py + uy * dotR;
    const x2 = curr.px - ux * dotR;
    const y2 = curr.py - uy * dotR;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  }

  ctx.stroke();
  ctx.restore();
}

function dotsOverlap(a, b, tolerance = OVERLAP_TOLERANCE_MM) {
  return Math.abs(a.absX - b.absX) < tolerance && Math.abs(a.absY - b.absY) < tolerance;
}

function partitionOverlappingDots(positions1, positions2) {
  const overlaps = [];
  const only1 = [];
  const only2 = [];
  const matched2 = new Set();

  positions1.forEach((d1) => {
    const matchIdx = positions2.findIndex(
      (d2, i) => !matched2.has(i) && dotsOverlap(d1, d2)
    );
    if (matchIdx >= 0) {
      matched2.add(matchIdx);
      overlaps.push({ ...d1 });
    } else {
      only1.push(d1);
    }
  });

  positions2.forEach((d2, i) => {
    if (!matched2.has(i)) only2.push(d2);
  });

  return { only1, only2, overlaps };
}

function drawPreviewLegend(ctx, cw, ch, { showPrint2 = false, showOverlap = false } = {}) {
  const margin = 12;
  const rowHeight = 16;
  const lineLen = 22;
  const gap = 8;
  const dotR = 4;
  const font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  const rows = [
    { type: "line", label: "Tool path", color: PRINT1_TOOLPATH_COLOR },
    { type: "dot", label: "Print 1", color: PRINT1_DOT_COLOR },
  ];
  if (showPrint2) {
    rows.push({ type: "dot", label: "Print 2", color: PRINT2_DOT_COLOR });
  }
  if (showOverlap) {
    rows.push({ type: "dot", label: "Multi-point site", color: OVERLAP_DOT_COLOR });
  }

  ctx.save();
  ctx.font = font;
  let maxWidth = 0;
  rows.forEach((row) => {
    maxWidth = Math.max(maxWidth, ctx.measureText(row.label).width);
  });
  const swatchWidth = lineLen + gap;
  const blockWidth = swatchWidth + maxWidth;
  const startX = cw - margin - blockWidth;

  rows.forEach((row, index) => {
    const y = ch - margin - (rows.length - 1 - index) * rowHeight;
    const textX = startX + swatchWidth;

    if (row.type === "line") {
      ctx.strokeStyle = row.color;
      ctx.lineWidth = 1.25;
      ctx.lineCap = "round";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(startX + lineLen, y);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = row.color;
      ctx.beginPath();
      ctx.arc(startX + dotR, y, dotR, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#6b7280";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(row.label, textX, y);
  });

  ctx.restore();
}

function wellToCanvas(wellKey, refCx, refCy, pxCenterX, pxCenterY, scale) {
  const [cx, cy] = DEFAULT_24WELL_CENTERS[wellKey] || DEFAULT_24WELL_CENTERS.A1;
  return {
    px: pxCenterX + (cx - refCx) * scale,
    py: pxCenterY - (cy - refCy) * scale,
  };
}

function computeDotPositions(cfg, refCx, refCy, pxCenterX, pxCenterY, scale, rPx, dotR) {
  const positions = [];
  const wellCenter = wellToCanvas(cfg.well, refCx, refCy, pxCenterX, pxCenterY, scale);
  const sourceDots = cfg.customDots && cfg.customDots.length
    ? cfg.customDots
    : computeGridDotsFromParams(cfg);

  sourceDots.forEach((dot) => {
    const px = pxCenterX + (dot.absX - refCx) * scale;
    const py = pxCenterY - (dot.absY - refCy) * scale;
    if (Math.hypot(px - wellCenter.px, py - wellCenter.py) < (rPx - dotR)) {
      positions.push({ absX: dot.absX, absY: dot.absY, px, py });
    }
  });

  const rows = cfg.perRow > 0 ? Math.ceil(cfg.numDots / cfg.perRow) : 0;
  const gridWmm = Math.max(0, (cfg.perRow - 1) * cfg.spacingX);
  const gridHmm = Math.max(0, (rows - 1) * cfg.spacingY);
  return { positions, rows, gridWmm, gridHmm };
}

function drawWellOutline(ctx, wellKey, refCx, refCy, pxCenterX, pxCenterY, scale, rPx) {
  const { px, py } = wellToCanvas(wellKey, refCx, refCy, pxCenterX, pxCenterY, scale);
  ctx.beginPath();
  ctx.arc(px, py, rPx, 0, Math.PI * 2);
  ctx.stroke();
}

function drawPrintDots(ctx, positions, color, dotR) {
  ctx.fillStyle = color;
  positions.forEach(({ px, py }) => {
    ctx.beginPath();
    ctx.arc(px, py, dotR, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawSpacingIndicators(ctx, print1Positions, perRow, rows, spacingX, spacingY, dotR, anchorPositions) {
  const bottomY = anchorPositions.length
    ? Math.max(...anchorPositions.map((d) => d.py))
    : 0;

  if (spacingX > 0 && perRow >= 2) {
    const pair = rowSpacingPair(print1Positions, 0, perRow);
    if (pair) {
      drawHorizontalSpacing(ctx, pair[0].px, pair[1].px, bottomY, spacingX, dotR);
    }
  }

  if (rows > 1 && perRow > 0 && print1Positions.length >= perRow + 1 && spacingY > 0) {
    const topDot = lastDotInRow(print1Positions, 0, perRow);
    const bottomDot = lastDotInRow(print1Positions, 1, perRow);
    if (topDot && bottomDot) {
      drawVerticalSpacing(ctx, topDot.px, topDot.py, bottomDot.py, spacingY, dotR);
    }
  }
}

function drawXYHomeIndicator(ctx, cornerX, cornerY, { scale = 1 } = {}) {
  const tipX = cornerX + 1;
  const tipY = cornerY - 1;
  const labelX = cornerX + 42 * scale;
  const labelY = cornerY - 52 * scale;
  const fontSize = Math.max(9, Math.round(11 * scale));
  const font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;

  ctx.save();
  ctx.font = font;
  ctx.fillStyle = "#4b5563";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("X & Y", labelX, labelY);
  ctx.fillText("home", labelX, labelY + 13 * scale);

  const tailX = labelX - 4 * scale;
  const tailY = labelY + 24 * scale;
  drawArrow(ctx, tailX, tailY, tipX, tipY, {
    color: "#6b7280",
    lineWidth: Math.max(1.2, 1.6 * scale),
    headLength: Math.max(5, 7 * scale),
    headWidth: Math.max(4, 5.5 * scale),
  });

  const bracket = 5 * scale;
  ctx.strokeStyle = "#9ca3af";
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cornerX, cornerY - bracket);
  ctx.lineTo(cornerX, cornerY);
  ctx.lineTo(cornerX + bracket, cornerY);
  ctx.stroke();
  ctx.restore();
}

function dotsFromAbsCoords(customDots, wellKey, refCx, refCy, pxCenterX, pxCenterY, scale, rPx, dotR) {
  const positions = [];
  customDots.forEach((dot) => {
    const px = pxCenterX + (dot.absX - refCx) * scale;
    const py = pxCenterY - (dot.absY - refCy) * scale;
    if (Math.hypot(px - pxCenterX, py - pxCenterY) < (rPx - dotR)) {
      positions.push({ absX: dot.absX, absY: dot.absY, px, py });
    }
  });
  return positions;
}

function drawCircleRadiusGuide(ctx, centerPx, centerPy, edgePx, edgePy, radiusMm) {
  ctx.save();
  ctx.strokeStyle = "#f97316";
  ctx.lineWidth = 1.25;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(centerPx, centerPy);
  ctx.lineTo(edgePx, edgePy);
  ctx.stroke();
  ctx.setLineDash([]);

  const labelX = (centerPx + edgePx) / 2 + 8;
  const labelY = (centerPy + edgePy) / 2 - 6;
  ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillStyle = "#ea580c";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`R: ${radiusMm.toFixed(2)} mm`, labelX, labelY);
  ctx.restore();
}

function drawCircleCenterMark(ctx, px, py) {
  ctx.save();
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1;
  const s = 4;
  ctx.beginPath();
  ctx.moveTo(px - s, py);
  ctx.lineTo(px + s, py);
  ctx.moveTo(px, py - s);
  ctx.lineTo(px, py + s);
  ctx.stroke();
  ctx.restore();
}

function drawStartArrow(ctx, positions, dotR) {
  if (positions.length < 2) return;
  const first = positions[0];
  const second = positions[1];
  const dx = second.px - first.px;
  const dy = second.py - first.py;
  const len = Math.hypot(dx, dy);
  if (len <= 2) return;

  const ux = dx / len;
  const uy = dy / len;
  const gapBeforeDot = dotR + 8;
  const shaftLen = Math.min(32, Math.max(16, len * 0.55));
  const tipX = first.px - ux * gapBeforeDot;
  const tipY = first.py - uy * gapBeforeDot;
  const tailX = tipX - ux * shaftLen;
  const tailY = tipY - uy * shaftLen;
  drawArrow(ctx, tailX, tailY, tipX, tipY, {
    color: "#16A34A",
    lineWidth: 2,
    headLength: Math.min(8, Math.max(5, len * 0.2)),
    headWidth: Math.min(6, Math.max(3.5, len * 0.14)) * 2,
  });

  const nx = -uy;
  const ny = ux;
  const labelX = (tailX + tipX) / 2 + nx * 14;
  const labelY = (tailY + tipY) / 2 + ny * 14;
  ctx.save();
  ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillStyle = "#16A34A";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("start", labelX, labelY);
  ctx.restore();
}

function drawWellDetailPreview(canvasEl, params, positionsOut) {
  const detailCtx = canvasEl.getContext("2d");
  const refCenter = DEFAULT_24WELL_CENTERS[params.well] || DEFAULT_24WELL_CENTERS.A1;
  const refCx = refCenter[0];
  const refCy = refCenter[1];
  const cw = canvasEl.width;
  const ch = canvasEl.height;
  const pxCenterX = cw / 2;
  const pxCenterY = ch / 2;
  const margin = 20;
  const usablePx = Math.min(cw, ch) - (2 * margin);
  const scale = usablePx / WELL_DIAM_MM;
  const rPx = (WELL_DIAM_MM / 2) * scale;
  const dotR = 3.5;

  const printData = computeDotPositions(
    params, refCx, refCy, pxCenterX, pxCenterY, scale, rPx, dotR
  );

  detailCtx.clearRect(0, 0, cw, ch);
  detailCtx.strokeStyle = "#666";
  detailCtx.lineWidth = 2;
  drawWellOutline(detailCtx, params.well, refCx, refCy, pxCenterX, pxCenterY, scale, rPx);

  printData.positions.forEach((dot) => {
    positionsOut.push({ ...dot, printNum: 1, wellKey: params.well });
  });
  drawToolpath(detailCtx, printData.positions, dotR, PRINT1_TOOLPATH_COLOR);
  drawPrintDots(detailCtx, printData.positions, PRINT1_DOT_COLOR, dotR);
  drawStartArrow(detailCtx, printData.positions, dotR);
  drawSpacingIndicators(
    detailCtx,
    printData.positions,
    params.perRow,
    printData.rows,
    params.spacingX,
    params.spacingY,
    dotR,
    printData.positions
  );

  const homeWell = wellToCanvas(params.well, refCx, refCy, pxCenterX, pxCenterY, scale);
  const homeScale = Math.min(1, canvasEl.width / 560);
  drawXYHomeIndicator(detailCtx, homeWell.px - rPx, homeWell.py + rPx, { scale: homeScale });
  drawPreviewLegend(detailCtx, cw, ch, { showPrint2: false, showOverlap: false });

  return printData;
}

function drawBulkDetailPreview() {
  if (!el.bulkDetailCanvas) return;
  bulkDetailDotPositions = [];
  const selected = getSelectedBulkWells();
  const detailCtx = el.bulkDetailCanvas.getContext("2d");
  const cw = el.bulkDetailCanvas.width;
  const ch = el.bulkDetailCanvas.height;

  if (!selected.length) {
    detailCtx.clearRect(0, 0, cw, ch);
    detailCtx.fillStyle = "#6b7280";
    detailCtx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    detailCtx.textAlign = "center";
    detailCtx.textBaseline = "middle";
    detailCtx.fillText("Select wells to preview detail", cw / 2, ch / 2);
    if (el.bulkDetailMeta) {
      el.bulkDetailMeta.textContent = "Well detail | No wells selected";
    }
    return;
  }

  syncBulkDetailWellOptions();
  const wellKey = getBulkDetailWellKey();
  const params = collectBulkParamsForWell(wellKey);
  const printData = drawWellDetailPreview(el.bulkDetailCanvas, params, bulkDetailDotPositions);
  if (el.bulkDetailMeta) {
    el.bulkDetailMeta.textContent = [
      `Well ${wellKey}`,
      `Start X ${params.startX.toFixed(2)} Y ${params.startY.toFixed(2)}`,
      `grid ${printData.gridWmm.toFixed(2)} × ${printData.gridHmm.toFixed(2)} mm`,
      `Ø ${WELL_DIAM_MM.toFixed(1)} mm`,
    ].join(" | ");
  }
}

function drawBulkPreview() {
  const selected = getSelectedBulkWells();
  const refParams = collectPrint1Params();
  const bounds = getPlateBoundsMm();
  const ctx = el.canvas.getContext("2d");
  const cw = el.canvas.width;
  const ch = el.canvas.height;
  const margin = 24;
  const dotR = 2.2;
  const wellLineWidth = selected.length > 8 ? 1.25 : 1.75;

  ctx.clearRect(0, 0, cw, ch);
  dotPositions = [];

  if (!selected.length) {
    ctx.fillStyle = "#6b7280";
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Select one or more wells to preview", cw / 2, ch / 2);
    setPreviewMeta("24-well plate | No wells selected");
    drawBulkDetailPreview();
    return;
  }

  const { scale } = plateMmToCanvas(bounds.minX, bounds.minY, bounds, cw, ch, margin);
  const rPx = (WELL_DIAM_MM / 2) * scale;

  ROW_KEYS.forEach((rowKey) => {
    COL_KEYS.forEach((colKey) => {
      const wellKey = `${rowKey}${colKey}`;
      const [cx, cy] = getWellCenterMm(wellKey);
      const { px, py } = plateMmToCanvas(cx, cy, bounds, cw, ch, margin);
      const isSelected = selected.includes(wellKey);
      const isRef = wellKey === refParams.well;

      ctx.beginPath();
      ctx.arc(px, py, rPx, 0, Math.PI * 2);
      ctx.strokeStyle = isSelected ? (isRef ? "#1d4ed8" : "#64748b") : "#d1d5db";
      ctx.lineWidth = isRef ? wellLineWidth + 0.5 : wellLineWidth;
      ctx.stroke();

      if (isRef) {
        ctx.fillStyle = "#1d4ed8";
        ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("ref", px, py - rPx - 2);
      }
    });
  });

  selected.forEach((wellKey) => {
    const params = collectBulkParamsForWell(wellKey);
    const dots = computeGridDotsFromParams(params);
    dots.forEach((dot) => {
      const { px, py } = plateMmToCanvas(dot.absX, dot.absY, bounds, cw, ch, margin);
      const [cx, cy] = getWellCenterMm(wellKey);
      const { px: wpx, py: wpy } = plateMmToCanvas(cx, cy, bounds, cw, ch, margin);
      if (Math.hypot(px - wpx, py - wpy) >= rPx - dotR) return;

      ctx.fillStyle = wellKey === refParams.well ? PRINT1_DOT_COLOR : "#60a5fa";
      ctx.beginPath();
      ctx.arc(px, py, dotR, 0, Math.PI * 2);
      ctx.fill();
      dotPositions.push({
        absX: dot.absX,
        absY: dot.absY,
        px,
        py,
        wellKey,
        printNum: 1,
      });
    });
  });

  setPreviewMeta([
    `Bulk: ${selected.length} well${selected.length === 1 ? "" : "s"}`,
    `Ref ${refParams.well}`,
    `grid ${Math.max(0, (refParams.perRow - 1) * refParams.spacingX).toFixed(2)} × ${Math.max(0, (Math.ceil(refParams.numDots / refParams.perRow) - 1) * refParams.spacingY).toFixed(2)} mm`,
    `Ø ${WELL_DIAM_MM.toFixed(1)} mm`,
  ].join(" | "));
  drawBulkDetailPreview();
}

function drawCirclePreview() {
  const params = collectCircleParams();
  const canvas = el.canvasCircle || el.canvasStd;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const refCenter = DEFAULT_24WELL_CENTERS[params.well] || DEFAULT_24WELL_CENTERS.A1;
  const refCx = refCenter[0];
  const refCy = refCenter[1];
  const cw = canvas.width;
  const ch = canvas.height;
  const pxCenterX = cw / 2;
  const pxCenterY = ch / 2;
  const margin = 20;
  const usablePx = Math.min(cw, ch) - (2 * margin);
  const scale = usablePx / WELL_DIAM_MM;
  const rPx = (WELL_DIAM_MM / 2) * scale;
  const dotR = 3.5;

  const positions = dotsFromAbsCoords(
    params.customDots,
    params.well,
    refCx,
    refCy,
    pxCenterX,
    pxCenterY,
    scale,
    rPx,
    dotR
  );

  ctx.clearRect(0, 0, cw, ch);
  dotPositions = [];

  ctx.strokeStyle = "#666";
  ctx.lineWidth = 2;
  drawWellOutline(ctx, params.well, refCx, refCy, pxCenterX, pxCenterY, scale, rPx);

  const centerPx = pxCenterX + (params.centerX - refCx) * scale;
  const centerPy = pxCenterY - (params.centerY - refCy) * scale;
  drawCircleCenterMark(ctx, centerPx, centerPy);

  if (params.radiusMm > 0 && positions.length) {
    drawCircleRadiusGuide(ctx, centerPx, centerPy, positions[0].px, positions[0].py, params.radiusMm);
  }

  if (params.radiusMm > 0) {
    ctx.save();
    ctx.strokeStyle = "rgba(249, 115, 22, 0.35)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.arc(centerPx, centerPy, params.radiusMm * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  positions.forEach((dot) => {
    dotPositions.push({ ...dot, printNum: 1 });
  });
  drawToolpath(ctx, positions, dotR, PRINT1_TOOLPATH_COLOR);
  drawPrintDots(ctx, positions, PRINT1_DOT_COLOR, dotR);
  drawStartArrow(ctx, positions, dotR);

  const homeWell = wellToCanvas(params.well, refCx, refCy, pxCenterX, pxCenterY, scale);
  drawXYHomeIndicator(ctx, homeWell.px - rPx, homeWell.py + rPx);
  drawPreviewLegend(ctx, cw, ch, { showPrint2: false, showOverlap: false });

  const outside = params.numDots - positions.length;
  const outsideNote = outside > 0 ? ` | ${outside} outside well` : "";
  setPreviewMeta([
    `Well ${params.well} | Circle R ${params.radiusMm.toFixed(2)} mm`,
    `${positions.length} dots @ ${params.startAngleDeg.toFixed(0)}° start`,
    `Ø ${WELL_DIAM_MM.toFixed(1)} mm${outsideNote}`,
  ].join(" | "));
}

function drawPreview() {
  if (isBulkPrintEnabled()) {
    drawBulkPreview();
    return;
  }
  if (isCirclePrintEnabled()) {
    drawCirclePreview();
    return;
  }

  const print1 = collectPrint1Params();
  const showPrint2 = isSecondPassEnabled();
  const print2 = showPrint2 ? collectPrint2Params() : null;
  const view = getPreviewView();
  const showPrint1Layer = view === "1" || view === "both";
  const showPrint2Layer = showPrint2 && print2 && (view === "2" || view === "both");

  const refWell = DEFAULT_24WELL_CENTERS[print1.well] || DEFAULT_24WELL_CENTERS.A1;
  const refCx = refWell[0];
  const refCy = refWell[1];

  const canvas = el.canvasStd;
  const ctx = canvas.getContext("2d");
  const cw = canvas.width;
  const ch = canvas.height;
  const pxCenterX = cw / 2;
  const pxCenterY = ch / 2;
  const margin = 20;
  const usablePx = Math.min(cw, ch) - (2 * margin);
  const scale = usablePx / WELL_DIAM_MM;
  const rPx = (WELL_DIAM_MM / 2) * scale;
  const dotR = 3.5;

  const print1Data = computeDotPositions(
    print1, refCx, refCy, pxCenterX, pxCenterY, scale, rPx, dotR
  );
  const print2Data = print2
    ? computeDotPositions(print2, refCx, refCy, pxCenterX, pxCenterY, scale, rPx, dotR)
    : null;

  const showBothLayers = view === "both" && showPrint1Layer && showPrint2Layer && print2Data;
  const overlapSplit = showBothLayers
    ? partitionOverlappingDots(print1Data.positions, print2Data.positions)
    : null;

  ctx.clearRect(0, 0, cw, ch);
  dotPositions = [];

  ctx.strokeStyle = "#666";
  ctx.lineWidth = 2;
  drawWellOutline(ctx, print1.well, refCx, refCy, pxCenterX, pxCenterY, scale, rPx);

  if (showBothLayers && overlapSplit) {
    const { only1, only2, overlaps } = overlapSplit;

    drawToolpath(ctx, print1Data.positions, dotR, PRINT1_TOOLPATH_COLOR);
    drawToolpath(ctx, print2Data.positions, dotR, PRINT2_TOOLPATH_COLOR);

    drawPrintDots(ctx, only1, PRINT1_DOT_COLOR, dotR);
    drawPrintDots(ctx, only2, PRINT2_DOT_COLOR, dotR);
    drawPrintDots(ctx, overlaps, OVERLAP_DOT_COLOR, dotR);

    only1.forEach((dot) => dotPositions.push({ ...dot, printNum: 1 }));
    only2.forEach((dot) => dotPositions.push({ ...dot, printNum: 2 }));
    overlaps.forEach((dot) => dotPositions.push({ ...dot, printNum: "both" }));

    drawStartArrow(ctx, print1Data.positions, dotR);
  } else {
    if (showPrint1Layer) {
      print1Data.positions.forEach((dot) => {
        dotPositions.push({ ...dot, printNum: 1 });
      });
      drawToolpath(ctx, print1Data.positions, dotR, PRINT1_TOOLPATH_COLOR);
      drawPrintDots(ctx, print1Data.positions, PRINT1_DOT_COLOR, dotR);
      drawStartArrow(ctx, print1Data.positions, dotR);
    }

    if (showPrint2Layer && print2Data) {
      print2Data.positions.forEach((dot) => {
        dotPositions.push({ ...dot, printNum: 2 });
      });
      drawToolpath(ctx, print2Data.positions, dotR, PRINT2_TOOLPATH_COLOR);
      drawPrintDots(ctx, print2Data.positions, PRINT2_DOT_COLOR, dotR);
      if (!showPrint1Layer) drawStartArrow(ctx, print2Data.positions, dotR);
    }
  }

  const spacingAnchors = [];
  if (showPrint1Layer) spacingAnchors.push(...print1Data.positions);
  if (showPrint2Layer && print2Data) spacingAnchors.push(...print2Data.positions);
  if (spacingAnchors.length) {
    drawSpacingIndicators(
      ctx,
      print1Data.positions,
      print1.perRow,
      print1Data.rows,
      print1.spacingX,
      print1.spacingY,
      dotR,
      spacingAnchors
    );
  }

  const homeWell = wellToCanvas(print1.well, refCx, refCy, pxCenterX, pxCenterY, scale);
  drawXYHomeIndicator(ctx, homeWell.px - rPx, homeWell.py + rPx);
  drawPreviewLegend(ctx, cw, ch, {
    showPrint2,
    showOverlap: showBothLayers && overlapSplit && overlapSplit.overlaps.length > 0,
  });

  if (showPrint2 && print2 && print2Data) {
    const wellLabel = `Well ${print1.well}`;
    if (view === "both") {
      setPreviewMeta([
        `${wellLabel} | Pass 1 grid ${print1Data.gridWmm.toFixed(2)} × ${print1Data.gridHmm.toFixed(2)} mm`,
        `Pass 2 grid ${print2Data.gridWmm.toFixed(2)} × ${print2Data.gridHmm.toFixed(2)} mm`,
        `Ø ${WELL_DIAM_MM.toFixed(1)} mm`,
      ].join(" | "));
    } else if (view === "2") {
      setPreviewMeta(`${wellLabel} | Pass 2 grid ${print2Data.gridWmm.toFixed(2)} × ${print2Data.gridHmm.toFixed(2)} mm | Ø ${WELL_DIAM_MM.toFixed(1)} mm`);
    } else {
      setPreviewMeta(`${wellLabel} | Pass 1 grid ${print1Data.gridWmm.toFixed(2)} × ${print1Data.gridHmm.toFixed(2)} mm | Ø ${WELL_DIAM_MM.toFixed(1)} mm`);
    }
  } else {
    setPreviewMeta(`Well Ø ${WELL_DIAM_MM.toFixed(1)} mm | Grid ${print1Data.gridWmm.toFixed(2)} x ${print1Data.gridHmm.toFixed(2)} mm`);
  }
}

function syncRowsAndPreview() {
  if (isCirclePrintEnabled()) {
    drawPreview();
    return;
  }
  const dots = safeInt(el.dots.value);
  const perRow = safeInt(el.perRow.value);
  if (dots > 0 && perRow > 0) el.rows.value = String(Math.ceil(dots / perRow));
  drawPreview();
}

function setEcalcOutputEmpty() {
  el.ecalcConc.textContent = "—";
  el.ecalcEVal.textContent = "—";
  el.ecalcStepsUl.textContent = "—";
  el.ecalcStepsInj.textContent = "—";
  el.ecalcVoidH.textContent = "—";
}

function updateEcalc() {
  const cells = safeFloat(el.ecalcCells.value);
  const volUl = safeFloat(el.ecalcVolUl.value);
  const needleRatio = safeFloat(el.ecalcNeedleRatio.value);
  const tipMm = safeFloat(el.ecalcTipMm.value);

  if (
    Number.isNaN(cells) ||
    Number.isNaN(volUl) ||
    Number.isNaN(needleRatio) ||
    Number.isNaN(tipMm)
  ) {
    setEcalcOutputEmpty();
    return;
  }

  if (volUl > 0) {
    el.ecalcConc.textContent = (cells / volUl).toPrecision(6).replace(/\.?0+$/, "");
  } else {
    el.ecalcConc.textContent = "—";
  }

  const eVal = needleRatio * volUl;
  const stepsPerUl = STEPS_PER_MM_ECALC * needleRatio;
  const stepsInj = stepsPerUl * volUl;
  el.ecalcEVal.textContent = eVal.toPrecision(6).replace(/\.?0+$/, "");
  el.ecalcStepsUl.textContent = stepsPerUl.toPrecision(6).replace(/\.?0+$/, "");
  el.ecalcStepsInj.textContent = stepsInj.toPrecision(6).replace(/\.?0+$/, "");

  if (tipMm > 0) {
    const r = tipMm / 2.0;
    const voidH = volUl / (Math.PI * r * r);
    el.ecalcVoidH.textContent = voidH.toPrecision(6).replace(/\.?0+$/, "");
  } else {
    el.ecalcVoidH.textContent = "—";
  }
}

async function saveGcodeFile(contents, defaultFileName) {
  const result = await window.gcodeApi.saveGcode({ defaultFileName, contents });
  el.saveStatus.textContent = result.cancelled ? "Save cancelled." : `Saved: ${result.path}`;
}

async function saveGcode() {
  const print1 = collectPrint1Params();
  const err = validatePrintParams(print1);
  if (err) {
    el.saveStatus.textContent = err;
    return;
  }
  await saveGcodeFile(paramsToGcode(print1), defaultFileNameForParams(print1, ""));
}

async function savePrint1Gcode() {
  const print1 = collectPrint1Params();
  const err = validatePrintParams(print1);
  if (err) {
    el.saveStatus.textContent = err;
    return;
  }
  await saveGcodeFile(paramsToGcode(print1), defaultFileNameForParams(print1, "_print1"));
}

async function savePrint2Gcode() {
  const print2 = collectPrint2Params();
  const err2 = validatePrintParams(print2);
  if (err2) {
    el.saveStatus.textContent = err2;
    return;
  }
  const errAngle = validateAngleOffset();
  if (errAngle) {
    el.saveStatus.textContent = errAngle;
    return;
  }
  await saveGcodeFile(
    paramsToGcode(print2),
    defaultFileNameForParams(print2, "_print2")
  );
}

async function saveCombinedGcode() {
  const print1 = collectPrint1Params();
  const print2 = collectPrint2Params();
  const err1 = validatePrintParams(print1);
  if (err1) {
    el.saveStatus.textContent = err1;
    return;
  }
  const err2 = validatePrintParams(print2);
  if (err2) {
    el.saveStatus.textContent = err2;
    return;
  }
  const errAngle = validateAngleOffset();
  if (errAngle) {
    el.saveStatus.textContent = errAngle;
    return;
  }
  const sameMode = getPrint2Mode() === "same";
  await saveGcodeFile(
    buildCombinedGcode(print1, print2, sameMode),
    `well_${print1.wellNumber}_2pass.txt`
  );
}

function validateBulkExport() {
  const ref = collectPrint1Params();
  const err = validatePrintParams(ref);
  if (err) return { error: err };
  const wells = getSelectedBulkWells();
  if (!wells.length) {
    return { error: "Error: Select at least one well to print." };
  }
  return { ref, wells };
}

async function saveBulkGcodeCombined() {
  const validated = validateBulkExport();
  if (validated.error) {
    el.saveStatus.textContent = validated.error;
    return;
  }
  const { ref, wells } = validated;
  await saveGcodeFile(
    buildBulkCombinedGcode(wells),
    defaultBulkFileName(wells, ref.lowerZ)
  );
}

async function saveCircleGcode() {
  const params = collectCircleParams();
  const err = validateCircleParams(params);
  if (err) {
    el.saveStatus.textContent = err;
    return;
  }
  await saveGcodeFile(circleParamsToGcode(params), defaultCircleFileName(params));
}

async function saveBulkGcodeIndividual() {
  const validated = validateBulkExport();
  if (validated.error) {
    el.saveStatus.textContent = validated.error;
    return;
  }
  const { wells } = validated;
  const files = wells.map((wellKey) => {
    const params = collectBulkParamsForWell(wellKey);
    return {
      fileName: defaultFileNameForParams(params, ""),
      contents: paramsToGcode(params),
    };
  });

  const result = await window.gcodeApi.saveGcodeFiles({ files });
  if (result.cancelled) {
    el.saveStatus.textContent = "Save cancelled.";
    return;
  }
  const count = result.paths.length;
  const noun = count === 1 ? "file" : "files";
  el.saveStatus.textContent = `Saved ${count} ${noun} to ${result.dir}`;
}

function populateWells() {
  Object.keys(DEFAULT_24WELL_STARTS).forEach((well) => {
    const option = document.createElement("option");
    option.value = well;
    option.textContent = well;
    el.well.appendChild(option);
  });
  el.well.value = "A1";
}

function buildBulkWellGrid() {
  if (!el.bulkWellGrid) return;
  el.bulkWellGrid.innerHTML = "";
  ROW_KEYS.forEach((rowKey) => {
    COL_KEYS.forEach((colKey) => {
      const wellKey = `${rowKey}${colKey}`;
      const cell = document.createElement("div");
      cell.className = "bulk-well-cell";
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = wellKey;
      input.checked = wellKey === "A1";
      input.addEventListener("change", () => {
        updateBulkSelectionCount();
        drawPreview();
      });
      const text = document.createElement("span");
      text.textContent = wellKey;
      label.appendChild(input);
      label.appendChild(text);
      cell.appendChild(label);
      el.bulkWellGrid.appendChild(cell);
    });
  });
  updateBulkSelectionCount();
}

function initCirclePrint() {
  applyCircleDefaults(el.well.value);

  if (el.circleSnapCenter) {
    el.circleSnapCenter.addEventListener("click", () => {
      const [cx, cy] = getWellCenterMm(el.well.value);
      el.circleCenterX.value = cx.toFixed(2);
      el.circleCenterY.value = cy.toFixed(2);
      drawPreview();
    });
  }

  [
    el.circleCenterX,
    el.circleCenterY,
    el.circleDots,
    el.circleRadius,
    el.circleStartAngle,
  ].forEach((input) => {
    if (input) input.addEventListener("input", drawPreview);
  });

  [el.lowerZ, el.upperZ, el.extrusionE].forEach((input) => {
    input.addEventListener("input", () => {
      if (isCirclePrintEnabled()) drawPreview();
    });
  });

  if (el.saveCircle) {
    el.saveCircle.addEventListener("click", saveCircleGcode);
  }
}

function initBulkPrint() {
  buildBulkWellGrid();

  el.bulkSelectAll.addEventListener("click", () => setAllBulkWellsChecked(true));
  el.bulkSelectNone.addEventListener("click", () => setAllBulkWellsChecked(false));
  el.bulkSelectRef.addEventListener("click", () => {
    setAllBulkWellsChecked(false);
    setBulkWellChecked(el.well.value, true);
    updateBulkSelectionCount();
    drawPreview();
  });
  el.saveBulkCombined.addEventListener("click", saveBulkGcodeCombined);
  el.saveBulkIndividual.addEventListener("click", saveBulkGcodeIndividual);
  if (el.bulkDetailWell) {
    el.bulkDetailWell.addEventListener("change", drawPreview);
  }
}

function initMultiPrint() {
  setPrint2Defaults();
  updateModeUi();

  document.querySelectorAll('input[name="print-2-mode"]').forEach((input) => {
    input.addEventListener("change", () => {
      updateModeUi();
      drawPreview();
    });
  });

  el.previewTarget.addEventListener("change", drawPreview);

  el.p2AngleOffset.addEventListener("change", () => {
    updateModeUi();
    drawPreview();
  });
  [el.p2OffsetMin, el.p2OffsetMax].forEach((input) => {
    input.addEventListener("input", drawPreview);
  });
  el.p2OffsetSide.addEventListener("change", drawPreview);

  el.p2snap.addEventListener("click", () => {
    const [sx, sy] = startPositionForCenterDotAtWellCenter(
      el.well.value,
      safeInt(el.p2dots.value),
      safeInt(el.p2perRow.value),
      safeFloat(el.p2spacingX.value),
      safeFloat(el.p2spacingY.value)
    );
    el.p2startX.value = sx.toFixed(2);
    el.p2startY.value = sy.toFixed(2);
    drawPreview();
  });

  [el.p2dots, el.p2perRow, el.p2spacingX, el.p2spacingY, el.p2startX, el.p2startY].forEach((input) => {
    input.addEventListener("input", () => {
      syncPrint2Rows();
      drawPreview();
    });
  });

  [el.p2lowerZ, el.p2upperZ, el.p2extrusionE].forEach((input) => {
    input.addEventListener("input", drawPreview);
  });

  el.savePrint1.addEventListener("click", savePrint1Gcode);
  el.savePrint2.addEventListener("click", savePrint2Gcode);
  el.saveCombined.addEventListener("click", saveCombinedGcode);
}

function initTabs() {
  const tabButtons = document.querySelectorAll(".tab[data-tab]");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tabId = button.dataset.tab;
      tabButtons.forEach((btn) => {
        const isActive = btn === button;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-selected", isActive ? "true" : "false");
      });
      setAppMode(tabId);
    });
  });

  setAppMode(getAppMode());
}

populateWells();
document.body.dataset.appMode = "standard";
initMultiPrint();
initBulkPrint();
initCirclePrint();
setDefaultsFromCurrentWell();
initTabs();
updateEcalc();
drawPreview();

el.well.addEventListener("change", () => {
  el.wellNumber.value = el.well.value;
  if (isCirclePrintEnabled()) {
    applyCircleDefaults(el.well.value);
  } else {
    setDefaultsFromCurrentWell();
  }
  if (isSecondPassEnabled()) setPrint2Defaults();
  if (el.bulkRefWellLabel) el.bulkRefWellLabel.textContent = el.well.value;
  if (isBulkPrintEnabled()) {
    setBulkWellChecked(el.well.value, true);
    updateBulkSelectionCount();
  }
  drawPreview();
});
el.snap.addEventListener("click", () => {
  const [sx, sy] = startPositionForCenterDotAtWellCenter(
    el.well.value,
    safeInt(el.dots.value),
    safeInt(el.perRow.value),
    safeFloat(el.spacingX.value),
    safeFloat(el.spacingY.value)
  );
  el.startX.value = sx.toFixed(2);
  el.startY.value = sy.toFixed(2);
  drawPreview();
});
el.reset.addEventListener("click", () => {
  if (isCirclePrintEnabled()) {
    applyCircleDefaults(el.well.value);
  } else {
    setDefaultsFromCurrentWell();
  }
  setPrint2Defaults();
  const sameModeInput = document.querySelector('input[name="print-2-mode"][value="same"]');
  if (sameModeInput) sameModeInput.checked = true;
  el.p2AngleOffset.checked = false;
  el.p2OffsetMin.value = "0.1";
  el.p2OffsetMax.value = "1";
  el.p2OffsetSide.value = "positive";
  el.previewTarget.value = "both";
  setAllBulkWellsChecked(false);
  setBulkWellChecked(el.well.value, true);
  updateBulkSelectionCount();
  updateModeUi();
  drawPreview();
  el.saveStatus.textContent = "";
});
el.save.addEventListener("click", saveGcode);
el.ecalcToggle.addEventListener("click", () => {
  ecalcOpen = !ecalcOpen;
  el.ecalcPanel.style.display = ecalcOpen ? "flex" : "none";
  el.ecalcToggle.textContent = ecalcOpen ? "E-value calculator ▼" : "E-value calculator ▶";
  if (ecalcOpen) updateEcalc();
});

[el.dots, el.perRow, el.spacingX, el.spacingY, el.startX, el.startY].forEach((i) => {
  i.addEventListener("input", syncRowsAndPreview);
});
[el.ecalcCells, el.ecalcVolUl, el.ecalcNeedleRatio, el.ecalcTipMm].forEach((i) => {
  i.addEventListener("input", updateEcalc);
});

function findClosestDot(canvasEl, positions, clientX, clientY, hitRadius = 15) {
  const rect = canvasEl.getBoundingClientRect();
  const scaleX = canvasEl.width / rect.width;
  const scaleY = canvasEl.height / rect.height;
  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;
  let closest = null;
  let best = Number.POSITIVE_INFINITY;
  positions.forEach((d) => {
    const dist = Math.hypot(d.px - x, d.py - y);
    if (dist < hitRadius && dist < best) {
      best = dist;
      closest = d;
    }
  });
  return closest;
}

const COORD_LABEL_IDLE = "Hover over a dot to see coordinates";

function showDotCoordLabel(closest) {
  if (closest) {
    let printLabel = "Dot";
    if (closest.wellKey) printLabel = `Well ${closest.wellKey} dot`;
    else if (closest.printNum === "both") printLabel = "Multi-point site";
    else if (closest.printNum) printLabel = `Print ${closest.printNum} dot`;
    el.coordLabel.textContent = `${printLabel}: X = ${closest.absX.toFixed(3)} mm | Y = ${closest.absY.toFixed(3)} mm`;
  } else {
    el.coordLabel.textContent = COORD_LABEL_IDLE;
  }
}

function bindDotPreviewInteraction(canvasEl, getPositions, hitRadius = 15) {
  if (!canvasEl) return;

  const updateFromEvent = (event) => {
    const closest = findClosestDot(
      canvasEl,
      getPositions(),
      event.clientX,
      event.clientY,
      hitRadius
    );
    canvasEl.style.cursor = closest ? "pointer" : "crosshair";
    showDotCoordLabel(closest);
  };

  canvasEl.addEventListener("mousemove", updateFromEvent);
  canvasEl.addEventListener("mouseleave", () => {
    canvasEl.style.cursor = "";
    showDotCoordLabel(null);
  });
  canvasEl.addEventListener("click", updateFromEvent);
}

bindDotPreviewInteraction(el.canvas, () => dotPositions, 12);
bindDotPreviewInteraction(el.canvasStd, () => dotPositions, 15);
bindDotPreviewInteraction(el.canvasCircle, () => dotPositions, 15);
bindDotPreviewInteraction(el.bulkDetailCanvas, () => bulkDetailDotPositions, 15);
