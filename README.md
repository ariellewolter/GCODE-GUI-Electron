# G-Code Generator v3.1

A professional G-code generator for 24-well plate bioprinting applications with live visual preview and comprehensive features.

## Features

### Core Functionality
- 🎯 **24-Well Plate Presets** - Quick selection of standard well positions (A1-D6)
- 📐 **Customizable Dot Patterns** - Configure number of dots, spacing, and rows
- 🔍 **Live Visual Preview** - Real-time canvas showing dot placement in well
- 🔎 **Zoom Control** - 50-200% zoom for detailed inspection
- 📍 **Clickable Dots** - Click any dot to see exact X/Y coordinates
- 📏 **Visual Spacing Indicators** - Orange/green arrows showing ΔX and ΔY measurements

### Advanced Features
- ⚙️ **Calibration Panel** - Collapsible editor for all 24-well positions
- 📝 **Code Annotations** - Optional inline comments explaining each G-code command
- 💾 **Persistent Settings** - Remembers last save directory
- ↺ **Reset Functions** - Reset individual calibrations or all fields
- 🎨 **Modern UI** - Clean two-column layout with professional styling

### Technical
- ✅ Universal macOS binary (Intel x86_64 + Apple Silicon ARM64)
- ✅ All dependencies bundled (no Python installation required)
- ✅ Portable - runs on any Mac without setup

## Installation

### For Users
1. Download `GCode-Generator-v3.1-macOS-Universal.zip`
2. Unzip the file
3. Right-click `GCode Generator.app` → Open (first time only)
4. Use the app!

### For Developers

#### Requirements
- Python 3.12+ from python.org (universal2 installer)
- macOS 10.13+

#### Build Instructions

**Universal Binary (Intel + Apple Silicon):**
```bash
./build_universal.sh
```

**ARM64 Only (Apple Silicon):**
```bash
./build_portable.sh
```

The built app will be in `dist/GCode Generator.app`

## Usage

1. **Select Well Position** - Choose from A1-D6 presets or use Custom
2. **Configure Pattern:**
   - Number of dots
   - Dots per row
   - Spacing in X and Y directions
3. **Set Z Heights:**
   - Lower Z offset (above well bottom)
   - Upper Z offset (dispensing height)
4. **Preview** - Use zoom and click dots to verify positions
5. **Optional** - Check "Include code annotations" for educational output
6. **Save** - Click "Save G-code" to generate the file

## G-Code Output

### Standard Mode
```gcode
; === Dot 1 at X=37.55, Y=46.30 ===
G1 X37.55 Y46.30 F350
G4 P200
G1 Z3.28 F250
```

### Annotated Mode (Default)
```gcode
; === Dot 1 at X=37.55, Y=46.30 ===
G1 X37.55 Y46.30 F350  ; Move to dot position (X, Y) at 350 mm/min
G4 P200                ; Pause 200ms to stabilize
G1 Z3.28 F250          ; Move down to approach height at 250 mm/min
```

## Default Settings

- **Well Bottom Z:** 2.35 mm (built-in constant)
- **Lower Z Offset:** 1.5 mm above well bottom
- **Upper Z Offset:** 1.51 mm above well bottom
- **Well Diameter:** 15.6 mm (for 24-well plates)

## File Structure

```
gcode_generator.py              # Main application code
gcode_generator_universal.spec  # PyInstaller spec (universal)
gcode_generator_portable.spec   # PyInstaller spec (ARM64)
build_universal.sh              # Build script (universal binary)
build_portable.sh               # Build script (ARM64 only)
BUILD_INSTRUCTIONS.md           # Detailed build documentation
```

## Version History

### v3.1 (Current)
- Added code annotation feature with checkbox
- Improved dot clickability (larger dots, better detection)
- Added visual spacing indicators (ΔX, ΔY arrows)
- Enhanced coordinate display (bold red text)
- Annotations checked by default

### v3.0
- Complete rewrite with modern UI
- Added live visual preview with zoom
- Collapsible calibration panel
- Two-column layout
- Persistent settings (last save directory)
- Menu bar with About dialog

### Earlier Versions
- Basic 24-well plate support
- Simple form-based input

## License

© 2025 Arielle Wolter

## Support

For issues or questions, contact the developer or refer to `BUILD_INSTRUCTIONS.md` for technical details.

## Building for Distribution

See `BUILD_INSTRUCTIONS.md` for comprehensive build instructions, including:
- Setting up Python environment
- Creating universal vs ARM64-only builds
- Troubleshooting common issues
- Distribution best practices

