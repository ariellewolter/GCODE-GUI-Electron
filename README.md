# G-Code Generator - 24 Well Plate

A GUI application for generating G-code for bioprinting dot patterns in 24-well plates.

## Features

- **24-Well Plate Support**: Pre-configured positions for all 24 wells (A1-D6)
- **Well Position Dropdown**: Quick selection of well positions with automatic coordinate population
- **Custom Positioning**: Manual override for X and Y coordinates
- **Configurable Parameters**:
  - Number of dots
  - Dots per row
  - Dot spacing (X and Y axis)
  - Z-height settings (lower and upper)
- **Safe Travel Height**: Z5 travel height to prevent nozzle from digging into gels
- **Auto-Generated Filenames**: Filenames include well number and Z-height for easy identification

## Installation

### Requirements

- Python 3.12+ with Tkinter 9.0
- macOS (tested on macOS Sequoia)

### Install Python 3.12 with Tkinter (via Homebrew)

```bash
brew install python-tk@3.12
```

### Install PyInstaller (for building standalone app)

```bash
/opt/homebrew/bin/python3.12 -m pip install pyinstaller --break-system-packages
```

## Usage

### Running the Application

```bash
/opt/homebrew/bin/python3.12 gcodegenerator_variable_dots_per_row.py
```

### Building Standalone App

```bash
chmod +x build_app.sh
./build_app.sh
```

Or manually:

```bash
/opt/homebrew/bin/python3.12 -m PyInstaller gcode_generator.spec --clean --noconfirm
```

The packaged app will be in `dist/GCode Generator - 24 Well.app`

## Default Parameters

- **Number of Dots**: 100
- **Dots Per Row**: 10
- **Dot Spacing X**: 0.3 mm
- **Dot Spacing Y**: 1.5 mm
- **Lower Z**: 2.35 mm
- **Upper Z**: 2.40 mm

## Well Plate Coordinates

The 24-well plate coordinates are pre-configured with precise X,Y positions for each well (A1-D6). You can also select "Custom" to enter manual coordinates.

## Generated G-Code Features

- Units in millimeters
- Absolute positioning
- Relative extruder mode
- Customizable extrusion parameters
- Dwell times for precise placement
- Safe travel height between dots

## License

MIT License

## Author

Arielle Wolter

