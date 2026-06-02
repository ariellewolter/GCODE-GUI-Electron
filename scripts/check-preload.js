#!/usr/bin/env node
const { app, BrowserWindow } = require("electron");
const path = require("path");

delete process.env.ELECTRON_RUN_AS_NODE;

const projectRoot = path.join(__dirname, "..");
const preloadPath = path.join(projectRoot, "electron", "preload.js");
const indexPath = path.join(projectRoot, "electron", "renderer", "index.html");

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.webContents.on("preload-error", (_event, preloadPathArg, error) => {
    console.error("preload-error:", preloadPathArg, error.message || error);
  });

  await win.loadFile(indexPath);
  await new Promise((resolve) => setTimeout(resolve, 500));

  const report = await win.webContents.executeJavaScript(`
    ({
      gcodeApi: typeof window.gcodeApi,
      saveGcode: typeof window.gcodeApi?.saveGcode,
      GcodeCore: typeof window.GcodeCore,
      appInfo: typeof window.appInfo,
    })
  `);

  console.log(JSON.stringify(report, null, 2));
  app.quit();
});
