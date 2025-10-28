#!/bin/bash

echo "======================================"
echo "G-Code Generator - Universal Build"
echo "Intel + Apple Silicon (universal2)"
echo "======================================"
echo ""

# Check for universal Python
echo "Checking Python architecture..."
PYTHON_ARCH=$(file $(which python3) | grep -o "arm64\|x86_64\|universal" | sort -u | tr '\n' ' ')
echo "Current Python supports: $PYTHON_ARCH"
echo ""

# Check if we have python.org universal Python
UNIVERSAL_PYTHON="/Library/Frameworks/Python.framework/Versions/3.14/bin/python3"
UNIVERSAL_PYTHON_ALT="/Library/Frameworks/Python.framework/Versions/3.13/bin/python3"
UNIVERSAL_PYTHON_ALT2="/Library/Frameworks/Python.framework/Versions/3.12/bin/python3"

if [ -f "$UNIVERSAL_PYTHON" ]; then
    PYTHON_BIN="$UNIVERSAL_PYTHON"
    echo "✅ Found universal Python 3.14 from python.org"
elif [ -f "$UNIVERSAL_PYTHON_ALT" ]; then
    PYTHON_BIN="$UNIVERSAL_PYTHON_ALT"
    echo "✅ Found universal Python 3.13 from python.org"
elif [ -f "$UNIVERSAL_PYTHON_ALT2" ]; then
    PYTHON_BIN="$UNIVERSAL_PYTHON_ALT2"
    echo "✅ Found universal Python 3.12 from python.org"
else
    echo "❌ No universal Python found!"
    echo ""
    echo "To build a universal app that works on both Intel and Apple Silicon:"
    echo "1. Download Python from https://www.python.org/downloads/"
    echo "2. Install the macOS universal installer (NOT Homebrew)"
    echo "3. Run this script again"
    echo ""
    echo "OR"
    echo ""
    echo "Use build_portable.sh to build for ARM64 only (works on Apple Silicon Macs)"
    echo "Intel Macs can still run it via Rosetta 2 translation."
    exit 1
fi

echo "Using: $PYTHON_BIN"
echo ""

# Create fresh virtual environment with universal Python
if [ -d "venv_universal" ]; then
    echo "Removing old universal venv..."
    rm -rf venv_universal
fi

echo "Creating universal virtual environment..."
"$PYTHON_BIN" -m venv venv_universal

# Activate it
source venv_universal/bin/activate

# Install PyInstaller
echo "Installing PyInstaller..."
pip install --upgrade pip
pip install pyinstaller

echo ""
echo "Building universal macOS app..."
echo ""

# Clean previous builds
rm -rf build dist

# Build with universal2 target
pyinstaller gcode_generator_universal.spec --clean

echo ""
echo "======================================"
echo "Build Complete!"
echo "======================================"
echo ""

if [ -d "dist/GCode Generator.app" ]; then
    echo "✅ SUCCESS!"
    echo ""
    echo "Checking architecture..."
    file "dist/GCode Generator.app/Contents/MacOS/GCode Generator"
    echo ""
    echo "Your UNIVERSAL app is at:"
    echo "dist/GCode Generator.app"
    echo ""
    echo "This app will run natively on:"
    echo "  • Apple Silicon Macs (M1, M2, M3, M4)"
    echo "  • Intel Macs"
    echo ""
    echo "To distribute: Zip the .app and share it"
    echo ""
else
    echo "❌ Build failed. Check errors above."
    echo ""
fi

deactivate

