const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gcodeApi", {
  saveGcode: (payload) => ipcRenderer.invoke("save-gcode", payload),
  saveGcodeFiles: (payload) => ipcRenderer.invoke("save-gcode-files", payload),
});

contextBridge.exposeInMainWorld(
  "appInfo",
  ipcRenderer.sendSync("get-app-info-sync") || { name: "G-Code Generator", version: "development" }
);
