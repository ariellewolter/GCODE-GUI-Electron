#!/bin/bash

APP_NAME="GCode Generator"
APP_DIR="$HOME/Desktop/GCODE_GUI/${APP_NAME}.app"
SCRIPT_DIR="$HOME/Desktop/GCODE_GUI"

# Remove old app if exists
rm -rf "$APP_DIR"

# Create app structure
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

# Create launcher script
cat > "$APP_DIR/Contents/MacOS/${APP_NAME}" << 'LAUNCHER'
#!/bin/bash
cd "$HOME/Desktop/GCODE_GUI"
exec python3 gcode_generator.py
LAUNCHER

chmod +x "$APP_DIR/Contents/MacOS/${APP_NAME}"

# Create Info.plist
cat > "$APP_DIR/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>GCode Generator</string>
    <key>CFBundleIdentifier</key>
    <string>com.gcode.generator</string>
    <key>CFBundleName</key>
    <string>GCode Generator</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.9</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSUIElement</key>
    <false/>
</dict>
</plist>
PLIST

echo "App created at: $APP_DIR"
echo "You can now double-click 'GCode Generator.app' in Finder"
