const { contextBridge, ipcRenderer } = require("electron");
const path = require("path");

const GcodeCore = require(path.join(__dirname, "shared", "gcode-core.js"));

contextBridge.exposeInMainWorld("GcodeCore", GcodeCore);

contextBridge.exposeInMainWorld("appInfo", {
  name: "G-Code Generator",
});

contextBridge.exposeInMainWorld("gcodeApi", {
  saveGcode: (payload) => ipcRenderer.invoke("save-gcode", payload),
  saveGcodeFiles: (payload) => ipcRenderer.invoke("save-gcode-files", payload),
});
