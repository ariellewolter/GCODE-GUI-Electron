#!/bin/bash

echo "======================================"
echo "G-Code Generator - Portable Build"
echo "======================================"
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install/upgrade PyInstaller
echo "Installing PyInstaller..."
pip install --upgrade pip
pip install pyinstaller

echo ""
echo "Building portable macOS app..."
echo ""

# Clean previous builds
rm -rf build dist

# Build using the portable spec
pyinstaller gcode_generator_portable.spec --clean

echo ""
echo "======================================"
echo "Build Complete!"
echo "======================================"
echo ""

if [ -d "dist/GCode Generator.app" ]; then
    echo "✅ SUCCESS!"
    echo ""
    echo "Your portable app is at:"
    echo "dist/GCode Generator.app"
    echo ""
    echo "This .app bundle includes ALL dependencies (including tkinter)"
    echo "and will run on other Macs without requiring Python installation."
    echo ""
    echo "To test: Double-click the .app"
    echo "To distribute: Zip the .app and share it"
    echo ""
else
    echo "❌ Build failed. Check errors above."
    echo ""
fi

