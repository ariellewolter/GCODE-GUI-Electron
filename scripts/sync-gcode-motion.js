const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "electron", "shared", "gcode-motion.js");
const dest = path.join(__dirname, "..", "electron", "renderer", "gcode-motion.js");

fs.copyFileSync(src, dest);
console.log("synced gcode-motion.js -> electron/renderer/");
