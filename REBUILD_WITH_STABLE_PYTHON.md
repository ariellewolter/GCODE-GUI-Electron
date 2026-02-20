# Rebuilding with Stable Python Version

## Current Issue

The app was built with **Python 3.14.0**, which is a development/pre-release version. This may cause compatibility issues on other Macs.

## Recommended Solution

Rebuild the app with a **stable Python version** (3.12 or 3.13) for better compatibility.

## Option 1: Install Stable Python from python.org

1. **Download Python 3.12 or 3.13:**
   - Go to: https://www.python.org/downloads/
   - Download the **macOS universal installer** (NOT Homebrew version)
   - Install it (installs to `/Library/Frameworks/Python.framework/`)

2. **Rebuild the app:**
   ```bash
   cd /Users/ariellewolter/Desktop/GCODE_GUI
   
   # Use the python.org Python instead of Homebrew
   /Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -m pip install pyinstaller
   
   # Build with stable Python
   /Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -m PyInstaller gcode_generator_standalone.spec
   ```

## Option 2: Use Homebrew Python 3.12 or 3.13

If available in Homebrew:

```bash
# Install Python 3.12 via Homebrew
brew install python@3.12

# Use it to build
/opt/homebrew/bin/python3.12 -m pip install pyinstaller
/opt/homebrew/bin/python3.12 -m PyInstaller gcode_generator_standalone.spec
```

## Option 3: Test Current Build First

Before rebuilding, test the current build on:
- Different Mac models
- Different macOS versions
- Both Apple Silicon and Intel Macs

If it works everywhere, you may not need to rebuild.

## Why This Matters

- **Stable Python versions** (3.10-3.12) have better PyInstaller support
- **Development versions** (3.14+) may have incomplete compatibility
- **Distribution stability** is important for sharing with others
- **Code signing** isn't affected, but runtime compatibility is

## Current Status

✅ App works on your Mac (Python 3.14.0)
⚠️ May have issues on other Macs
⚠️ PyInstaller may not fully support 3.14 yet

## Recommendation

**For maximum compatibility:** Rebuild with Python 3.12 or 3.13 from python.org

**For quick testing:** Try the current build on a few different Macs first
