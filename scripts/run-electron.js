#!/usr/bin/env node
/**
 * Launch Electron without ELECTRON_RUN_AS_NODE leaking from Cursor/VS Code terminals.
 */
const { spawnSync } = require("child_process");
const path = require("path");

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const projectRoot = path.join(__dirname, "..");
const electronPath = process.platform === "win32"
  ? path.join(projectRoot, "node_modules", "electron", "dist", "electron.exe")
  : require("electron");

if (process.platform === "win32") {
  // ShellExecute succeeds on Windows installations that block direct
  // child_process spawning of Electron's unsigned development binary.
  const psQuote = (value) => `'${String(value).replaceAll("'", "''")}'`;
  const launchScript = `Start-Process -FilePath ${psQuote(electronPath)} -ArgumentList '.' -WorkingDirectory ${psQuote(projectRoot)}`;
  const launch = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", launchScript],
    { cwd: projectRoot, env, stdio: "inherit" }
  );
  if (launch.error) {
    console.error(launch.error.message || launch.error);
    process.exit(1);
  }
  process.exit(launch.status ?? 1);
}

const result = spawnSync(electronPath, ["."], {
  cwd: projectRoot,
  env,
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message || result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
