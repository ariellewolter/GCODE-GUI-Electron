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
  startAtCenter: document.getElementById("start-at-center"),
  annotate: document.getElementById("annotate"),
  snap: document.getElementById("snap"),
  reset: document.getElementById("reset"),
  save: document.getElementById("save"),
  saveStatus: document.getElementById("save-status"),
  canvas: document.getElementById("preview-canvas"),
  previewMeta: document.getElementById("preview-meta"),
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
};

const ctx = el.canvas.getContext("2d");
let dotPositions = [];
let ecalcOpen = true;

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

function setDefaultsFromCurrentWell() {
  const sel = el.well.value;
  el.dots.value = "30";
  el.perRow.value = "10";
  el.rows.value = "3";
  el.spacingX.value = "0.3";
  el.spacingY.value = "1.5";
  el.lowerZ.value = DEFAULT_LOWER_Z_OFFSET.toFixed(2);
  el.upperZ.value = DEFAULT_UPPER_Z_OFFSET.toFixed(2);
  el.wellNumber.value = sel;
  el.extrusionE.value = DEFAULT_EXTRUSION.toFixed(4);

  if (el.startAtCenter.checked) {
    const [sx, sy] = startPositionForCenterDotAtWellCenter(sel, 30, 10, 0.3, 1.5);
    el.startX.value = sx.toFixed(2);
    el.startY.value = sy.toFixed(2);
  } else {
    const [cx, cy] = DEFAULT_24WELL_STARTS[sel] || DEFAULT_24WELL_STARTS.A1;
    el.startX.value = cx.toFixed(2);
    el.startY.value = cy.toFixed(2);
  }
}

function buildGcode(params) {
  const {
    startX, startY, numDots, spacingX, spacingY, lowerZ, upperZ,
    wellNumber, dotsPerRow, annotate, extrusionE,
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

  const rows = Math.ceil(numDots / dotsPerRow);
  let dotIndex = 0;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < dotsPerRow; c += 1) {
      if (dotIndex >= numDots) break;
      const x = startX + c * spacingX;
      const y = startY + r * spacingY;
      lines.push(``);
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
      dotIndex += 1;
    }
  }
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

function drawPreview() {
  const dots = safeInt(el.dots.value);
  const perRow = safeInt(el.perRow.value);
  const spacingX = safeFloat(el.spacingX.value);
  const spacingY = safeFloat(el.spacingY.value);
  const startXVal = safeFloat(el.startX.value);
  const startYVal = safeFloat(el.startY.value);
  const rows = perRow > 0 ? Math.ceil(dots / perRow) : 0;
  const selWell = el.well.value;
  const center = DEFAULT_24WELL_CENTERS[selWell] || DEFAULT_24WELL_CENTERS.A1;
  const previewCx = center[0];
  const previewCy = center[1];

  const cw = el.canvas.width;
  const ch = el.canvas.height;
  const pxCenterX = cw / 2;
  const pxCenterY = ch / 2;
  const margin = 20;
  const usablePx = Math.min(cw, ch) - (2 * margin);
  const scale = usablePx / WELL_DIAM_MM;
  const rPx = (WELL_DIAM_MM / 2) * scale;
  const dotR = 3.5;
  const gridWmm = Math.max(0, (perRow - 1) * spacingX);
  const gridHmm = Math.max(0, (rows - 1) * spacingY);

  ctx.clearRect(0, 0, cw, ch);
  dotPositions = [];
  ctx.strokeStyle = "#666";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(pxCenterX, pxCenterY, rPx, 0, Math.PI * 2);
  ctx.stroke();

  let idx = 0;
  for (let rr = 0; rr < rows; rr += 1) {
    for (let cc = 0; cc < perRow; cc += 1) {
      if (idx >= dots) break;
      const absX = startXVal + cc * spacingX;
      const absY = startYVal + rr * spacingY;
      const px = pxCenterX + (absX - previewCx) * scale;
      const py = pxCenterY - (absY - previewCy) * scale;
      if (Math.hypot(px - pxCenterX, py - pxCenterY) < (rPx - dotR)) {
        ctx.fillStyle = "#2196F3";
        ctx.beginPath();
        ctx.arc(px, py, dotR, 0, Math.PI * 2);
        ctx.fill();
        dotPositions.push({ absX, absY, px, py });
      }
      idx += 1;
    }
  }

  // Direction arrow sits entirely before the first dot, pointing toward dot 2.
  if (dotPositions.length >= 2) {
    const first = dotPositions[0];
    const second = dotPositions[1];
    const dx = second.px - first.px;
    const dy = second.py - first.py;
    const len = Math.hypot(dx, dy);
    if (len > 2) {
      const ux = dx / len;
      const uy = dy / len;
      const nx = -uy;
      const ny = ux;

      const gapBeforeDot = dotR + 8;
      const shaftLen = Math.min(32, Math.max(16, len * 0.55));
      const tipX = first.px - ux * gapBeforeDot;
      const tipY = first.py - uy * gapBeforeDot;
      const tailX = tipX - ux * shaftLen;
      const tailY = tipY - uy * shaftLen;

      const ah = Math.min(8, Math.max(5, len * 0.2));
      const aw = Math.min(6, Math.max(3.5, len * 0.14));
      const leftX = tipX - ux * ah + nx * aw;
      const leftY = tipY - uy * ah + ny * aw;
      const rightX = tipX - ux * ah - nx * aw;
      const rightY = tipY - uy * ah - ny * aw;
      // Extend shaft into arrowhead base so shaft and head connect with no gap.
      const shaftEndX = tipX - ux * (ah - 2.5);
      const shaftEndY = tipY - uy * (ah - 2.5);

      ctx.strokeStyle = "#16A34A";
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(shaftEndX, shaftEndY);
      ctx.lineTo(leftX, leftY);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(rightX, rightY);
      ctx.stroke();
    }
  }

  el.previewMeta.textContent = `Well Ø ${WELL_DIAM_MM.toFixed(1)} mm | Grid ${gridWmm.toFixed(2)} x ${gridHmm.toFixed(2)} mm`;
}

