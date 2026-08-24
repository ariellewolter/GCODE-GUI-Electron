const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "electron", "shared", "pico-simulator.js");
const dest = path.join(__dirname, "..", "electron", "renderer", "pico-simulator.js");

fs.copyFileSync(src, dest);
console.log("synced pico-simulator.js -> electron/renderer/");
