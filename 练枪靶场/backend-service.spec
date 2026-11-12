# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path

root = Path.cwd()
datas = [(str(root / name), '.') for name in (
    'index.html', 'style.css', 'app.js', 'range-loader.js',
    'range-targets.js', 'training-coach.js', 'saltline-original.html',
    'raw_mouse.py', '使用说明.md'
)]
a = Analysis(['backend.py'], pathex=[str(root)], binaries=[], datas=datas,
             hiddenimports=['raw_mouse'], hookspath=[], hooksconfig={},
             runtime_hooks=[], excludes=[], noarchive=False, optimize=1)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, a.binaries, a.datas, [], name='range-backend',
          debug=False, bootloader_ignore_signals=False, strip=False, upx=False,
          console=True, disable_windowed_traceback=False)
