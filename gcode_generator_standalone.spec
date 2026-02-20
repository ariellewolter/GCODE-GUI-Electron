# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['gcode_generator.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[],
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

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='GCode Generator',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='GCode Generator',
)

app = BUNDLE(
    coll,
    name='GCode Generator.app',
    icon=None,
    bundle_identifier='com.gcodegenerator.24well',
    info_plist={
        'NSHighResolutionCapable': 'True',
        'CFBundleShortVersionString': '1.0.0',
        'CFBundleIconFile': '',  # Remove icon reference to use default
    },
)
