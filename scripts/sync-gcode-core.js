const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "electron", "shared", "gcode-core.js");
const dest = path.join(__dirname, "..", "electron", "renderer", "gcode-core.js");

fs.copyFileSync(src, dest);
console.log("synced gcode-core.js -> electron/renderer/");
