const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("appInfo", {
  name: "G-Code Generator (Electron Prototype)",
});

contextBridge.exposeInMainWorld("gcodeApi", {
  saveGcode: (payload) => ipcRenderer.invoke("save-gcode", payload),
});
