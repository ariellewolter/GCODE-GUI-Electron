# -*- mode: python ; coding: utf-8 -*-
"""
Universal PyInstaller spec for G-code Generator
Builds for BOTH Intel (x86_64) and Apple Silicon (arm64)
Requires Python from python.org (universal2 build)
"""

block_cipher = None

a = Analysis(
    ['gcode_generator.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[
        'tkinter',
        'tkinter.ttk',
        'tkinter.filedialog',
        'tkinter.messagebox',
        'tkinter.constants',
        'tkinter.font',
        '_tkinter',
        'datetime',
        'math',
        'copy',
        'os',
        'json',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

# ONE-FILE MODE: Bundle everything into the executable
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,      # Include binaries in exe
    a.zipfiles,      # Include zipfiles in exe
    a.datas,         # Include data files in exe
    [],
    name='GCode Generator',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,  # Disable UPX - can break tkinter
    console=False,  # No console window
    disable_windowed_traceback=False,
    argv_emulation=True,  # Required for macOS drag-and-drop
    target_arch='universal2',  # BUILD FOR BOTH Intel and Apple Silicon
    codesign_identity=None,
    entitlements_file=None,
)

# Create macOS .app bundle
app = BUNDLE(
    exe,
    name='GCode Generator.app',
    icon=None,
    bundle_identifier='com.ariellewolter.gcodegenerator',
    info_plist={
        'NSPrincipalClass': 'NSApplication',
        'NSHighResolutionCapable': 'True',
        'CFBundleShortVersionString': '3.0',
        'CFBundleVersion': '3.0.0',
        'CFBundleName': 'GCode Generator',
        'LSMinimumSystemVersion': '10.13.0',
        'NSRequiresAquaSystemAppearance': False,
        'CFBundleDocumentTypes': [],
        'LSArchitecturePriority': ['arm64', 'x86_64'],  # Prefer native architecture
    },
)

