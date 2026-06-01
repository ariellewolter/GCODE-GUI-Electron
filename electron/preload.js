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

let coreLoadError = null;
try {
  const core = require(CORE_PATH);
  contextBridge.exposeInMainWorld("GcodeCore", bridgeCoreExports(core));
} catch (err) {
  coreLoadError = err;
  console.error("preload: failed to load gcode-core", err);
}

contextBridge.exposeInMainWorld("__gcodeCoreScriptSrc", pathToFileURL(CORE_PATH).href);
if (coreLoadError) {
  contextBridge.exposeInMainWorld(
    "GcodeCoreLoadError",
    coreLoadError.stack || String(coreLoadError)
  );
}

contextBridge.exposeInMainWorld("appInfo", {
  name: "G-Code Generator",
});

contextBridge.exposeInMainWorld("gcodeApi", {
  saveGcode: (payload) => ipcRenderer.invoke("save-gcode", payload),
  saveGcodeFiles: (payload) => ipcRenderer.invoke("save-gcode-files", payload),
});
