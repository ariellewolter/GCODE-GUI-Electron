const GcodeCore = window.GcodeCore;

function showFatalStartupError(message, detail) {
  if (document.getElementById("startup-error")) return;
  const panel = document.createElement("div");
  panel.id = "startup-error";
  panel.style.cssText = "margin:16px;padding:16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;font:14px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;";
  const detailHtml = detail
    ? `<pre style="margin:8px 0 0;white-space:pre-wrap;font-size:12px">${detail}</pre>`
    : "";
  panel.innerHTML = `<strong>App failed to start.</strong><p style="margin:8px 0 0">${message}</p>${detailHtml}`;
  document.body.prepend(panel);
}

if (!GcodeCore || typeof GcodeCore.computeGridLayout !== "function") {
  showFatalStartupError(
    "Core module (GcodeCore) did not load.",
    window.GcodeCoreLoadError || ""
  );
  throw new Error("GcodeCore is not available");
}

const {
  WELL_BOTTOM_Z,
  DEFAULT_LOWER_Z_OFFSET,
  DEFAULT_UPPER_Z_OFFSET,
  DEFAULT_EXTRUSION,
  OVERLAP_TOLERANCE_MM,
  MAX_GRID_DOTS,
  MAX_GRID_ROWS,
  MAX_GRID_PER_ROW,
  DEFAULT_PLATE_TYPE,
  PLATE_TYPE_OPTIONS,
  getPlateType,
  getWellStarts,
  getWellCenters,
  getWellDiamMm,
  getWellRadiusMm,
  sortWellKeys,
  safeInt,
  safeFloat,
  parseEcalcFloat,
  parsePatternFloat,
  resolveParamsDots,
  countDotsOutsideWell,
  validateDotsInsideWell,
  computeGridDotsFromParams,
  getWellCenterMm,
  startPositionForCenterDotAtWellCenter,
  isDotInsideWellMm,
  applyProgressiveYOffset,
  computeCircleDots,
  translateStartForWell,
  validatePassSettings,
  validatePrintParams,
  validateCircleParams,
  passSettingsMatch,
  computeGridLayout,
  defaultFileNameForParams,
  defaultMultiPrintFileName,
  defaultBulkFileName,
  validateAngleOffsetValues,
  buildCombinedGcode: coreBuildCombinedGcode,
  buildCombinedMultiGcode,
  formatCoordMm,
  formatZMm,
  formatExtrusionE,
  formatGcodeXY,
} = GcodeCore;

function getCurrentPlateTypeId() {
  return el.plateType?.value || DEFAULT_PLATE_TYPE;
}

function getCurrentPlateType() {
  return getPlateType(getCurrentPlateTypeId());
}

function currentWellCenters() {
  return getWellCenters(getCurrentPlateTypeId());
}

function currentWellDiamMm() {
  return getWellDiamMm(getCurrentPlateTypeId());
}

const STEPS_PER_MM_ECALC = 10498.7;

const el = {
  plateType: document.getElementById("plate-type"),
  storedStartsPrint1: document.getElementById("stored-starts-print1"),
  storedStartsCircle: document.getElementById("stored-starts-circle"),
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
  ecalcConc: document.getElementById("ecalc-conc"),
  ecalcEVal: document.getElementById("ecalc-e-val"),
  ecalcStepsUl: document.getElementById("ecalc-steps-ul"),
  ecalcStepsInj: document.getElementById("ecalc-steps-inj"),
  extraPrintsContainer: document.getElementById("extra-prints-container"),
  addExtraPrint: document.getElementById("add-extra-print"),
  savePrint1: document.getElementById("save-print-1"),
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
  print1PatternNote: document.getElementById("print-1-pattern-note"),
  keepMultiPatternMetrics: document.getElementById("keep-multi-pattern-metrics"),
  ecalcApplyP1: document.getElementById("ecalc-apply-p1"),
  ecalcApplyExtra: document.getElementById("ecalc-apply-extra"),
  userIssueModal: document.getElementById("user-issue-modal"),
  userIssueModalTitle: document.getElementById("user-issue-modal-title"),
  userIssueModalBody: document.getElementById("user-issue-modal-body"),
  userIssueModalFocus: document.getElementById("user-issue-modal-focus"),
  userIssueModalDismiss: document.getElementById("user-issue-modal-dismiss"),
  userIssueModalBackdrop: document.getElementById("user-issue-modal-backdrop"),
};

const PRINT1_PASS_FIELDS = [
  { label: "Lower Z Offset", id: "lower-z" },
  { label: "Upper Z Offset", id: "upper-z" },
  { label: "Extrusion per dot (E)", id: "extrusion-e" },
];

function parseExtraPrintTarget(target) {
  if (target === "print1") return null;
  const match = /^print(\d+)$/.exec(target || "");
  return match ? Number(match[1]) : null;
}

function extraPassFields(printNum) {
  return [
    { label: `Print ${printNum} Lower Z`, id: `p${printNum}-lower-z` },
    { label: `Print ${printNum} Upper Z`, id: `p${printNum}-upper-z` },
    { label: `Print ${printNum} Extrusion (E)`, id: `p${printNum}-extrusion-e` },
  ];
}

function yOffsetFieldsForPrint(printNum) {
  return [
    { label: "First column Y offset", id: `p${printNum}-offset-min` },
    { label: "Last column Y offset", id: `p${printNum}-offset-max` },
    { label: "Y offset direction", id: `p${printNum}-offset-side` },
  ];
}

const GRID_PATTERN_FIELDS = [
  { label: "Start X", id: "start-x" },
  { label: "Start Y", id: "start-y" },
  { label: "Dots Per Row", id: "per-row" },
  { label: "Number of Rows", id: "rows" },
  { label: "Dot Spacing X", id: "spacing-x" },
  { label: "Dot Spacing Y", id: "spacing-y" },
];

let modalFocusTargetId = null;
let multiPatternLastWell = "A1";
let bulkPatternLastWell = "A1";
let standardPatternLastWell = "A1";
let circlePatternLastWell = "A1";

function createUserIssue({ id, title, message, fields = [], focusId = null, blocking = true }) {
  return {
    id,
    title,
    message,
    fields,
    focusId: focusId || fields[0]?.id || null,
    blocking,
  };
}

function renderUserIssueHtml(issue) {
  const badge = issue.blocking === false
    ? '<p class="user-issue-badge user-issue-badge-info">Heads up — you can still save/export</p>'
    : "";
  const fieldsHtml = issue.fields.length
    ? `<ul class="user-issue-fields">${issue.fields.map((f) => `<li><strong>${f.label}</strong></li>`).join("")}</ul>`
    : "";
  return `<div class="user-issue-block">${badge}<h4>${issue.title}</h4><p>${issue.message}</p>${fieldsHtml}</div>`;
}

function showUserIssuesModal(issues) {
  if (!issues.length || !el.userIssueModal) return;
  const hasBlocking = issues.some((issue) => issue.blocking !== false);
  el.userIssueModalTitle.textContent = hasBlocking ? "Cannot save G-code" : "Save notice";
  el.userIssueModalBody.innerHTML = issues.map(renderUserIssueHtml).join("");
  modalFocusTargetId = issues.find((issue) => issue.focusId)?.focusId || null;
  el.userIssueModalFocus.hidden = !modalFocusTargetId;
  el.userIssueModal.hidden = false;
}

function hideUserIssueModal() {
  if (!el.userIssueModal) return;
  el.userIssueModal.hidden = true;
  modalFocusTargetId = null;
}

function focusIssueField(fieldId) {
  const node = fieldId ? document.getElementById(fieldId) : null;
  if (!node) return;
  node.focus();
  node.scrollIntoView({ block: "center", behavior: "smooth" });
}

function reportSaveFailure(issues, shortMessage) {
  const list = Array.isArray(issues) ? issues : [issues];
  el.saveStatus.textContent = shortMessage || list[0]?.message || "Save blocked.";
  showUserIssuesModal(list);
}

function collectBulkWellOutsideFailures(wells) {
  const failing = [];
  wells.forEach((wellKey) => {
    const params = collectBulkParamsForWell(wellKey);
    const wellErr = validateDotsInsideWell(params, wellKey);
    if (wellErr) failing.push({ wellKey, wellErr });
  });
  return failing;
}

function issuesForBulkWellOutsideFailures(failing) {
  if (!failing.length) return [];
  if (failing.length === 1) {
    const { wellKey, wellErr } = failing[0];
    return [createUserIssue({
      id: `BULK_OUTSIDE_${wellKey}`,
      title: `Well ${wellKey}: dots outside well`,
      message: `${wellErr} Adjust the reference pattern or choose different wells.`,
      fields: GRID_PATTERN_FIELDS,
      focusId: "start-x",
    })];
  }
  return [createUserIssue({
    id: "BULK_OUTSIDE_MULTI",
    title: `${failing.length} wells have dots outside`,
    message: failing.map(({ wellKey, wellErr }) => `${wellErr.replace("Error: ", "")} (${wellKey})`).join(" "),
    fields: GRID_PATTERN_FIELDS,
    focusId: "start-x",
  })];
}

function issueForPassSettings(err, target) {
  const printNum = parseExtraPrintTarget(target);
  if (printNum) {
    return createUserIssue({
      id: `PASS${printNum}_SETTINGS`,
      title: `Print ${printNum} pass settings incomplete`,
      message: `${err} Enter values in the fields below before saving.`,
      fields: extraPassFields(printNum),
      focusId: `p${printNum}-lower-z`,
    });
  }
  return createUserIssue({
    id: "PASS1_SETTINGS",
    title: "Pass settings incomplete",
    message: `${err} Enter values in the fields below before saving.`,
    fields: PRINT1_PASS_FIELDS,
    focusId: "lower-z",
  });
}

function issueForAngleOffset(err, printNum = 2) {
  return createUserIssue({
    id: `Y_OFFSET_INVALID_${printNum}`,
    title: "Y offset settings need attention",
    message: `${err} Print ${printNum} preview and export both require valid first/last column Y offset values when Y offset is enabled.`,
    fields: yOffsetFieldsForPrint(printNum),
    focusId: `p${printNum}-offset-min`,
  });
}

function issueForDotsOutside(err, fields, focusId = "start-x") {
  return createUserIssue({
    id: "DOTS_OUTSIDE_WELL",
    title: "Dots fall outside the well",
    message: `${err} Move the pattern, reduce spacing, or shrink the circle so every dot stays inside the well circle.`,
    fields,
    focusId,
  });
}

function issueForValidationError(err, context = {}) {
  if (!err) return null;
  if (err.includes("Lower Z") || err.includes("Upper Z") || err.includes("Extrusion")) {
    const passTarget = context.passTarget
      || (context.printNum ? `print${context.printNum}` : "print1");
    return issueForPassSettings(err, passTarget);
  }
  if (err.includes("Y offset")) {
    return issueForAngleOffset(err, context.printNum || 2);
  }
  if (err.includes("outside well")) {
    const fields = context.circle
      ? [
        { label: "Circle center X", id: "circle-center-x" },
        { label: "Circle center Y", id: "circle-center-y" },
        { label: "Circle radius", id: "circle-radius" },
      ]
      : (context.printNum
        ? [
          { label: `Print ${context.printNum} Start X`, id: `p${context.printNum}-start-x` },
          { label: `Print ${context.printNum} Start Y`, id: `p${context.printNum}-start-y` },
          ...GRID_PATTERN_FIELDS.slice(2),
        ]
        : GRID_PATTERN_FIELDS);
    return issueForDotsOutside(err, fields, context.focusId);
  }
  if (err.includes("Radius exceeds")) {
    return createUserIssue({
      id: "CIRCLE_RADIUS",
      title: "Circle too large for well",
      message: `${err} Reduce the circle radius or move the center.`,
      fields: [{ label: "Circle radius", id: "circle-radius" }],
      focusId: "circle-radius",
    });
  }
  if (err.includes("Select at least one well")) {
    return createUserIssue({
      id: "BULK_NO_WELLS",
      title: "No wells selected",
      message: "Check at least one well in the bulk well grid before saving.",
      fields: [{ label: "Wells to print", id: "bulk-well-grid" }],
      focusId: null,
    });
  }
  return createUserIssue({
    id: "VALIDATION",
    title: "Settings need attention",
    message: err,
    fields: context.fields || GRID_PATTERN_FIELDS,
    focusId: context.focusId || "start-x",
  });
}

