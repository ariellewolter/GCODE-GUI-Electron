# G-Code Generator - Build Instructions

## Current Status ✅

Your app is **already built and working!** 
- Located at: `dist/GCode Generator.app`
- Architecture: **ARM64 (Apple Silicon)**
- Built with: **One-file mode** (all dependencies bundled)

## Distribution Options

### Option 1: Use Current ARM64 Build (Recommended ⭐)

**Pros:**
- ✅ Already built and ready to distribute
- ✅ Runs natively on Apple Silicon Macs (M1, M2, M3, M4)
- ✅ Works on Intel Macs via Rosetta 2 translation
- ✅ Includes ALL dependencies (tkinter, tcl/tk, Python)

**Cons:**
- ⚠️ Intel Macs need Rosetta 2 installed (most already have it)
- ⚠️ Slightly slower on Intel Macs (translation overhead)

**How to distribute:**
```bash
# Zip the app
cd dist
zip -r "GCode-Generator-v3.0-ARM64.zip" "GCode Generator.app"
```

---

### Option 2: Build Universal Binary (Intel + Apple Silicon)

**Pros:**
- ✅ Runs natively on BOTH Intel and Apple Silicon
- ✅ No Rosetta 2 needed
- ✅ Best performance on all Macs

**Cons:**
- ⚠️ Requires Python from python.org (not Homebrew)
- ⚠️ Larger file size (~2x)

**Steps:**

1. **Download Universal Python:**
   - Go to: https://www.python.org/downloads/
   - Download the **macOS universal installer** (not Homebrew!)
   - Install it (will install to `/Library/Frameworks/Python.framework/`)

2. **Build Universal App:**
   ```bash
   cd /Users/ariellewolter/Desktop/the_final_g-code/the_final_g_code
   ./build_universal.sh
   ```

3. **Verify it's universal:**
   ```bash
   file "dist/GCode Generator.app/Contents/MacOS/GCode Generator"
   # Should show: Mach-O universal binary with 2 architectures
   ```

---

## Quick Reference

| Script | Architecture | Best For |
|--------|-------------|----------|
| `build_portable.sh` | ARM64 only | Apple Silicon Macs (current) |
| `build_universal.sh` | Intel + ARM64 | Maximum compatibility |

## Checking What You Have

```bash
# Check your current Python
file $(which python3)

# Check your built app
file "dist/GCode Generator.app/Contents/MacOS/GCode Generator"
```

---

## Troubleshooting

### "The application is damaged" error on other Macs

This happens because macOS doesn't trust unsigned apps from the internet. Tell users to:

1. Right-click the app → "Open" (first time only)
2. Click "Open" in the dialog
3. Or run in Terminal:
   ```bash
   xattr -cr "/path/to/GCode Generator.app"
   ```

### "Package is incomplete or broken"

This means dependencies (like tkinter) weren't bundled. The new build scripts fix this by:
- Using one-file mode (everything in the .app)
- Including tkinter explicitly
- Bundling all tcl/tk libraries

---

## Recommendation

**For now:** Use the current ARM64 build (`build_portable.sh`). It works on 99% of Macs and is already done.

**If users complain:** Install python.org Python and rebuild with `build_universal.sh`.

