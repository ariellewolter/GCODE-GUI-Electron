const fs = require("fs");
const path = require("path");

const GcodeCore = require("../electron/shared/gcode-core.js");

const outDir = path.join(__dirname, "..", "electron", "data");
const jsonPath = path.join(outDir, "well-starts.json");
const txtPath = path.join(outDir, "well-starts.txt");

function roundCoord(value) {
  return Number(Number(value).toFixed(2));
}

function mapCoords(record) {
  const mapped = {};
  GcodeCore.sortWellKeys(Object.keys(record)).forEach((wellKey) => {
    const [x, y] = record[wellKey];
    mapped[wellKey] = { x: roundCoord(x), y: roundCoord(y) };
  });
  return mapped;
}

const plates = {};
const lines = [
  "G-Code Generator — stored well starts",
  `Generated: ${new Date().toISOString()}`,
  "",
];

GcodeCore.PLATE_TYPE_OPTIONS.forEach(({ id, label }) => {
  const plate = GcodeCore.getPlateType(id);
  const starts = mapCoords(GcodeCore.getWellStarts(id));
  const centers = mapCoords(GcodeCore.getWellCenters(id));

  plates[id] = {
    id,
    label,
    wellDiamMm: plate.wellDiamMm,
    rowKeys: plate.rowKeys,
    colKeys: plate.colKeys,
    starts,
    centers,
  };

  lines.push(`${label} (${id}) — well diameter ${plate.wellDiamMm} mm`);
  lines.push("Well starts (X, Y mm):");
  Object.entries(starts).forEach(([wellKey, { x, y }]) => {
    lines.push(`  ${wellKey}\t${x.toFixed(2)}\t${y.toFixed(2)}`);
  });
  lines.push("Well centers (X, Y mm):");
  Object.entries(centers).forEach(([wellKey, { x, y }]) => {
    lines.push(`  ${wellKey}\t${x.toFixed(2)}\t${y.toFixed(2)}`);
  });
  lines.push("");
});

const payload = {
  generatedAt: new Date().toISOString(),
  source: "electron/shared/gcode-core.js",
  centerOffsetFromStart: {
    x: roundCoord(GcodeCore.CENTER_OFFSET_FROM_START[0]),
    y: roundCoord(GcodeCore.CENTER_OFFSET_FROM_START[1]),
  },
  plates,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
fs.writeFileSync(txtPath, `${lines.join("\n")}\n`, "utf8");

console.log(`wrote ${jsonPath}`);
console.log(`wrote ${txtPath}`);
