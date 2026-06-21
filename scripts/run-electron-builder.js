#!/usr/bin/env node
/**
 * Run electron-builder without ELECTRON_RUN_AS_NODE leaking from Cursor/VS Code terminals.
 */
const { spawnSync } = require("child_process");
const path = require("path");

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const projectRoot = path.join(__dirname, "..");
const builderBin = require.resolve("electron-builder/cli.js");
const args = process.argv.slice(2);
const result = spawnSync(process.execPath, [builderBin, ...args], {
  cwd: projectRoot,
  env,
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message || result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