function initUserIssueModal() {
  if (!el.userIssueModal) return;
  el.userIssueModalDismiss.addEventListener("click", hideUserIssueModal);
  el.userIssueModalBackdrop.addEventListener("click", hideUserIssueModal);
  el.userIssueModalFocus.addEventListener("click", () => {
    hideUserIssueModal();
    focusIssueField(modalFocusTargetId);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && el.userIssueModal && !el.userIssueModal.hidden) {
      hideUserIssueModal();
    }
  });
}

const PRINT1_DOT_COLOR = "#2196F3";
const PRINT2_DOT_COLOR = "#9333EA";
const OVERLAP_DOT_COLOR = "#E65100";
const OUTSIDE_WELL_DOT_COLOR = "#DC2626";
const PRINT1_TOOLPATH_COLOR = "rgba(156, 163, 175, 0.6)";
const PRINT2_TOOLPATH_COLOR = "rgba(147, 51, 234, 0.55)";

let dotPositions = [];
let bulkDetailDotPositions = [];
let ecalcOpen = true;

const ExtraPrintUI = window.ExtraPrintUI;

function extraPrintGetMode(printNum) {
  return ExtraPrintUI?.getMode?.(printNum) || "same";
}

function extraPrintIsOffsetEnabled(printNum) {
  return Boolean(ExtraPrintUI?.isOffsetEnabled?.(printNum));
}

function extraPrintFieldTarget(printNum) {
  return ExtraPrintUI?.fieldTarget?.(printNum) || null;
}

function extraPrintIsPassCustomized(printNum) {
  return Boolean(ExtraPrintUI?.isPassCustomized?.(printNum));
}

function validatePassSettingsSafe(fields) {
  if (!fields?.lowerZ || !fields?.upperZ || !fields?.extrusionE) {
    return "Error: Lower Z, Upper Z, and Extrusion (E) are required.";
  }
  return validatePassSettings(fields);
}

const EXTRA_PASS_PALETTE = [
  { dot: "#9333EA", toolpath: "rgba(147, 51, 234, 0.55)" },
  { dot: "#ea580c", toolpath: "rgba(234, 88, 12, 0.55)" },
  { dot: "#0891b2", toolpath: "rgba(8, 145, 178, 0.55)" },
  { dot: "#be185d", toolpath: "rgba(190, 24, 93, 0.55)" },
  { dot: "#65a30d", toolpath: "rgba(101, 163, 13, 0.55)" },
  { dot: "#7c3aed", toolpath: "rgba(124, 58, 237, 0.55)" },
  { dot: "#0d9488", toolpath: "rgba(13, 148, 136, 0.55)" },
  { dot: "#c026d3", toolpath: "rgba(192, 38, 211, 0.55)" },
  { dot: "#ca8a04", toolpath: "rgba(202, 138, 4, 0.55)" },
];

function extraPassColors(printNum) {
  const idx = Math.max(0, printNum - 2);
  return EXTRA_PASS_PALETTE[idx % EXTRA_PASS_PALETTE.length];
}

function getExtraPassList() {
  return ExtraPrintUI?.getPassList?.() || [2];
}

function print2FieldTarget() {
  return ExtraPrintUI?.fieldTarget?.(2) || {};
}

function getPrint2Mode() {
  return ExtraPrintUI?.getMode?.(2) || "same";
}

function isPrint2OffsetMode() {
  return isSecondPassEnabled() && ExtraPrintUI?.isOffsetEnabled?.(2);
}

function setPreviewMeta(text) {
  const passWarn = getActivePassPreviewWarning();
  const full = passWarn ? `${text} | ${passWarn}` : text;
  if (el.previewMeta) el.previewMeta.textContent = full;
  if (el.previewMetaSingle) el.previewMetaSingle.textContent = full;
  if (el.previewMetaCircle) el.previewMetaCircle.textContent = full;
}

function getActivePassPreviewWarning() {
  if (validatePassSettings(print1FieldTarget())) {
    return "Pass settings incomplete";
  }
  if (!isSecondPassEnabled() || !ExtraPrintUI) return "";
  for (const printNum of getExtraPassList()) {
    const fields = extraPrintFieldTarget(printNum);
    if (validatePassSettingsSafe(fields)) {
      return `Print ${printNum} pass settings incomplete`;
    }
    if (extraPrintIsOffsetEnabled(printNum) && validateAngleOffsetFor(printNum)) {
      return `Print ${printNum} Y offset settings incomplete`;
    }
  }
  return "";
}

function getBulkDetailWellKey() {
  const selected = getSelectedBulkWells();
  const ref = el.well.value;
  const available = [...new Set([ref, ...selected].filter(Boolean))];
  const pick = el.bulkDetailWell?.value;
  if (pick && available.includes(pick)) return pick;
  if (ref && available.includes(ref)) return ref;
  return selected[0] || ref;
}

function syncBulkDetailWellOptions() {
  if (!el.bulkDetailWell) return;
  const selected = getSelectedBulkWells();
  const ref = el.well.value;
  const wells = [...new Set([ref, ...selected].filter(Boolean))];
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

function syncWellNumberFromDropdown() {
  if (el.wellNumber && el.well) {
    el.wellNumber.value = el.well.value;
  }
}

function outsideWellMetaNote(positions) {
  const count = positions.filter((dot) => dot.outsideWell).length;
  return count > 0 ? ` | ${count} outside well` : "";
}

function formatStoredStartOption(wellKey, x, y) {
  return `${wellKey} — X ${formatCoordMm(x)}, Y ${formatCoordMm(y)}`;
}

function populateStoredStartsSelect(selectEl, plateTypeId = getCurrentPlateTypeId()) {
  if (!selectEl) return;
  const starts = getWellStarts(plateTypeId);
  const prev = selectEl.value;
  selectEl.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select stored start…";
  selectEl.appendChild(placeholder);
  sortWellKeys(Object.keys(starts), plateTypeId).forEach((wellKey) => {
    const [x, y] = starts[wellKey];
    const option = document.createElement("option");
    option.value = wellKey;
    option.textContent = formatStoredStartOption(wellKey, x, y);
    selectEl.appendChild(option);
  });
  if (prev && starts[prev]) {
    selectEl.value = prev;
  } else {
    selectEl.value = "";
  }
}

function applyStoredStartToTarget(wellKey, target, { applyCenter = false } = {}) {
  if (!target || !wellKey) return;
  const plateTypeId = getCurrentPlateTypeId();
  const [x, y] = applyCenter
    ? getWellCenterMm(wellKey, plateTypeId)
    : (getWellStarts(plateTypeId)[wellKey] || getWellStarts(plateTypeId).A1);
  if (target.startX) target.startX.value = x.toFixed(2);
  if (target.startY) target.startY.value = y.toFixed(2);
  if (target.centerX) target.centerX.value = x.toFixed(2);
  if (target.centerY) target.centerY.value = y.toFixed(2);
}

function syncStoredStartsPicker(selectEl, wellKey) {
  if (!selectEl || !wellKey) return;
  const option = [...selectEl.options].find((entry) => entry.value === wellKey);
  selectEl.value = option ? wellKey : "";
}

function syncStoredStartsPickersForWell(wellKey = el.well?.value) {
  if (!wellKey) return;
  syncStoredStartsPicker(el.storedStartsPrint1, wellKey);
  syncStoredStartsPicker(el.storedStartsCircle, wellKey);
  getExtraPassList().forEach((printNum) => {
    syncStoredStartsPicker(document.getElementById(`p${printNum}-stored-starts`), wellKey);
  });
}

function bindStoredStartsSelect(selectEl, getTarget, { applyCenter = false, onApply } = {}) {
  if (!selectEl || selectEl.dataset.boundStoredStarts) return;
  selectEl.dataset.boundStoredStarts = "1";
  selectEl.addEventListener("change", () => {
    const wellKey = selectEl.value;
    if (!wellKey) return;
    applyStoredStartToTarget(wellKey, getTarget(), { applyCenter });
    onApply?.(wellKey);
    drawPreview();
  });
}

function setupExtraPassStoredStarts(printNum) {
  const selectEl = document.getElementById(`p${printNum}-stored-starts`);
  populateStoredStartsSelect(selectEl);
  bindStoredStartsSelect(selectEl, () => extraPrintFieldTarget(printNum), {
    onApply: () => ExtraPrintUI?.setPassCustomized?.(printNum),
  });
  syncStoredStartsPicker(selectEl, el.well?.value);
}

function refreshAllStoredStartsDropdowns(plateTypeId = getCurrentPlateTypeId()) {
  populateStoredStartsSelect(el.storedStartsPrint1, plateTypeId);
  populateStoredStartsSelect(el.storedStartsCircle, plateTypeId);
  syncStoredStartsPickersForWell(el.well?.value);
  if (ExtraPrintUI) {
    getExtraPassList().forEach((printNum) => setupExtraPassStoredStarts(printNum));
  }
}

function initStoredStartsDropdowns() {
  bindStoredStartsSelect(el.storedStartsPrint1, print1FieldTarget);
  bindStoredStartsSelect(el.storedStartsCircle, () => ({
    centerX: el.circleCenterX,
    centerY: el.circleCenterY,
  }), { applyCenter: true });
  refreshAllStoredStartsDropdowns();
}

function isPrint1FieldTarget(target) {
  return Boolean(target?.startX && target.startX === el.startX);
}

function applyWellDefaults(target, wellKey, plateTypeId = getCurrentPlateTypeId()) {
  target.perRow.value = "10";
  target.rows.value = "3";
  syncGridDotsFromLayout(target.dots, target.perRow, target.rows);
  target.spacingX.value = "0.3";
  target.spacingY.value = "1.5";
  target.lowerZ.value = DEFAULT_LOWER_Z_OFFSET.toFixed(2);
  target.upperZ.value = DEFAULT_UPPER_Z_OFFSET.toFixed(2);
  target.extrusionE.value = DEFAULT_EXTRUSION.toFixed(4);
  syncWellNumberFromDropdown();

  const starts = getWellStarts(plateTypeId);
  const [cx, cy] = starts[wellKey] || starts.A1;
  if (target.startX) target.startX.value = cx.toFixed(2);
  if (target.startY) target.startY.value = cy.toFixed(2);
  if (isPrint1FieldTarget(target)) {
    syncStoredStartsPickersForWell(wellKey);
  }
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
    extrusionE: el.extrusionE,
  };
}