function syncRowsAndPreview() {
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

async function saveGcode() {
  const sx = safeFloat(el.startX.value);
  const sy = safeFloat(el.startY.value);
  const nd = safeInt(el.dots.value);
  const dx = safeFloat(el.spacingX.value);
  const dy = safeFloat(el.spacingY.value);
  const lz = safeFloat(el.lowerZ.value);
  const uz = safeFloat(el.upperZ.value);
  const wn = el.wellNumber.value.trim();
  const pr = safeInt(el.perRow.value);
  const extrusionE = safeFloat(el.extrusionE.value);

  if (!wn) return (el.saveStatus.textContent = "Error: Well number required.");
  if (nd <= 0 || pr <= 0) return (el.saveStatus.textContent = "Error: Dots and Dots Per Row must be > 0.");
  if (lz < 0 || uz < 0) return (el.saveStatus.textContent = "Error: Z offsets cannot be negative.");
  if (extrusionE <= 0) return (el.saveStatus.textContent = "Error: Extrusion per dot (E) must be greater than 0.");

  const contents = buildGcode({
    startX: sx,
    startY: sy,
    numDots: nd,
    spacingX: dx,
    spacingY: dy,
    lowerZ: lz,
    upperZ: uz,
    wellNumber: wn,
    dotsPerRow: pr,
    annotate: el.annotate.checked,
    extrusionE,
  });

  const result = await window.gcodeApi.saveGcode({
    defaultFileName: `well_${wn}_Z${lz.toFixed(2)}.txt`,
    contents,
  });
  el.saveStatus.textContent = result.cancelled ? "Save cancelled." : `Saved: ${result.path}`;
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

populateWells();
setDefaultsFromCurrentWell();
drawPreview();
updateEcalc();

el.well.addEventListener("change", () => {
  el.wellNumber.value = el.well.value;
  setDefaultsFromCurrentWell();
  drawPreview();
});
el.startAtCenter.addEventListener("change", () => {
  setDefaultsFromCurrentWell();
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
  setDefaultsFromCurrentWell();
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

el.canvas.addEventListener("click", (event) => {
  const rect = el.canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  let closest = null;
  let best = Number.POSITIVE_INFINITY;
  dotPositions.forEach((d) => {
    const dist = Math.hypot(d.px - x, d.py - y);
    if (dist < 15 && dist < best) {
      best = dist;
      closest = d;
    }
  });
  if (closest) {
    el.coordLabel.textContent = `Dot: X = ${closest.absX.toFixed(3)} mm | Y = ${closest.absY.toFixed(3)} mm`;
  } else {
    el.coordLabel.textContent = "Click a dot to see coordinates";
  }
});
