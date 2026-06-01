const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");

const CONFIG_FILE = path.join(os.homedir(), ".gcode_generator_config.json");

function loadLastPath() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, "utf8");
      const data = JSON.parse(raw);
      return data.last_save_dir || os.homedir();
    }
  } catch (_err) {
    // Ignore config parse/read errors; fallback to home.
  }
  return os.homedir();
}

function saveLastPath(lastSaveDir) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ last_save_dir: lastSaveDir }));
  } catch (_err) {
    // Ignore write errors.
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, "renderer", "index.html"));

  win.webContents.once("did-finish-load", () => {
    win.show();
    win.focus();
  });
}

app.whenReady().then(() => {
  ipcMain.handle("save-gcode", async (_event, payload) => {
    if (!payload || typeof payload.defaultFileName !== "string" || typeof payload.contents !== "string") {
      return { cancelled: false, error: true, message: "Invalid save payload." };
    }
    const { defaultFileName, contents } = payload;
    const response = await dialog.showSaveDialog({
      title: "Save G-code as",
      defaultPath: path.join(loadLastPath(), defaultFileName),
      filters: [{ name: "G-code files", extensions: ["txt"] }],
    });

    if (response.canceled || !response.filePath) {
      return { cancelled: true };
    }

    try {
      fs.writeFileSync(response.filePath, contents, "utf8");
    } catch (err) {
      return { cancelled: false, error: true, message: err.message || String(err) };
    }
    saveLastPath(path.dirname(response.filePath));
    return { cancelled: false, path: response.filePath };
  });

  ipcMain.handle("save-gcode-files", async (_event, payload) => {
    if (!payload || !Array.isArray(payload.files) || payload.files.length === 0) {
      return { cancelled: false, error: true, message: "No files to save." };
    }
    for (const file of payload.files) {
      if (!file || typeof file.fileName !== "string" || typeof file.contents !== "string") {
        return { cancelled: false, error: true, message: "Invalid file entry in save payload." };
      }
    }
    const { files } = payload;
    const response = await dialog.showOpenDialog({
      title: "Choose folder for per-well G-code files",
      defaultPath: loadLastPath(),
      properties: ["openDirectory", "createDirectory"],
    });

    if (response.canceled || !response.filePaths?.[0]) {
      return { cancelled: true };
    }

    const dir = response.filePaths[0];
    const paths = [];
    try {
      files.forEach(({ fileName, contents }) => {
        const filePath = path.join(dir, fileName);
        fs.writeFileSync(filePath, contents, "utf8");
        paths.push(filePath);
      });
    } catch (err) {
      paths.forEach((filePath) => {
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (_unlinkErr) {
          // Best-effort rollback if a later file fails.
        }
      });
      return { cancelled: false, error: true, message: err.message || String(err), paths: [] };
    }
    saveLastPath(dir);
    return { cancelled: false, dir, paths };
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
