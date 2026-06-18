# G-Code Generator — Build Instructions (Electron)

This project ships as a **macOS Electron app** built with `electron-builder`. Releases are signed and notarized via GitHub Actions when you push a version tag.

## Requirements

- macOS (for building the universal `.app`)
- Node.js 22+ and npm

## Local development

```bash
npm ci
npm run electron
```

Run tests:

```bash
npm test
```

## Build a release locally

```bash
npm run dist:mac
```

Output in `dist-electron/`:

- `G-Code Generator-<version>-universal.dmg` — drag-to-Applications installer
- `G-Code.Generator-<version>-universal-mac.zip` — portable archive

Both targets are universal binaries (Apple Silicon + Intel).

### Local signing and notarization

CI handles signing automatically. For a signed local build, export these environment variables before `npm run dist:mac`:

- `CSC_LINK` — base64-encoded `.p12` certificate (or path to the file)
- `CSC_KEY_PASSWORD` — password for the `.p12`
- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` — for notarization

See `.github/SECRETS_SETUP.md` for details on obtaining these values.

## Release via GitHub Actions

1. Bump `version` in `package.json`.
2. Commit and push to `main`.
3. Tag and push:

```bash
git tag v2.0.19
git push origin main --tags
```

Pushing a `v*` tag runs `.github/workflows/release-macos.yml`, which builds the DMG and ZIP, signs/notarizes when secrets are configured, auto-generates release notes, and uploads assets to GitHub Releases.

Required GitHub secrets: `MACOS_CERT_P12`, `MACOS_CERT_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.

Upload secrets from a local file:

```bash
cp .github/secrets.env.example .github/secrets.env
# fill in values, then:
./scripts/setup-github-secrets.sh
```

## Legacy Python / PyInstaller builds

The repository still contains older Python/Tkinter build scripts (`gcode_generator.py`, `build_universal.sh`, `build_portable.sh`, PyInstaller specs). Those are **not** used for current Electron releases. Use them only if you maintain the legacy stack separately.
