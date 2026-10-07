/**
 * electron-builder 25.1.8 passes the .p12 password to
 * `security set-key-partition-list -k`, which must be the temporary
 * keychain password. macOS 26 runners reject the wrong password.
 * Remove this once electron-builder includes the upstream fix.
 */
const fs = require("fs");
const path = require("path");

const file = path.join(
  __dirname,
  "../node_modules/app-builder-lib/out/codeSign/macCodeSign.js"
);
let source = fs.readFileSync(file, "utf8");

const already =
  "importCerts(keychainFile, certPaths, cscPasswords, keychainPassword)";
if (source.includes(already)) {
  console.log("electron-builder keychain patch already applied");
  process.exit(0);
}

const replacements = [
  [
    "return await importCerts(keychainFile, certPaths, cscPasswords);",
    "return await importCerts(keychainFile, certPaths, cscPasswords, keychainPassword);",
  ],
  [
    "async function importCerts(keychainFile, paths, keyPasswords) {",
    "async function importCerts(keychainFile, paths, keyPasswords, keychainPassword) {",
  ],
  [
    '["set-key-partition-list", "-S", "apple-tool:,apple:", "-s", "-k", password, keychainFile]',
    '["set-key-partition-list", "-S", "apple-tool:,apple:", "-s", "-k", keychainPassword, keychainFile]',
  ],
];

for (const [from, to] of replacements) {
  if (!source.includes(from)) {
    console.error("Could not patch electron-builder; macOS signing code changed.");
    process.exit(1);
  }
  source = source.replace(from, to);
}

fs.writeFileSync(file, source);
console.log("Patched electron-builder to unlock the signing keychain with its own password.");