function copyPrint1PatternToFields(target) {
  const print1 = print1FieldTarget();
  if (!target?.startX || !print1.startX) return;
  target.startX.value = print1.startX.value;
  target.startY.value = print1.startY.value;
  target.dots.value = print1.dots.value;
  target.perRow.value = print1.perRow.value;
  target.rows.value = print1.rows.value;
  target.spacingX.value = print1.spacingX.value;
  target.spacingY.value = print1.spacingY.value;
  if (target.dots && target.perRow && target.rows) {
    syncGridDotsFromLayout(target.dots, target.perRow, target.rows);
  }
}

function copyPrint1PatternToExtraPass(printNum) {
  const fields = extraPrintFieldTarget(printNum);
  copyPrint1PatternToFields(fields);
}

function setDefaultsFromCurrentWell(plateTypeId = getCurrentPlateTypeId()) {
  applyWellDefaults(print1FieldTarget(), el.well.value, plateTypeId);
}

function setExtraPrintDefaults(printNum) {
  const fields = extraPrintFieldTarget(printNum);
  if (!fields?.startX) return;
  copyPrint1PatternToExtraPass(printNum);
  ExtraPrintUI?.clearPassCustomized?.(printNum);
  syncExtraPrintPassFromPrint1(printNum);
  syncStoredStartsPicker(document.getElementById(`p${printNum}-stored-starts`), el.well?.value);
}

function setAllExtraPrintDefaults() {
  getExtraPassList().forEach((n) => setExtraPrintDefaults(n));
}

function setPrint2Defaults() {
  setExtraPrintDefaults(2);
}

function isKeepMultiPatternMetricsEnabled() {
  return isSecondPassEnabled() && Boolean(el.keepMultiPatternMetrics?.checked);
}

function translatePatternStartForWellChange(fields, fromWell, toWell) {
  if (!fields?.startX || !fields?.startY) return;
  const startX = parsePatternFloat(fields.startX.value);
  const startY = parsePatternFloat(fields.startY.value);
  const plateTypeId = getCurrentPlateTypeId();
  const [sx, sy] = translateStartForWell(fromWell, toWell, startX, startY, plateTypeId);
  fields.startX.value = sx.toFixed(2);
  fields.startY.value = sy.toFixed(2);
}

function applyMultiPatternMetricsWellChange(fromWell, toWell) {
  translatePatternStartForWellChange(print1FieldTarget(), fromWell, toWell);
  syncGridDotsFromLayout(el.dots, el.perRow, el.rows);

  getExtraPassList().forEach((printNum) => {
    const fields = extraPrintFieldTarget(printNum);
    if (!fields) return;
    const offsetOn = extraPrintIsOffsetEnabled(printNum);
    const different = extraPrintGetMode(printNum) === "different";
    if (!offsetOn && different) {
      translatePatternStartForWellChange(fields, fromWell, toWell);
      if (fields.dots && fields.perRow && fields.rows) {
        syncGridDotsFromLayout(fields.dots, fields.perRow, fields.rows);
      }
    }
  });
}

function onBulkPatternWellChange(newWellKey) {
  if (bulkPatternLastWell && bulkPatternLastWell !== newWellKey) {
    translatePatternStartForWellChange(print1FieldTarget(), bulkPatternLastWell, newWellKey);
    syncGridDotsFromLayout(el.dots, el.perRow, el.rows);
  }
  bulkPatternLastWell = newWellKey;
}

function onStandardPatternWellChange(newWellKey) {
  if (standardPatternLastWell && standardPatternLastWell !== newWellKey) {
    translatePatternStartForWellChange(print1FieldTarget(), standardPatternLastWell, newWellKey);
    syncGridDotsFromLayout(el.dots, el.perRow, el.rows);
  }
  standardPatternLastWell = newWellKey;
}

function onMultiPatternWellChange(newWellKey) {
  if (!isKeepMultiPatternMetricsEnabled()) {
    setDefaultsFromCurrentWell();
    if (isSecondPassEnabled() && ExtraPrintUI) {
      getExtraPassList().forEach((printNum) => {
        ExtraPrintUI.resetModeToSame(printNum);
        setExtraPrintDefaults(printNum);
      });
    }
    multiPatternLastWell = newWellKey;
    return;
  }
  if (multiPatternLastWell && multiPatternLastWell !== newWellKey) {
    applyMultiPatternMetricsWellChange(multiPatternLastWell, newWellKey);
  }
  multiPatternLastWell = newWellKey;
}

function syncExtraPrintPassFromPrint1(printNum) {
  const fields = extraPrintFieldTarget(printNum);
  if (!fields?.lowerZ) return;
  fields.lowerZ.value = el.lowerZ.value;
  fields.upperZ.value = el.upperZ.value;
  fields.extrusionE.value = el.extrusionE.value;
}

function applyExtraPrintPassSettings(params, printNum) {
  const fields = extraPrintFieldTarget(printNum);
  if (!fields?.lowerZ) return params;
  return GcodeCore.applyPrint2PassSettings(params, {
    lowerZ: fields.lowerZ.value,
    upperZ: fields.upperZ.value,
    extrusionE: fields.extrusionE.value,
  });
}

function applyPrint2PassSettings(params) {
  return applyExtraPrintPassSettings(params, 2);
}

function getMultiPrintFileNameOptions(printNum = null) {
  const fileNameOptionsForPass = (n) => {
    const offset = getAngleOffsetSettingsFor(n);
    return {
      yOffsetEnabled: offset.enabled && offset.valid,
      yOffsetMin: offset.valid ? offset.minParsed : null,
      yOffsetMax: offset.valid ? offset.maxParsed : null,
      yOffsetNegative: offset.sign < 0,
      print2PatternMode: extraPrintGetMode(n),
    };
  };

  if (printNum != null) return fileNameOptionsForPass(printNum);

  const passes = getExtraPassList();
  for (let i = passes.length - 1; i >= 0; i -= 1) {
    const offset = getAngleOffsetSettingsFor(passes[i]);
    if (offset.enabled && offset.valid) return fileNameOptionsForPass(passes[i]);
  }
  for (let i = passes.length - 1; i >= 0; i -= 1) {
    if (extraPrintGetMode(passes[i]) === "different") {
      return fileNameOptionsForPass(passes[i]);
    }
  }
  return fileNameOptionsForPass(passes[0] || 2);
}

function buildCombinedMultiPrintFileNameSuffix() {
  const tags = getExtraPassList().map((n) => {
    const offset = getAngleOffsetSettingsFor(n);
    if (offset.enabled && offset.valid) {
      const range = `${formatCoordMm(offset.minParsed)}-${formatCoordMm(offset.maxParsed)}`;
      return `p${n}yOff${range}${offset.sign < 0 ? "neg" : ""}`;
    }
    return extraPrintGetMode(n) === "different" ? `p${n}diff` : `p${n}same`;
  });
  return tags.length ? `_${tags.join("_")}` : "";
}

function defaultCombinedMultiPrintSaveFileName(params, passCount) {
  return `well_${params.wellNumber}_Z${formatZMm(params.lowerZ)}_${passCount}pass${buildCombinedMultiPrintFileNameSuffix()}.txt`;
}

function defaultMultiPrintSaveFileName(params, passSuffix, printNum = null) {
  const resolvedPrintNum = printNum ?? (() => {
    const match = /_print(\d+)$/.exec(passSuffix || "");
    return match ? Number(match[1]) : null;
  })();
  return defaultMultiPrintFileName(
    params,
    passSuffix,
    getMultiPrintFileNameOptions(resolvedPrintNum)
  );
}

function prepareExportState() {
  syncWellNumberFromDropdown();
  if (isCirclePrintEnabled()) return;
  syncGridDotsFromLayout(el.dots, el.perRow, el.rows);
  if (isSecondPassEnabled() && ExtraPrintUI) {
    getExtraPassList().forEach((printNum) => {
      if (extraPrintGetMode(printNum) === "different" && !extraPrintIsOffsetEnabled(printNum)) {
        const fields = extraPrintFieldTarget(printNum);
        if (fields?.dots && fields?.perRow && fields?.rows) {
          syncGridDotsFromLayout(fields.dots, fields.perRow, fields.rows);
        }
      }
    });
  }
}

function readPassFieldValues(fields) {
  return {
    lowerZ: parseEcalcFloat(fields.lowerZ.value),
    upperZ: parseEcalcFloat(fields.upperZ.value),
    extrusionE: parseEcalcFloat(fields.extrusionE.value),
  };
}

function collectPrintParams(fields) {
  const pass = readPassFieldValues(fields);
  return {
    well: fields.well.value,
    wellNumber: fields.well.value,
    plateTypeId: getCurrentPlateTypeId(),
    startX: parsePatternFloat(fields.startX.value),
    startY: parsePatternFloat(fields.startY.value),
    numDots: safeInt(fields.dots.value),
    perRow: safeInt(fields.perRow.value),
    spacingX: parsePatternFloat(fields.spacingX.value),
    spacingY: parsePatternFloat(fields.spacingY.value),
    lowerZ: pass.lowerZ,
    upperZ: pass.upperZ,
    extrusionE: pass.extrusionE,
    annotate: el.annotate.checked,
  };
}

function collectPrint1Params() {
  return collectPrintParams(print1FieldTarget());
}

function collectExtraPrintPatternParams(printNum) {
  const fields = extraPrintFieldTarget(printNum);
  const print1 = collectPrint1Params();
  if (!fields?.startX) return { ...print1 };
  const pass = readPassFieldValues(fields);
  return {
    well: print1.well,
    wellNumber: print1.wellNumber,
    plateTypeId: print1.plateTypeId,
    startX: parsePatternFloat(fields.startX.value),
    startY: parsePatternFloat(fields.startY.value),
    numDots: safeInt(fields.dots.value),
    perRow: safeInt(fields.perRow.value),
    spacingX: parsePatternFloat(fields.spacingX.value),
    spacingY: parsePatternFloat(fields.spacingY.value),
    lowerZ: pass.lowerZ,
    upperZ: pass.upperZ,
    extrusionE: pass.extrusionE,
    annotate: el.annotate.checked,
  };
}

function getAngleOffsetSettingsFor(printNum) {
  const fields = extraPrintFieldTarget(printNum);
  if (!fields) {
    return {
      enabled: false,
      min: 0,
      max: 0,
      minParsed: null,
      maxParsed: null,
      valid: false,
      sign: 1,
    };
  }
  const min = parseEcalcFloat(fields.offsetMin?.value);
  const max = parseEcalcFloat(fields.offsetMax?.value);
  const valid = validateAngleOffsetValues(min, max) === null;
  return {
    enabled: extraPrintIsOffsetEnabled(printNum),
    min: valid ? min : 0,
    max: valid ? max : 0,
    minParsed: min,
    maxParsed: max,
    valid,
    sign: fields.offsetSide?.value === "negative" ? -1 : 1,
  };
}

function getAngleOffsetSettings() {
  return getAngleOffsetSettingsFor(2);
}

