/**
 * Ensures renderer.js does not call gcode-core exports as bare globals
 * unless they are destructured from GcodeCore or wrapped locally.
 */
const fs = require("fs");
const path = require("path");

const core = require(path.join(__dirname, "..", "electron", "shared", "gcode-core.js"));
const rendererPath = path.join(__dirname, "..", "electron", "renderer", "renderer.js");
const src = fs.readFileSync(rendererPath, "utf8");

const importMatch = src.match(/const\s*\{([\s\S]*?)\}\s*=\s*GcodeCore;/);
if (!importMatch) {
  console.error("check-renderer-core-imports: could not find GcodeCore import block");
  process.exit(1);
}

const imported = new Set();
for (const line of importMatch[1].split(",")) {
  const trimmed = line.replace(/\/\/.*$/, "").trim();
  if (!trimmed) continue;
  const alias = trimmed.match(/:\s*(\w+)\s*$/);
  imported.add(alias ? alias[1] : trimmed);
}

const localFns = new Set([...src.matchAll(/^function\s+(\w+)/gm)].map((m) => m[1]));

const bodyStart = importMatch.index + importMatch[0].length;
const body = src.slice(bodyStart);
const exported = Object.keys(core);
const problems = [];

for (const key of exported) {
  if (imported.has(key) || localFns.has(key)) continue;

  const re = new RegExp(`\\b${key}\\b`, "g");
  let match;
  while ((match = re.exec(body)) !== null) {
    const index = bodyStart + match.index;
    const before = src[index - 1];
    if (before === ".") continue;
    const line = src.slice(0, index).split("\n").length;
    problems.push({ key, line });
  }
}

if (problems.length) {
  console.error("renderer.js uses gcode-core exports without importing them:\n");
  for (const { key, line } of problems) {
    console.error(`  ${key} (line ${line})`);
  }
  process.exit(1);
}

console.log("renderer.js: all gcode-core export usages are imported or wrapped locally");
