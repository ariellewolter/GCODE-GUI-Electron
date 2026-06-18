# G-Code Generator (Electron)

Desktop app for generating G-code for 24-well plate bioprinting, with live preview, multi-print, bulk print, and circle patterns.

**Current release:** v2.0.19 · macOS (Intel + Apple Silicon)

## Download and run (other Macs)

No Python or Node install is required for lab users.

1. Open **[Releases](https://github.com/ariellewolter/GCODE-GUI-Electron/releases)** and download the latest `G-Code Generator-*-universal.dmg` or `G-Code.Generator-*-mac.zip`.
2. Install the app:
   - **DMG:** Open the disk image and drag `G-Code Generator.app` to Applications.
   - **ZIP:** Unzip the archive.
3. **First launch only:** Right-click `G-Code Generator.app` → **Open** → **Open** (macOS Gatekeeper). After that you can double-click normally.
4. Configure your pattern, check the preview, then **Save G-code**.

The build is a **universal macOS app** (Apple Silicon and Intel). It is signed and notarized when CI secrets are configured, so it should run on other Macs without extra setup.

### What transfers between machines

| Item | Behavior |
|------|----------|
| App install | Copy the `.zip` / `.app` to each Mac |
| Last save folder | Stored per Mac in `~/.gcode_generator_config.json` |
| G-code output | Same inputs → same dot positions and formatting on every Mac |
| Network | Not required; everything runs locally |

### Platform support

| Platform | Status |
|----------|--------|
| macOS (Apple Silicon) | Supported via release DMG or ZIP |
| macOS (Intel) | Supported via universal release DMG or ZIP |
| Windows / Linux | Not available for the Electron app yet |

## Features

- **Standard print** — Grid patterns with live well preview
- **Multi print** — Multiple passes in the same well (add Print 3+), same or different pattern, optional Y offset, separate Z/E per pass, optional keep-pattern-metrics when changing wells
- **Bulk print** — One pattern applied across many wells
- **Circle print** — Dots on a circle inside a well
- **Validation** — Save blocked only when you press Save and settings are invalid; modal lists fields to fix
- **E-value calculator** — Optional helper; apply to Print 1 and each extra pass (Print 2, 3, …)
- **Annotations** — Optional commented G-code for teaching/debugging

## Quick usage

1. Choose a tab: Standard, Multi print, Bulk print, or Circle print.
2. Select the well and set start position, dots, rows, and spacing (or circle parameters).
3. Set **Lower Z**, **Upper Z**, and **Extrusion (E)** for each pass.
4. Confirm the preview (red dots = outside well; fix before saving).
5. Click the save button for your mode.

Exported coordinates use **2 decimal places** for X/Y/Z and **4** for E, matching the preview hover readout.

## Default settings

- **Well bottom Z:** 2.35 mm (constant in generated header)
- **Default lower Z offset:** 1.50 mm above well bottom
- **Default upper Z offset:** 1.51 mm above well bottom
- **Default extrusion (E):** 0.0105 per dot
- **Well diameter:** 14.5 mm (24-well plate geometry in app)

## For developers

### Requirements

- macOS (for building the signed/universal `.app`)
- Node.js 22+ and npm

### Setup

```bash
git clone https://github.com/ariellewolter/GCODE-GUI-Electron.git
cd GCODE-GUI-Electron
npm ci
```

### Run locally

```bash
npm run electron
```

### Tests

```bash
npm test
```

### Build macOS universal release (local)

```bash
npm run dist:mac
```

Output: `dist-electron/G-Code Generator-*-universal.dmg` and `dist-electron/G-Code.Generator-*-mac.zip`

### Release (CI)

Pushing a version tag triggers the GitHub Actions workflow (`.github/workflows/release-macos.yml`), which builds universal DMG and ZIP artifacts, signs/notarizes when secrets are set, auto-generates release notes, and uploads to Releases.

```bash
git tag v2.0.19
git push origin main --tags
```

Required GitHub secrets for signed releases: `MACOS_CERT_P12`, `MACOS_CERT_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.

## Project layout

```
electron/
  main.js           # Window, save dialogs, dock icon
  preload.js        # IPC bridge
  renderer/         # UI and preview
  shared/gcode-core.js   # Shared validation and geometry (also tested in Node)
electron-build/
  icon.icns         # macOS app icon
  entitlements.mac.plist
tests/
  gcode-core.test.js
```

## Legacy Python app

The repository still contains an older **Python / Tkinter** build (`gcode_generator.py`, `build_universal.sh`, PyInstaller specs). New development and releases use the **Electron** app above. Use the Python scripts only if you maintain that stack separately.

## License

© 2025–2026 Evonyx by Arielle Wolter

## Support

Open an issue on [GitHub](https://github.com/ariellewolter/GCODE-GUI-Electron/issues).