function buildAngledPrintDots(printNum, printParams) {
  const settings = getAngleOffsetSettingsFor(printNum);
  if (!settings.valid) return null;

  const print1 = collectPrint1Params();
  const print1Dots = computeGridDotsFromParams(print1);
  if (!print1Dots.length) return computeGridDotsFromParams(printParams);

  const baseDots = print1Dots.map((dot) => ({ ...dot }));
  const { min, max, sign } = settings;
  const perRow = printParams.perRow > 0 ? printParams.perRow : print1.perRow;
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

function isSimulatorEnabled() {
  return getAppMode() === "simulator";
}

let lastSimulatorSourceMode = "standard";

function setCircleCenterToWell(wellKey, plateTypeId = getCurrentPlateTypeId()) {
  const [cx, cy] = getWellCenterMm(wellKey, plateTypeId);
  if (el.circleCenterX) el.circleCenterX.value = cx.toFixed(2);
  if (el.circleCenterY) el.circleCenterY.value = cy.toFixed(2);
}

function translateCircleCenterForWellChange(fromWell, toWell) {
  if (!el.circleCenterX || !el.circleCenterY) return;
  const centerX = parsePatternFloat(el.circleCenterX.value);
  const centerY = parsePatternFloat(el.circleCenterY.value);
  const plateTypeId = getCurrentPlateTypeId();
  const [sx, sy] = translateStartForWell(fromWell, toWell, centerX, centerY, plateTypeId);
  el.circleCenterX.value = sx.toFixed(2);
  el.circleCenterY.value = sy.toFixed(2);
}

function onCirclePatternWellChange(newWellKey) {
  if (circlePatternLastWell && circlePatternLastWell !== newWellKey) {
    translateCircleCenterForWellChange(circlePatternLastWell, newWellKey);
  } else {
    setCircleCenterToWell(newWellKey);
  }
  circlePatternLastWell = newWellKey;
  syncWellNumberFromDropdown();
}

function applyCircleDefaults(wellKey) {
  setCircleCenterToWell(wellKey);
  if (el.circleDots) el.circleDots.value = "12";
  if (el.circleRadius) el.circleRadius.value = "3";
  if (el.circleStartAngle) el.circleStartAngle.value = "0";
  syncWellNumberFromDropdown();
  el.lowerZ.value = DEFAULT_LOWER_Z_OFFSET.toFixed(2);
  el.upperZ.value = DEFAULT_UPPER_Z_OFFSET.toFixed(2);
  el.extrusionE.value = DEFAULT_EXTRUSION.toFixed(4);
  circlePatternLastWell = wellKey;
  syncStoredStartsPicker(el.storedStartsCircle, wellKey);
}

function collectCircleParams() {
  const well = el.well.value;
  const centerX = parsePatternFloat(el.circleCenterX.value);
  const centerY = parsePatternFloat(el.circleCenterY.value);
  const numDots = safeInt(el.circleDots.value);
  const radiusMm = parsePatternFloat(el.circleRadius.value);
  const startAngleDeg = parsePatternFloat(el.circleStartAngle.value);
  const customDots = computeCircleDots(centerX, centerY, radiusMm, numDots, startAngleDeg);
  const pass = readPassFieldValues(print1FieldTarget());
  return {
    well,
    wellNumber: well,
    plateTypeId: getCurrentPlateTypeId(),
    centerX,
    centerY,
    numDots,
    radiusMm,
    startAngleDeg,
    lowerZ: pass.lowerZ,
    upperZ: pass.upperZ,
    extrusionE: pass.extrusionE,
    annotate: el.annotate.checked,
    customDots,
  };
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
  return `well_${params.wellNumber}_circle_R${formatCoordMm(params.radiusMm)}_Z${formatZMm(params.lowerZ)}.txt`;
}

function collectBulkParamsForWell(wellKey) {
  const base = collectPrint1Params();
  const [startX, startY] = translateStartForWell(
    base.well,
    wellKey,
    base.startX,
    base.startY,
    base.plateTypeId
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
  const plateTypeId = getCurrentPlateTypeId();
  return sortWellKeys(
    [...el.bulkWellGrid.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value),
    plateTypeId
  );
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
  const centers = Object.values(currentWellCenters());
  const wellDiamMm = currentWellDiamMm();
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
  const pad = wellDiamMm / 2;
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

function setAppMode(tabId) {
  if (tabId !== "simulator") {
    lastSimulatorSourceMode = tabId;
    const sourceSelect = document.getElementById("simulator-source-mode");
    if (sourceSelect) sourceSelect.value = tabId;
  }
  if (tabId === "simulator") {
    window.GcodeMotionSimulator?.pause();
    requestAnimationFrame(() => window.GcodeMotionSimulator?.setPlateType());
  }
  document.body.dataset.appMode = tabId;
  const currentWell = el.well.value;
  if (tabId === "bulk-print") {
    bulkPatternLastWell = currentWell;
  } else if (tabId === "standard") {
    standardPatternLastWell = currentWell;
  } else if (tabId === "multi-print") {
    if (ExtraPrintUI) {
      getExtraPassList().forEach((printNum) => {
        if (!extraPrintIsPassCustomized(printNum)) {
          syncExtraPrintPassFromPrint1(printNum);
        }
      });
    }
    multiPatternLastWell = currentWell;
  } else if (tabId === "circle-print") {
    if (circlePatternLastWell && circlePatternLastWell !== currentWell) {
      translateCircleCenterForWellChange(circlePatternLastWell, currentWell);
    }
    circlePatternLastWell = currentWell;
  }
  updateModeUi();
  drawPreview();
}

function currentJobGcodeForSimulator(mode = lastSimulatorSourceMode) {
  if (mode === "multi-print") return buildCombinedGcodeAllPasses();
  if (mode === "bulk-print") {
    const wells = getSelectedBulkWells();
    return wells.length ? buildBulkCombinedGcode(wells) : paramsToGcode(collectPrint1Params());
  }
  if (mode === "circle-print") return circleParamsToGcode(collectCircleParams());
  return paramsToGcode(collectPrint1Params());
}

function simulateCurrentMotion(mode = getAppMode()) {
  const sourceMode = mode === "simulator" ? lastSimulatorSourceMode : mode;
  const gcode = currentJobGcodeForSimulator(sourceMode);
  const simulatorTab = document.querySelector('.tab[data-tab="simulator"]');
  simulatorTab?.click();
  window.GcodeMotionSimulator?.loadGcode(gcode, {
    sourceLabel: `${sourceMode.replaceAll("-", " ")} settings`,
  });
}

function collectExtraPrintParams(printNum) {
  if (!isSecondPassEnabled() || !ExtraPrintUI) return null;

  const offsetOn = extraPrintIsOffsetEnabled(printNum);
  const mode = extraPrintGetMode(printNum);
  let params;
  if (offsetOn) {
    params = collectPrint1Params();
  } else if (mode === "same") {
    params = collectPrint1Params();
  } else {
    params = collectExtraPrintPatternParams(printNum);
  }

  params = applyExtraPrintPassSettings(params, printNum);

  if (offsetOn) {
    const customDots = buildAngledPrintDots(printNum, params);
    if (!customDots) {
      return { ...params, offsetInvalid: true, customDots: null };
    }
    return {
      ...params,
      numDots: customDots.length,
      customDots,
    };
  }
  return params;
}

function collectPrint2Params() {
  return collectExtraPrintParams(2);
}

function collectAllExtraPrintParams() {
  if (!ExtraPrintUI) return [];
  return getExtraPassList()
    .map((printNum) => ({
      printNum,
      params: collectExtraPrintParams(printNum),
      sameMode: extraPrintGetMode(printNum) === "same",
    }))
    .filter((entry) => entry.params && !entry.params.offsetInvalid);
}

function validateAngleOffsetFor(printNum) {
  if (!isSecondPassEnabled() || !extraPrintIsOffsetEnabled(printNum)) return null;
  const fields = extraPrintFieldTarget(printNum);
  if (!fields) {
    return "Error: First- and last-column Y offsets are required when Y offset is enabled.";
  }
  return validateAngleOffsetValues(
    parseEcalcFloat(fields.offsetMin?.value),
    parseEcalcFloat(fields.offsetMax?.value)
  );
}

function validateAngleOffset() {
  return validateAngleOffsetFor(2);
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
  return coreBuildCombinedGcode(print1, print2, sameMode, paramsToGcode);
}

function buildCombinedGcodeAllPasses() {
  const print1 = collectPrint1Params();
  const extras = collectAllExtraPrintParams().map((entry) => ({
    params: entry.params,
    sameMode: entry.sameMode,
    passNum: entry.printNum,
  }));
  return buildCombinedMultiGcode(print1, extras, paramsToGcode);
}

function updateModeUi() {
  const multi = isSecondPassEnabled();
  const bulk = isBulkPrintEnabled();
  const circle = isCirclePrintEnabled();

  if (el.print1PatternNote) el.print1PatternNote.hidden = !multi;
  if (multi && ExtraPrintUI) {
    ExtraPrintUI.updateAllCardVisibility();
    ExtraPrintUI.syncPreviewTargetOptions(el.previewTarget);
  }

  el.save.hidden = multi || bulk || circle;
  el.savePrint1.hidden = !multi;
  el.saveCombined.hidden = !multi;
  if (el.saveBulkCombined) el.saveBulkCombined.hidden = !bulk;
  if (el.saveBulkIndividual) el.saveBulkIndividual.hidden = !bulk;
  if (el.saveCircle) el.saveCircle.hidden = !circle;

  el.previewTargetWrap.hidden = !multi;
  syncEcalcApplyButtons();

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

function syncGridDotsFromLayout(dotsEl, perRowEl, rowsEl) {
  const { rows, perRow, dots } = computeGridLayout(rowsEl.value, perRowEl.value);
  rowsEl.value = String(rows);
  perRowEl.value = String(perRow);
  dotsEl.value = String(dots);
}

function onPrint1PassInput() {
  if (isSecondPassEnabled() && ExtraPrintUI) {
    getExtraPassList().forEach((printNum) => {
      if (!extraPrintIsPassCustomized(printNum)) {
        syncExtraPrintPassFromPrint1(printNum);
      }
    });
  }
  drawPreview();
}

function appendDotSequence(lines, dotCoords, params, annotate, zApproach, zRetract, zSafe) {
  const { lowerZ, upperZ, extrusionE } = params;
  dotCoords.forEach((coord, dotIndex) => {
    const x = coord.absX;
    const y = coord.absY;
    lines.push("");
    lines.push(`; Begin dot ${dotIndex + 1}`);
    if (annotate) {
      lines.push(`G1 ${formatGcodeXY(x, y)} F350  ; Move to dot position (X, Y) at 350 mm/min`);
      lines.push(`G4 P200                ; Pause 200ms to stabilize`);
      lines.push(`G1 Z${formatZMm(zApproach)} F250          ; Move down to approach height at 250 mm/min`);
      lines.push(`G4 P200                ; Pause 200ms`);
      lines.push(`G1 Z${formatZMm(lowerZ)} F30        ; Slowly descend to lower position (${formatZMm(lowerZ)}mm) at 30 mm/min`);
      lines.push(`G4 P500                ; Pause 500ms at lower position`);
      lines.push(`G1 Z${formatZMm(upperZ)} E ${formatExtrusionE(extrusionE)} F3 ; Move up to upper position (${formatZMm(upperZ)}mm), extrude ${formatExtrusionE(extrusionE)}, slow at 3 mm/min`);
      lines.push(`G4 S1.5                ; Wait 1.5 seconds for dispensing`);
      lines.push(`G1 Z${formatZMm(zRetract)} F80           ; Retract to ${formatZMm(zRetract)}mm at 80 mm/min`);
      lines.push(`G4 P750                ; Pause 750ms`);
      lines.push(`G1 Z${formatZMm(zSafe)} F350             ; Lift to safe height (${formatZMm(zSafe)}mm) at 350 mm/min`);
      lines.push(`G4 P200                ; Final pause 200ms`);
    } else {
      lines.push(`G1 ${formatGcodeXY(x, y)} F350`);
      lines.push(`G4 P200`);
      lines.push(`G1 Z${formatZMm(zApproach)} F250`);
      lines.push(`G4 P200`);
      lines.push(`G1 Z${formatZMm(lowerZ)} F30`);
      lines.push(`G4 P500`);
      lines.push(`G1 Z${formatZMm(upperZ)} E ${formatExtrusionE(extrusionE)} F3`);
      lines.push(`G4 S1.5`);
      lines.push(`G1 Z${formatZMm(zRetract)} F80`);
      lines.push(`G4 P750`);
      lines.push(`G1 Z${formatZMm(zSafe)} F350`);
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
  lines.push(`; Well ${wellNumber} | Lower Z ${formatZMm(lowerZ)} mm | Upper Z ${formatZMm(upperZ)} mm | E ${formatExtrusionE(extrusionE)}`);
  lines.push("");
  lines.push(`BottomElevation: ${formatZMm(WELL_BOTTOM_Z)}`);
  lines.push("; Zbottom: ");
  lines.push("; Zplus: ");
  lines.push("; Zplusplus: ");
  lines.push("; Zvoid: ");
  const trayLabel = getCurrentPlateType().label.replace(/-/g, " ").toUpperCase();
  lines.push(`; num2str(t) ;WORKING ON ROW ${rowNum} OF THE ${trayLabel} TRAY`);
  lines.push(`; Well number ${wellNumber}`);
  lines.push("");
  lines.push("M83");
  lines.push("");
  lines.push("G4 P100");
  lines.push("");

  const dotCoords = resolveParamsDots({
    startX,
    startY,
    numDots,
    spacingX,
    spacingY,
    perRow: dotsPerRow,
    customDots,
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
  drawDimensionLabel(ctx, `ΔX: ${formatCoordMm(spacingMm)} mm`, (left + right) / 2, labelY, color, false);
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
  drawDimensionLabel(ctx, `ΔY: ${formatCoordMm(spacingMm)} mm`, dimX + 22, (top + bottom) / 2, color, true);
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

function measuredHorizontalSpacing(positions, perRow) {
  if (perRow < 2 || positions.length < 2) return null;
  const alignedPair = rowSpacingPair(positions, 0, perRow);
  if (alignedPair) {
    return {
      pair: alignedPair,
      distMm: Math.abs(alignedPair[1].absX - alignedPair[0].absX),
    };
  }
  const first = positions[0];
  const second = positions[1];
  const distMm = Math.abs(second.absX - first.absX);
  if (distMm < 0.001) return null;
  return { pair: [first, second], distMm };
}

function measuredVerticalSpacing(positions, perRow, rows) {
  if (rows < 2 || perRow < 1 || positions.length < perRow + 1) return null;
  const topDot = lastDotInRow(positions, 0, perRow);
  const bottomDot = lastDotInRow(positions, 1, perRow);
  if (!topDot || !bottomDot) return null;
  const distMm = Math.abs(bottomDot.absY - topDot.absY);
  if (distMm < 0.001) return null;
  return { topDot, bottomDot, distMm };
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

function absDotKey(dot) {
  return `${dot.absX.toFixed(4)},${dot.absY.toFixed(4)}`;
}

function collectOverlapKeysAcrossLayers(layerPositions) {
  const keys = new Set();
  for (let i = 0; i < layerPositions.length; i += 1) {
    for (let j = i + 1; j < layerPositions.length; j += 1) {
      const { overlaps } = partitionOverlappingDots(layerPositions[i], layerPositions[j]);
      overlaps.forEach((dot) => keys.add(absDotKey(dot)));
    }
  }
  return keys;
}

function collectUniqueOverlapDots(layerPositions, overlapKeys) {
  const seen = new Set();
  const dots = [];
  layerPositions.forEach((positions) => {
    positions.forEach((dot) => {
      const key = absDotKey(dot);
      if (overlapKeys.has(key) && !seen.has(key)) {
        seen.add(key);
        dots.push(dot);
      }
    });
  });
  return dots;
}

function drawPreviewLegend(ctx, cw, ch, { extraPassNums = [], showOverlap = false, showOutside = false } = {}) {
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
  extraPassNums.forEach((n) => {
    rows.push({ type: "dot", label: `Print ${n}`, color: extraPassColors(n).dot });
  });
  if (showOverlap) {
    rows.push({ type: "dot", label: "Same XY (passes)", color: OVERLAP_DOT_COLOR });
  }
  if (showOutside) {
    rows.push({ type: "dot", label: "Outside well", color: OUTSIDE_WELL_DOT_COLOR });
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

function wellToCanvas(wellKey, refCx, refCy, pxCenterX, pxCenterY, scale, plateTypeId = getCurrentPlateTypeId()) {
  const [cx, cy] = getWellCenterMm(wellKey, plateTypeId);
  return {
    px: pxCenterX + (cx - refCx) * scale,
    py: pxCenterY - (cy - refCy) * scale,
  };
}

function computeDotPositions(cfg, refCx, refCy, pxCenterX, pxCenterY, scale, rPx, dotR) {
  const positions = [];
  const wellKey = cfg.well;
  const plateTypeId = cfg.plateTypeId || getCurrentPlateTypeId();
  const sourceDots = resolveParamsDots(cfg);

  sourceDots.forEach((dot) => {
    const px = pxCenterX + (dot.absX - refCx) * scale;
    const py = pxCenterY - (dot.absY - refCy) * scale;
    const outsideWell = !isDotInsideWellMm(dot.absX, dot.absY, wellKey, plateTypeId);
    positions.push({ absX: dot.absX, absY: dot.absY, px, py, outsideWell });
  });

  const rows = cfg.perRow > 0 ? Math.ceil(cfg.numDots / cfg.perRow) : 0;
  let gridWmm = Math.max(0, (cfg.perRow - 1) * cfg.spacingX);
  let gridHmm = Math.max(0, (rows - 1) * cfg.spacingY);
  if (cfg.customDots && cfg.customDots.length) {
    const bounds = gridBoundsFromAbsDots(cfg.customDots);
    gridWmm = bounds.gridWmm;
    gridHmm = bounds.gridHmm;
  }
  return { positions, rows, gridWmm, gridHmm };
}

function gridBoundsFromAbsDots(dots) {
  if (!dots.length) return { gridWmm: 0, gridHmm: 0 };
  const xs = dots.map((dot) => dot.absX);
  const ys = dots.map((dot) => dot.absY);
  return {
    gridWmm: Math.max(...xs) - Math.min(...xs),
    gridHmm: Math.max(...ys) - Math.min(...ys),
  };
}

function formatPassSummary(params, label) {
  if (params.lowerZ == null || params.upperZ == null || params.extrusionE == null) {
    return "";
  }
  return `${label}: Lower Z ${formatZMm(params.lowerZ)}, Upper Z ${formatZMm(params.upperZ)}, E ${formatExtrusionE(params.extrusionE)}`;
}

function drawWellOutline(ctx, wellKey, refCx, refCy, pxCenterX, pxCenterY, scale, rPx) {
  const { px, py } = wellToCanvas(wellKey, refCx, refCy, pxCenterX, pxCenterY, scale);
  ctx.beginPath();
  ctx.arc(px, py, rPx, 0, Math.PI * 2);
  ctx.stroke();
}

function drawPrintDots(ctx, positions, color, dotR) {
  positions.forEach((dot) => {
    const { px, py, outsideWell } = dot;
    ctx.fillStyle = outsideWell ? OUTSIDE_WELL_DOT_COLOR : color;
    ctx.beginPath();
    ctx.arc(px, py, dotR, 0, Math.PI * 2);
    ctx.fill();
    if (outsideWell) {
      ctx.strokeStyle = "#991B1B";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });
}

function drawSpacingIndicators(ctx, positions, perRow, rows, dotR, anchorPositions) {
  const bottomY = anchorPositions.length
    ? Math.max(...anchorPositions.map((d) => d.py))
    : 0;

  const horizontal = measuredHorizontalSpacing(positions, perRow);
  if (horizontal) {
    drawHorizontalSpacing(
      ctx,
      horizontal.pair[0].px,
      horizontal.pair[1].px,
      bottomY,
      horizontal.distMm,
      dotR
    );
  }

  const vertical = measuredVerticalSpacing(positions, perRow, rows);
  if (vertical) {
    drawVerticalSpacing(
      ctx,
      vertical.topDot.px,
      vertical.topDot.py,
      vertical.bottomDot.py,
      vertical.distMm,
      dotR
    );
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

function dotsFromAbsCoords(customDots, wellKey, refCx, refCy, pxCenterX, pxCenterY, scale, plateTypeId = getCurrentPlateTypeId()) {
  const positions = [];
  customDots.forEach((dot) => {
    const px = pxCenterX + (dot.absX - refCx) * scale;
    const py = pxCenterY - (dot.absY - refCy) * scale;
    const outsideWell = !isDotInsideWellMm(dot.absX, dot.absY, wellKey, plateTypeId);
    positions.push({ absX: dot.absX, absY: dot.absY, px, py, outsideWell });
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
  ctx.fillText(`R: ${formatCoordMm(radiusMm)} mm`, labelX, labelY);
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
  const plateTypeId = params.plateTypeId || getCurrentPlateTypeId();
  const wellDiamMm = getWellDiamMm(plateTypeId);
  const refCenter = getWellCenterMm(params.well, plateTypeId);
  const refCx = refCenter[0];
  const refCy = refCenter[1];
  const cw = canvasEl.width;
  const ch = canvasEl.height;
  const pxCenterX = cw / 2;
  const pxCenterY = ch / 2;
  const margin = 20;
  const usablePx = Math.min(cw, ch) - (2 * margin);
  const scale = usablePx / wellDiamMm;
  const rPx = (wellDiamMm / 2) * scale;
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
    dotR,
    printData.positions
  );

  const homeWell = wellToCanvas(params.well, refCx, refCy, pxCenterX, pxCenterY, scale);
  const homeScale = Math.min(1, canvasEl.width / 560);
  drawXYHomeIndicator(detailCtx, homeWell.px - rPx, homeWell.py + rPx, { scale: homeScale });
  drawPreviewLegend(detailCtx, cw, ch, {
    showOutside: printData.positions.some((dot) => dot.outsideWell),
  });

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
      `Start X ${formatCoordMm(params.startX)} Y ${formatCoordMm(params.startY)}`,
      `grid ${formatCoordMm(printData.gridWmm)} × ${formatCoordMm(printData.gridHmm)} mm`,
      `Ø ${getWellDiamMm(params.plateTypeId).toFixed(1)} mm${outsideWellMetaNote(printData.positions)}`,
    ].join(" | ");
  }
}

function drawBulkPreview() {
  prepareExportState();
  const selected = getSelectedBulkWells();
  const refParams = collectPrint1Params();
  const plateType = getCurrentPlateType();
  const plateTypeId = plateType.id;
  const wellDiamMm = plateType.wellDiamMm;
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
    setPreviewMeta(`${plateType.label} plate | No wells selected`);
    drawBulkDetailPreview();
    return;
  }

  const { scale } = plateMmToCanvas(bounds.minX, bounds.minY, bounds, cw, ch, margin);
  const rPx = (wellDiamMm / 2) * scale;

  plateType.rowKeys.forEach((rowKey) => {
    plateType.colKeys.forEach((colKey) => {
      const wellKey = `${rowKey}${colKey}`;
      const [cx, cy] = getWellCenterMm(wellKey, plateTypeId);
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
    const dots = resolveParamsDots(params);
    dots.forEach((dot) => {
      const { px, py } = plateMmToCanvas(dot.absX, dot.absY, bounds, cw, ch, margin);
      const outsideWell = !isDotInsideWellMm(dot.absX, dot.absY, wellKey, plateTypeId);
      const insideColor = wellKey === refParams.well ? PRINT1_DOT_COLOR : "#60a5fa";
      ctx.fillStyle = outsideWell ? OUTSIDE_WELL_DOT_COLOR : insideColor;
      ctx.beginPath();
      ctx.arc(px, py, dotR, 0, Math.PI * 2);
      ctx.fill();
      if (outsideWell) {
        ctx.strokeStyle = "#991B1B";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      dotPositions.push({
        absX: dot.absX,
        absY: dot.absY,
        px,
        py,
        wellKey,
        printNum: 1,
        outsideWell,
      });
    });
  });

  const bulkOutsideCount = dotPositions.filter((dot) => dot.outsideWell).length;
  const bulkOutsideNote = bulkOutsideCount > 0 ? ` | ${bulkOutsideCount} outside well` : "";
  setPreviewMeta([
    `Bulk: ${selected.length} well${selected.length === 1 ? "" : "s"}`,
    `${plateType.label}`,
    `Ref ${refParams.well}`,
    `grid ${formatCoordMm(Math.max(0, (refParams.perRow - 1) * refParams.spacingX))} × ${formatCoordMm(Math.max(0, (Math.ceil(refParams.numDots / refParams.perRow) - 1) * refParams.spacingY))} mm`,
    `Ø ${wellDiamMm.toFixed(1)} mm${bulkOutsideNote}`,
  ].join(" | "));
  drawBulkDetailPreview();
}

function drawCirclePreview() {
  prepareExportState();
  const params = collectCircleParams();
  const plateTypeId = params.plateTypeId || getCurrentPlateTypeId();
  const wellDiamMm = getWellDiamMm(plateTypeId);
  const canvas = el.canvasCircle || el.canvasStd;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const refCenter = getWellCenterMm(params.well, plateTypeId);
  const refCx = refCenter[0];
  const refCy = refCenter[1];
  const cw = canvas.width;
  const ch = canvas.height;
  const pxCenterX = cw / 2;
  const pxCenterY = ch / 2;
  const margin = 20;
  const usablePx = Math.min(cw, ch) - (2 * margin);
  const scale = usablePx / wellDiamMm;
  const rPx = (wellDiamMm / 2) * scale;
  const dotR = 3.5;

  const positions = dotsFromAbsCoords(
    params.customDots,
    params.well,
    refCx,
    refCy,
    pxCenterX,
    pxCenterY,
    scale,
    plateTypeId
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
  drawPreviewLegend(ctx, cw, ch, {
    showOutside: positions.some((dot) => dot.outsideWell),
  });

  setPreviewMeta([
    `Well ${params.well} | Circle R ${formatCoordMm(params.radiusMm)} mm`,
    `${positions.length} dots @ ${params.startAngleDeg.toFixed(0)}° start`,
    `Ø ${wellDiamMm.toFixed(1)} mm${outsideWellMetaNote(positions)}`,
  ].join(" | "));
}

function drawPreview() {
  prepareExportState();
  if (isBulkPrintEnabled()) {
    drawBulkPreview();
    return;
  }
  if (isCirclePrintEnabled()) {
    drawCirclePreview();
    return;
  }

  const print1 = collectPrint1Params();
  const plateTypeId = print1.plateTypeId || getCurrentPlateTypeId();
  const wellDiamMm = getWellDiamMm(plateTypeId);
  const multi = isSecondPassEnabled();
  const view = getPreviewView();
  const showPrint1Layer = view === "1" || view === "both";

  const extraLayers = multi
    ? getExtraPassList()
        .map((printNum) => {
          const params = collectExtraPrintParams(printNum);
          if (!params) return null;
          return { printNum, params };
        })
        .filter(Boolean)
    : [];
  const drawableExtra = extraLayers.filter((layer) => !layer.params.offsetInvalid);

  const refWell = getWellCenterMm(print1.well, plateTypeId);
  const refCx = refWell[0];
  const refCy = refWell[1];

  const canvas = el.canvasStd;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const cw = canvas.width;
  const ch = canvas.height;
  const pxCenterX = cw / 2;
  const pxCenterY = ch / 2;
  const margin = 20;
  const usablePx = Math.min(cw, ch) - (2 * margin);
  const scale = usablePx / wellDiamMm;
  const rPx = (wellDiamMm / 2) * scale;
  const dotR = 3.5;

  const print1Data = computeDotPositions(
    print1, refCx, refCy, pxCenterX, pxCenterY, scale, rPx, dotR
  );

  const layersWithData = drawableExtra.map((layer) => ({
    ...layer,
    data: computeDotPositions(
      layer.params, refCx, refCy, pxCenterX, pxCenterY, scale, rPx, dotR
    ),
  }));

  const visibleExtra = layersWithData.filter(
    (layer) => view === "both" || view === String(layer.printNum)
  );

  ctx.clearRect(0, 0, cw, ch);
  dotPositions = [];

  ctx.strokeStyle = "#666";
  ctx.lineWidth = 2;
  drawWellOutline(ctx, print1.well, refCx, refCy, pxCenterX, pxCenterY, scale, rPx);

  const layersToCompare = [];
  if (showPrint1Layer) layersToCompare.push(print1Data.positions);
  visibleExtra.forEach((layer) => layersToCompare.push(layer.data.positions));
  const overlapKeys = multi && layersToCompare.length > 1
    ? collectOverlapKeysAcrossLayers(layersToCompare)
    : new Set();
  const hasOverlap = overlapKeys.size > 0;

  const drawPassLayer = (data, printNum, colors) => {
    const uniqueDots = [];
    data.positions.forEach((dot) => {
      dotPositions.push({ ...dot, printNum });
      if (!overlapKeys.has(absDotKey(dot))) uniqueDots.push(dot);
    });
    drawToolpath(ctx, data.positions, dotR, colors.toolpath);
    drawPrintDots(ctx, uniqueDots, colors.dot, dotR);
  };

  if (showPrint1Layer) {
    drawPassLayer(print1Data, 1, { dot: PRINT1_DOT_COLOR, toolpath: PRINT1_TOOLPATH_COLOR });
    drawStartArrow(ctx, print1Data.positions, dotR);
  }

  visibleExtra.forEach((layer) => {
    const colors = extraPassColors(layer.printNum);
    drawPassLayer(layer.data, layer.printNum, colors);
    if (!showPrint1Layer && layer === visibleExtra[0]) {
      drawStartArrow(ctx, layer.data.positions, dotR);
    }
  });

  if (hasOverlap) {
    drawPrintDots(
      ctx,
      collectUniqueOverlapDots(layersToCompare, overlapKeys),
      OVERLAP_DOT_COLOR,
      dotR
    );
  }

  const spacingAnchors = [];
  if (showPrint1Layer) spacingAnchors.push(...print1Data.positions);
  visibleExtra.forEach((layer) => spacingAnchors.push(...layer.data.positions));

  let spacingLayer = null;
  if (view !== "1" && visibleExtra.length) {
    spacingLayer = visibleExtra[visibleExtra.length - 1];
  } else if (showPrint1Layer) {
    spacingLayer = { params: print1, data: print1Data };
  }

  if (spacingAnchors.length && spacingLayer) {
    drawSpacingIndicators(
      ctx,
      spacingLayer.data.positions,
      spacingLayer.params.perRow,
      spacingLayer.data.rows,
      dotR,
      spacingAnchors
    );
  }

  const homeWell = wellToCanvas(print1.well, refCx, refCy, pxCenterX, pxCenterY, scale);
  drawXYHomeIndicator(ctx, homeWell.px - rPx, homeWell.py + rPx);

  const legendPositions = [];
  if (showPrint1Layer) legendPositions.push(...print1Data.positions);
  visibleExtra.forEach((layer) => legendPositions.push(...layer.data.positions));
  const outsideNote = outsideWellMetaNote(legendPositions);

  const passSummaries = [
    formatPassSummary(print1, "Pass 1"),
    ...visibleExtra.map((layer) =>
      formatPassSummary(layer.params, `Pass ${layer.printNum}`)
    ),
  ];
  const passMeta = multi && visibleExtra.length ? passSummaries.join(" | ") : "";

  drawPreviewLegend(ctx, cw, ch, {
    extraPassNums: visibleExtra.map((l) => l.printNum),
    showOverlap: hasOverlap,
    showOutside: legendPositions.some((dot) => dot.outsideWell),
  });

  const wellLabel = `Well ${print1.well}`;
  const invalidExtra = extraLayers.find((l) => l.params?.offsetInvalid);
  if (invalidExtra && (view === "both" || view === String(invalidExtra.printNum))) {
    setPreviewMeta(
      `${wellLabel} | Print ${invalidExtra.printNum} hidden until Y offset values are valid | Ø ${wellDiamMm.toFixed(1)} mm${outsideNote}`
    );
  } else if (view === "both" && multi) {
    setPreviewMeta([
      `${wellLabel} | ${passSummaries.length} pass(es)`,
      passMeta,
      `Ø ${wellDiamMm.toFixed(1)} mm${outsideNote}`,
    ].filter(Boolean).join(" | "));
  } else if (view !== "1" && visibleExtra[0]) {
    const layer = visibleExtra[0];
    setPreviewMeta(
      `${wellLabel} | Pass ${layer.printNum} grid ${formatCoordMm(layer.data.gridWmm)} × ${formatCoordMm(layer.data.gridHmm)} mm | ${passMeta} | Ø ${wellDiamMm.toFixed(1)} mm${outsideNote}`
    );
  } else {
    setPreviewMeta(
      `${wellLabel} | Pass 1 grid ${formatCoordMm(print1Data.gridWmm)} × ${formatCoordMm(print1Data.gridHmm)} mm | ${passMeta} | Ø ${wellDiamMm.toFixed(1)} mm${outsideNote}`
    );
  }
}

function onPrint1GridLayoutInput() {
  if (isCirclePrintEnabled()) {
    drawPreview();
    return;
  }
  syncGridDotsFromLayout(el.dots, el.perRow, el.rows);
  drawPreview();
}

function onExtraPrintGridLayoutInput(printNum) {
  const fields = extraPrintFieldTarget(printNum);
  if (!fields?.dots || !fields?.perRow || !fields?.rows) return;
  syncGridDotsFromLayout(fields.dots, fields.perRow, fields.rows);
  drawPreview();
}

function setEcalcOutputEmpty() {
  el.ecalcConc.textContent = "—";
  el.ecalcEVal.textContent = "—";
  el.ecalcStepsUl.textContent = "—";
  el.ecalcStepsInj.textContent = "—";
}

function updateEcalc() {
  const cells = parseEcalcFloat(el.ecalcCells.value);
  const volUl = parseEcalcFloat(el.ecalcVolUl.value);
  const needleRatio = parseEcalcFloat(el.ecalcNeedleRatio.value);
  if (cells === null || volUl === null || needleRatio === null) {
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

}

async function saveGcodeFile(contents, defaultFileName) {
  if (!window.gcodeApi?.saveGcode) {
    reportSaveFailure(createUserIssue({
      id: "SAVE_UNAVAILABLE",
      title: "Save unavailable",
      message: "File export requires the G-Code Generator desktop app. Run npm run electron or open the .app from Releases.",
      fields: [],
      focusId: null,
    }), "Save unavailable outside the Electron app.");
    return;
  }

  el.saveStatus.textContent = "";
  try {
    const result = await window.gcodeApi.saveGcode({ defaultFileName, contents });
    if (result.cancelled) {
      el.saveStatus.textContent = "Save cancelled.";
    } else if (result.error) {
      el.saveStatus.textContent = `Save failed: ${result.message}`;
    } else {
      el.saveStatus.textContent = `Saved: ${result.path}`;
    }
  } catch (err) {
    el.saveStatus.textContent = `Save failed: ${err.message || String(err)}`;
  }
}

async function saveGcode() {
  prepareExportState();
  const passErr = validatePassSettings(print1FieldTarget());
  if (passErr) {
    reportSaveFailure(issueForPassSettings(passErr, "print1"), passErr);
    return;
  }
  const print1 = collectPrint1Params();
  const err = validatePrintParams(print1);
  if (err) {
    reportSaveFailure(issueForValidationError(err, { focusId: "start-x" }), err);
    return;
  }
  await saveGcodeFile(paramsToGcode(print1), defaultFileNameForParams(print1, ""));
}

async function savePrint1Gcode() {
  prepareExportState();
  const passErr = validatePassSettings(print1FieldTarget());
  if (passErr) {
    reportSaveFailure(issueForPassSettings(passErr, "print1"), passErr);
    return;
  }
  const print1 = collectPrint1Params();
  const err = validatePrintParams(print1);
  if (err) {
    reportSaveFailure(issueForValidationError(err, { focusId: "start-x" }), err);
    return;
  }
  await saveGcodeFile(paramsToGcode(print1), defaultMultiPrintSaveFileName(print1, "_print1"));
}

async function saveExtraPrintGcode(printNum) {
  prepareExportState();
  if (!ExtraPrintUI) {
    reportSaveFailure(createUserIssue({
      id: "MULTI_PRINT_UNAVAILABLE",
      title: "Multi-print unavailable",
      message: "Multi-print UI failed to load. Reload the app or reinstall from Releases.",
      fields: [],
      focusId: null,
    }), "Multi-print unavailable.");
    return;
  }
  const fields = extraPrintFieldTarget(printNum);
  const passErr = validatePassSettingsSafe(fields);
  if (passErr) {
    reportSaveFailure(issueForPassSettings(passErr, `print${printNum}`), passErr);
    return;
  }
  const print2 = collectExtraPrintParams(printNum);
  if (!print2) {
    reportSaveFailure(createUserIssue({
      id: "MULTI_PRINT_PARAMS",
      title: `Print ${printNum} settings unavailable`,
      message: "Could not read Print pass settings. Reload the app and try again.",
      fields: [],
      focusId: null,
    }), "Print pass settings unavailable.");
    return;
  }
  if (print2.offsetInvalid) {
    const angleErr = validateAngleOffsetFor(printNum) || "Error: Y offset settings are invalid.";
    reportSaveFailure(issueForAngleOffset(angleErr, printNum), angleErr);
    return;
  }
  const err2 = validatePrintParams(print2);
  if (err2) {
    reportSaveFailure(issueForValidationError(err2, {
      printNum,
      passTarget: `print${printNum}`,
      focusId: extraPrintIsOffsetEnabled(printNum) ? `p${printNum}-offset-max` : `p${printNum}-start-x`,
    }), err2);
    return;
  }
  const errAngle = validateAngleOffsetFor(printNum);
  if (errAngle) {
    reportSaveFailure(issueForAngleOffset(errAngle, printNum), errAngle);
    return;
  }
  await saveGcodeFile(
    paramsToGcode(print2),
    defaultMultiPrintSaveFileName(print2, `_print${printNum}`, printNum)
  );
}

async function saveCombinedGcode() {
  prepareExportState();
  const pass1Err = validatePassSettings(print1FieldTarget());
  if (pass1Err) {
    reportSaveFailure(issueForPassSettings(pass1Err, "print1"), pass1Err);
    return;
  }
  const print1 = collectPrint1Params();
  const err1 = validatePrintParams(print1);
  if (err1) {
    reportSaveFailure(issueForValidationError(err1, { focusId: "start-x" }), err1);
    return;
  }

  for (const printNum of getExtraPassList()) {
    if (!ExtraPrintUI) break;
    const fields = extraPrintFieldTarget(printNum);
    const passErr = validatePassSettingsSafe(fields);
    if (passErr) {
      reportSaveFailure(issueForPassSettings(passErr, `print${printNum}`), passErr);
      return;
    }
    const params = collectExtraPrintParams(printNum);
    if (!params) {
      reportSaveFailure(createUserIssue({
        id: "MULTI_PRINT_PARAMS",
        title: `Print ${printNum} settings unavailable`,
        message: "Could not read Print pass settings. Reload the app and try again.",
        fields: [],
        focusId: null,
      }), "Print pass settings unavailable.");
      return;
    }
    if (params.offsetInvalid) {
      const angleErr = validateAngleOffsetFor(printNum) || "Error: Y offset settings are invalid.";
      reportSaveFailure(issueForAngleOffset(angleErr, printNum), angleErr);
      return;
    }
    const errN = validatePrintParams(params);
    if (errN) {
      reportSaveFailure(issueForValidationError(errN, {
        printNum,
        passTarget: `print${printNum}`,
        focusId: extraPrintIsOffsetEnabled(printNum) ? `p${printNum}-offset-max` : `p${printNum}-start-x`,
      }), errN);
      return;
    }
    const errAngle = validateAngleOffsetFor(printNum);
    if (errAngle) {
      reportSaveFailure(issueForAngleOffset(errAngle, printNum), errAngle);
      return;
    }
  }

  const passCount = getExtraPassList().length + 1;
  await saveGcodeFile(
    buildCombinedGcodeAllPasses(),
    defaultCombinedMultiPrintSaveFileName(print1, passCount)
  );
}

function validateBulkExport() {
  const issues = [];
  const passErr = validatePassSettings(print1FieldTarget());
  if (passErr) {
    issues.push(issueForPassSettings(passErr, "print1"));
    return { error: passErr, issues };
  }
  const ref = collectPrint1Params();
  const wells = getSelectedBulkWells();
  if (!wells.length) {
    const err = "Error: Select at least one well to print.";
    issues.push(issueForValidationError(err));
    return { error: err, issues };
  }
  const refErr = validatePrintParams(ref);
  if (refErr) {
    const refSelected = wells.includes(ref.well);
    issues.push(createUserIssue({
      id: "BULK_REF_PATTERN",
      title: "Reference well pattern invalid",
      message: refSelected
        ? `${refErr} The reference well (${ref.well}) defines the pattern copied to every selected well.`
        : `${refErr} Bulk print always validates the reference well (${ref.well}) because it defines the template pattern, even when ${ref.well} is not checked. Fix the pattern fields above.`,
      fields: GRID_PATTERN_FIELDS,
      focusId: "start-x",
    }));
    return { error: refErr, issues };
  }
  const outsideFailures = collectBulkWellOutsideFailures(wells);
  if (outsideFailures.length) {
    issues.push(...issuesForBulkWellOutsideFailures(outsideFailures));
    const error = outsideFailures.length === 1
      ? outsideFailures[0].wellErr
      : `Error: ${outsideFailures.length} selected wells have dots outside the well.`;
    return { error, issues };
  }
  return { ref, wells };
}

async function saveBulkGcodeCombined() {
  prepareExportState();
  const validated = validateBulkExport();
  if (validated.error) {
    reportSaveFailure(validated.issues || [validated.issue], validated.error);
    return;
  }
  const { ref, wells } = validated;
  await saveGcodeFile(
    buildBulkCombinedGcode(wells),
    defaultBulkFileName(wells, ref.lowerZ)
  );
}

async function saveCircleGcode() {
  prepareExportState();
  const passErr = validatePassSettings(print1FieldTarget());
  if (passErr) {
    reportSaveFailure(issueForPassSettings(passErr, "print1"), passErr);
    return;
  }
  const params = collectCircleParams();
  const err = validateCircleParams(params);
  if (err) {
    reportSaveFailure(issueForValidationError(err, { circle: true }), err);
    return;
  }
  await saveGcodeFile(circleParamsToGcode(params), defaultCircleFileName(params));
}

async function saveBulkGcodeIndividual() {
  prepareExportState();
  const validated = validateBulkExport();
  if (validated.error) {
    reportSaveFailure(validated.issues || [validated.issue], validated.error);
    return;
  }
  if (!window.gcodeApi?.saveGcodeFiles) {
    reportSaveFailure(createUserIssue({
      id: "SAVE_UNAVAILABLE",
      title: "Save unavailable",
      message: "File export requires the G-Code Generator desktop app. Run npm run electron or open the .app from Releases.",
      fields: [],
      focusId: null,
    }), "Save unavailable outside the Electron app.");
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

  el.saveStatus.textContent = "";
  try {
    const result = await window.gcodeApi.saveGcodeFiles({ files });
    if (result.cancelled) {
      el.saveStatus.textContent = "Save cancelled.";
      return;
    }
    if (result.error) {
      const rolledBack = result.paths?.length
        ? ` (${result.paths.length} file${result.paths.length === 1 ? "" : "s"} written then rolled back)`
        : "";
      el.saveStatus.textContent = `Save failed: ${result.message}${rolledBack}`;
      return;
    }
    const count = result.paths.length;
    const noun = count === 1 ? "file" : "files";
    el.saveStatus.textContent = `Saved ${count} ${noun} to ${result.dir}`;
  } catch (err) {
    el.saveStatus.textContent = `Save failed: ${err.message || String(err)}`;
  }
}

function populatePlateTypes() {
  if (!el.plateType) return;
  el.plateType.innerHTML = "";
  PLATE_TYPE_OPTIONS.forEach(({ id, label }) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = label;
    el.plateType.appendChild(option);
  });
  el.plateType.value = DEFAULT_PLATE_TYPE;
}

let plateTypeSwitchInProgress = false;

function populateWells(plateTypeId = getCurrentPlateTypeId()) {
  if (!el.well) return;
  const starts = getWellStarts(plateTypeId);
  el.well.innerHTML = "";
  Object.keys(starts).forEach((well) => {
    const option = document.createElement("option");
    option.value = well;
    option.textContent = well;
    el.well.appendChild(option);
  });
  el.well.value = "A1";
  syncWellNumberFromDropdown();
}

function buildBulkWellGrid(plateTypeId = getCurrentPlateTypeId()) {
  if (!el.bulkWellGrid) return;
  const plateType = getPlateType(plateTypeId);
  el.bulkWellGrid.innerHTML = "";
  el.bulkWellGrid.style.gridTemplateColumns = `repeat(${plateType.bulkGridCols}, minmax(0, 1fr))`;
  plateType.rowKeys.forEach((rowKey) => {
    plateType.colKeys.forEach((colKey) => {
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

function onPlateTypeChange(event) {
  const plateTypeId = event?.target?.value || getCurrentPlateTypeId();
  plateTypeSwitchInProgress = true;
  try {
    populateWells(plateTypeId);
    buildBulkWellGrid(plateTypeId);
    const wellKey = el.well.value;
    multiPatternLastWell = wellKey;
    bulkPatternLastWell = wellKey;
    standardPatternLastWell = wellKey;
    circlePatternLastWell = wellKey;

    setDefaultsFromCurrentWell(plateTypeId);
    setCircleCenterToWell(wellKey, plateTypeId);
    refreshAllStoredStartsDropdowns(plateTypeId);
    if (el.circleDots) el.circleDots.value = "12";
    if (el.circleRadius) el.circleRadius.value = "3";
    if (el.circleStartAngle) el.circleStartAngle.value = "0";

    if (ExtraPrintUI) {
      ExtraPrintUI.resetPasses();
      ExtraPrintUI.init(el.extraPrintsContainer, getExtraPrintUICallbacks());
      setAllExtraPrintDefaults();
      ExtraPrintUI.syncPreviewTargetOptions(el.previewTarget);
    }
    setAllBulkWellsChecked(false);
    setBulkWellChecked(wellKey, true);
    updateBulkSelectionCount();
    if (el.bulkRefWellLabel) el.bulkRefWellLabel.textContent = wellKey;
    if (el.keepMultiPatternMetrics) el.keepMultiPatternMetrics.checked = false;
    updateModeUi();
    drawPreview();
  } finally {
    plateTypeSwitchInProgress = false;
  }
}

function initCirclePrint() {
  applyCircleDefaults(el.well.value);

  if (el.circleSnapCenter) {
    el.circleSnapCenter.addEventListener("click", () => {
      setCircleCenterToWell(el.well.value);
      circlePatternLastWell = el.well.value;
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

  if (el.saveCircle) {
    el.saveCircle.addEventListener("click", saveCircleGcode);
  }
}

function bindClick(node, handler) {
  if (node) node.addEventListener("click", handler);
}

function bindInput(node, handler) {
  if (node) node.addEventListener("input", handler);
}

function bindChange(node, handler) {
  if (node) node.addEventListener("change", handler);
}

function initBulkPrint() {
  buildBulkWellGrid();

  bindClick(el.bulkSelectAll, () => setAllBulkWellsChecked(true));
  bindClick(el.bulkSelectNone, () => setAllBulkWellsChecked(false));
  bindClick(el.bulkSelectRef, () => {
    setAllBulkWellsChecked(false);
    setBulkWellChecked(el.well.value, true);
    updateBulkSelectionCount();
    drawPreview();
  });
  bindClick(el.saveBulkCombined, saveBulkGcodeCombined);
  bindClick(el.saveBulkIndividual, saveBulkGcodeIndividual);
  bindChange(el.bulkDetailWell, drawPreview);
}

function snapExtraPrintToWell(printNum) {
  const fields = extraPrintFieldTarget(printNum);
  if (!fields?.startX) return;
  const plateTypeId = getCurrentPlateTypeId();
  const [sx, sy] = startPositionForCenterDotAtWellCenter(
    el.well.value,
    safeInt(fields.dots?.value),
    safeInt(fields.perRow?.value),
    safeFloat(fields.spacingX?.value),
    safeFloat(fields.spacingY?.value),
    plateTypeId
  );
  fields.startX.value = sx.toFixed(2);
  fields.startY.value = sy.toFixed(2);
  drawPreview();
}

function getExtraPrintUICallbacks() {
  return {
    onChange: drawPreview,
    onGridLayout: onExtraPrintGridLayoutInput,
    onSyncPass: (printNum) => {
      ExtraPrintUI.clearPassCustomized(printNum);
      syncExtraPrintPassFromPrint1(printNum);
      drawPreview();
    },
    onSnap: snapExtraPrintToWell,
    onSavePass: saveExtraPrintGcode,
    onRemove: (printNum) => {
      if (ExtraPrintUI.removePass(printNum)) {
        ExtraPrintUI.syncPreviewTargetOptions(el.previewTarget);
        syncEcalcApplyButtons();
        updateModeUi();
        drawPreview();
      }
    },
    onOffsetToggle: (printNum) => {
      copyPrint1PatternToExtraPass(printNum);
      updateModeUi();
      drawPreview();
    },
    onDifferentMode: (printNum) => {
      copyPrint1PatternToExtraPass(printNum);
    },
  };
}

function initMultiPrint() {
  if (!el.extraPrintsContainer) return;
  if (!ExtraPrintUI) {
    el.extraPrintsContainer.innerHTML =
      '<p class="note">Multi-print UI failed to load. Reload the app or reinstall from Releases.</p>';
    return;
  }

  ExtraPrintUI.init(el.extraPrintsContainer, getExtraPrintUICallbacks());

  setAllExtraPrintDefaults();
  ExtraPrintUI.syncPreviewTargetOptions(el.previewTarget);
  updateModeUi();

  bindChange(el.previewTarget, drawPreview);
  bindClick(el.addExtraPrint, () => {
    const added = ExtraPrintUI.addPass();
    if (!added) {
      el.saveStatus.textContent = `Maximum ${ExtraPrintUI.MAX_EXTRA_PASSES + 1} passes (Print 1 plus ${ExtraPrintUI.MAX_EXTRA_PASSES} extra).`;
      return;
    }
    setExtraPrintDefaults(added);
    setupExtraPassStoredStarts(added);
    ExtraPrintUI.syncPreviewTargetOptions(el.previewTarget);
    syncEcalcApplyButtons();
    updateModeUi();
    drawPreview();
  });

  bindClick(el.savePrint1, savePrint1Gcode);
  bindClick(el.saveCombined, saveCombinedGcode);
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

function syncEcalcApplyButtons() {
  if (!el.ecalcApplyExtra) return;
  el.ecalcApplyExtra.innerHTML = "";
  if (!isSecondPassEnabled() || !ExtraPrintUI) return;
  getExtraPassList().forEach((printNum) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `Apply E to Print ${printNum}`;
    btn.addEventListener("click", () => applyEcalcToExtrusion("extra", printNum));
    el.ecalcApplyExtra.appendChild(btn);
  });
}

function applyEcalcToExtrusion(targetPass, printNum = 2) {
  const volUl = parseEcalcFloat(el.ecalcVolUl.value);
  const needleRatio = parseEcalcFloat(el.ecalcNeedleRatio.value);
  if (volUl === null || needleRatio === null) {
    el.saveStatus.textContent = "Enter volume per injection and needle ratio before applying E.";
    focusIssueField("ecalc-vol-ul");
    return;
  }
  const eVal = needleRatio * volUl;
  const useExtra = targetPass === "extra";
  if (useExtra) {
    const fields = ExtraPrintUI?.fieldTarget(printNum);
    if (!fields?.extrusionE) return;
    fields.extrusionE.value = formatExtrusionE(eVal);
    ExtraPrintUI.setPassCustomized(printNum);
  } else {
    el.extrusionE.value = formatExtrusionE(eVal);
  }
  const passLabel = useExtra ? `Print ${printNum}` : "Print 1";
  el.saveStatus.textContent = `Applied E = ${formatExtrusionE(eVal)} to ${passLabel} extrusion field.`;
  drawPreview();
}

function bootApp() {
  try {
    populatePlateTypes();
    populateWells();
    multiPatternLastWell = el.well.value;
    bulkPatternLastWell = el.well.value;
    standardPatternLastWell = el.well.value;
    circlePatternLastWell = el.well.value;
    document.body.dataset.appMode = "standard";
    initUserIssueModal();
    initMultiPrint();
    initStoredStartsDropdowns();
    initBulkPrint();
    initCirclePrint();
    setDefaultsFromCurrentWell();
    initTabs();
    window.GcodeMotionSimulator?.init({
      getPlateTypeId: () => getCurrentPlateTypeId(),
      onRefreshCurrentJob: () => simulateCurrentMotion(lastSimulatorSourceMode),
    });
    document.getElementById("simulate-motion")?.addEventListener("click", () => simulateCurrentMotion());
    document.getElementById("simulator-load-source")?.addEventListener("click", () => {
      const sourceMode = document.getElementById("simulator-source-mode")?.value || lastSimulatorSourceMode;
      lastSimulatorSourceMode = sourceMode;
      simulateCurrentMotion(sourceMode);
    });
    if (el.plateType) {
      el.plateType.addEventListener("change", onPlateTypeChange);
    }
    updateEcalc();
    drawPreview();
  } catch (err) {
    console.error(err);
    showFatalStartupError(err.message || String(err));
  }
}

bootApp();

el.well.addEventListener("change", () => {
  if (plateTypeSwitchInProgress) return;
  const newWellKey = el.well.value;
  syncWellNumberFromDropdown();
  if (isCirclePrintEnabled()) {
    onCirclePatternWellChange(newWellKey);
  } else if (isSecondPassEnabled()) {
    onMultiPatternWellChange(newWellKey);
  } else if (isBulkPrintEnabled()) {
    onBulkPatternWellChange(newWellKey);
    setBulkWellChecked(newWellKey, true);
    updateBulkSelectionCount();
  } else {
    onStandardPatternWellChange(newWellKey);
  }
  if (el.bulkRefWellLabel) el.bulkRefWellLabel.textContent = newWellKey;
  syncStoredStartsPickersForWell(newWellKey);
  drawPreview();
});
if (el.keepMultiPatternMetrics) {
  el.keepMultiPatternMetrics.addEventListener("change", () => {
    multiPatternLastWell = el.well.value;
    el.saveStatus.textContent = el.keepMultiPatternMetrics.checked
      ? `Pattern metrics will follow well changes from ${multiPatternLastWell} (offset from each well’s default start).`
      : "";
  });
}
el.snap.addEventListener("click", () => {
  const plateTypeId = getCurrentPlateTypeId();
  const [sx, sy] = startPositionForCenterDotAtWellCenter(
    el.well.value,
    safeInt(el.dots.value),
    safeInt(el.perRow.value),
    safeFloat(el.spacingX.value),
    safeFloat(el.spacingY.value),
    plateTypeId
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
    applyCircleDefaults(el.well.value);
  }
  if (ExtraPrintUI) {
    ExtraPrintUI.resetPasses();
    ExtraPrintUI.init(el.extraPrintsContainer, getExtraPrintUICallbacks());
    setAllExtraPrintDefaults();
    ExtraPrintUI.syncPreviewTargetOptions(el.previewTarget);
    refreshAllStoredStartsDropdowns();
  }
  el.previewTarget.value = "both";
  if (el.keepMultiPatternMetrics) el.keepMultiPatternMetrics.checked = false;
  multiPatternLastWell = el.well.value;
  bulkPatternLastWell = el.well.value;
  standardPatternLastWell = el.well.value;
  circlePatternLastWell = el.well.value;
  setAllBulkWellsChecked(false);
  setBulkWellChecked(el.well.value, true);
  updateBulkSelectionCount();
  updateModeUi();
  refreshAllStoredStartsDropdowns();
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

[el.perRow, el.rows].forEach((i) => {
  i.addEventListener("input", onPrint1GridLayoutInput);
});
[el.spacingX, el.spacingY, el.startX, el.startY].forEach((i) => {
  i.addEventListener("input", drawPreview);
});
[el.lowerZ, el.upperZ, el.extrusionE].forEach((i) => {
  i.addEventListener("input", onPrint1PassInput);
});
[el.ecalcCells, el.ecalcVolUl, el.ecalcNeedleRatio].forEach((i) => {
  i.addEventListener("input", updateEcalc);
});
if (el.ecalcApplyP1) {
  el.ecalcApplyP1.addEventListener("click", () => applyEcalcToExtrusion("print1"));
}

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
    else if (closest.printNum === "both") printLabel = "Same XY (2 passes) dot";
    else if (closest.printNum) printLabel = `Print ${closest.printNum} dot`;
    const outsideNote = closest.outsideWell ? " | outside well" : "";
    el.coordLabel.textContent = `${printLabel}: X = ${formatCoordMm(closest.absX)} mm | Y = ${formatCoordMm(closest.absY)} mm${outsideNote}`;
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
