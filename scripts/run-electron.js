#!/usr/bin/env node
/**
 * Launch Electron without ELECTRON_RUN_AS_NODE leaking from Cursor/VS Code terminals.
 */
const { spawnSync } = require("child_process");
const path = require("path");

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const projectRoot = path.join(__dirname, "..");
const electronPath = require("electron");
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
