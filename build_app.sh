#!/bin/bash

echo "======================================"
echo "G-Code Generator - Build Script"
echo "======================================"
echo ""

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed."
    echo "Please install Python 3 from https://www.python.org/"
    exit 1
fi

echo "Step 1: Installing PyInstaller..."
pip3 install pyinstaller

echo ""
echo "Step 2: Building macOS application..."
pyinstaller gcode_generator.spec --clean

echo ""
echo "======================================"
echo "Build Complete!"
echo "======================================"
echo ""
echo "Your application is located at:"
echo "dist/GCode Generator - 24 Well.app"
echo ""
echo "You can now:"
echo "1. Double-click to run it"
echo "2. Move it to your Applications folder"
echo "3. Share it with others"
echo ""

