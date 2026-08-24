const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");

const CONFIG_FILE = path.join(os.homedir(), ".gcode_generator_config.json");
const APP_ICON_PATH = path.join(__dirname, "assets", "icon.png");

let mainWindow = null;

function resolvePreloadPath() {
  const bundled = path.join(__dirname, "preload.js");
  if (fs.existsSync(bundled)) return path.resolve(bundled);

  const unpacked = path.join(
    process.resourcesPath,
    "app.asar.unpacked",
    "electron",
    "preload.js"
  );
  if (fs.existsSync(unpacked)) return unpacked;

  return path.resolve(bundled);
}

function parentWindowFromEvent(event) {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win && !win.isDestroyed() ? win : mainWindow;
}

function applyAppIcon() {
  if (!fs.existsSync(APP_ICON_PATH)) return;
  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(APP_ICON_PATH);
  }
}

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
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    icon: APP_ICON_PATH,
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const target = new URL(url);
    if (target.protocol !== "file:") event.preventDefault();
  });

  mainWindow.webContents.on("preload-error", (_event, preloadPath, error) => {
    console.error("preload failed:", preloadPath, error?.message || error);
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  mainWindow.webContents.once("did-finish-load", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  app.setAppUserModelId("com.ariellewolter.gcodegui");
  ipcMain.on("get-app-info-sync", (event) => {
    event.returnValue = { name: app.getName(), version: app.getVersion() };
  });
  ipcMain.handle("save-gcode", async (event, payload) => {
    if (!payload || typeof payload.defaultFileName !== "string" || typeof payload.contents !== "string") {
      return { cancelled: false, error: true, message: "Invalid save payload." };
    }
    const { defaultFileName, contents } = payload;
    const safeFileName = path.basename(defaultFileName);
    if (!safeFileName || safeFileName === "." || safeFileName === "..") {
      return { cancelled: false, error: true, message: "Invalid file name." };
    }
    const parentWindow = parentWindowFromEvent(event);
    if (parentWindow) parentWindow.focus();
    const response = await dialog.showSaveDialog(parentWindow, {
      title: "Save G-code as",
      defaultPath: path.join(loadLastPath(), safeFileName),
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

  ipcMain.handle("save-gcode-files", async (event, payload) => {
    if (!payload || !Array.isArray(payload.files) || payload.files.length === 0) {
      return { cancelled: false, error: true, message: "No files to save." };
    }
    for (const file of payload.files) {
      if (!file || typeof file.fileName !== "string" || typeof file.contents !== "string") {
        return { cancelled: false, error: true, message: "Invalid file entry in save payload." };
      }
    }
    const { files } = payload;
    const parentWindow = parentWindowFromEvent(event);
    if (parentWindow) parentWindow.focus();
    const response = await dialog.showOpenDialog(parentWindow, {
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
        const safeName = path.basename(fileName);
        if (!safeName || safeName === "." || safeName === "..") {
          throw new Error(`Invalid file name: ${fileName}`);
        }
        const filePath = path.join(dir, safeName);
        fs.writeFileSync(filePath, contents, "utf8");
        paths.push(filePath);
      });
    } catch (err) {
      const writtenPaths = [...paths];
      writtenPaths.forEach((filePath) => {
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (_unlinkErr) {
          // Best-effort rollback if a later file fails.
        }
      });
      return {
        cancelled: false,
        error: true,
        message: err.message || String(err),
        paths: writtenPaths,
      };
    }
    saveLastPath(dir);
    return { cancelled: false, dir, paths };
  });

  applyAppIcon();
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
