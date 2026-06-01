const { contextBridge, ipcRenderer } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");

const CORE_PATH = path.join(__dirname, "shared", "gcode-core.js");

function bridgeCoreExports(core) {
  const api = {};
  for (const key of Object.keys(core)) {
    const value = core[key];
    if (typeof value === "function") {
      api[key] = (...args) => value(...args);
    } else {
      api[key] = value;
    }
  }
  return api;
}

function safeExpose(key, value) {
  try {
    contextBridge.exposeInMainWorld(key, value);
  } catch (err) {
    console.error(`preload: expose ${key} failed`, err);
  }
}

// Expose script URL first (keys must not start with underscore in Electron).
safeExpose("gcodeCoreScriptSrc", pathToFileURL(CORE_PATH).href);

let coreLoadError = null;
try {
  const core = require(CORE_PATH);
  safeExpose("GcodeCore", bridgeCoreExports(core));
} catch (err) {
  coreLoadError = err;
  console.error("preload: failed to load gcode-core", err);
}

if (coreLoadError) {
  safeExpose("GcodeCoreLoadError", coreLoadError.stack || String(coreLoadError));
}

safeExpose("appInfo", { name: "G-Code Generator" });

safeExpose("gcodeApi", {
  saveGcode: (payload) => ipcRenderer.invoke("save-gcode", payload),
  saveGcodeFiles: (payload) => ipcRenderer.invoke("save-gcode-files", payload),
});
