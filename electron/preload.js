const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gcodeApi", {
  saveGcode: (payload) => ipcRenderer.invoke("save-gcode", payload),
  saveGcodeFiles: (payload) => ipcRenderer.invoke("save-gcode-files", payload),
});

contextBridge.exposeInMainWorld("appInfo", { name: "G-Code Generator" });
