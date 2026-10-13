#!/usr/bin/env python3
"""Reproducible native Komari ZIP, manifest at root, HTML at dist/."""
import hashlib
import json
import pathlib
import zipfile
root = pathlib.Path(__file__).resolve().parent.parent
manifest = json.loads((root / "komari-theme.json").read_text())
assert manifest["short"] == "komari-classic"
out = root / "theme.zip"
with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name in ["komari-theme.json", "preview.png", "LICENSE", "THIRD_PARTY.md", "THIRD_PARTY_NOTICES.txt", "dist"]:
        path = root / name
        if not path.exists():
            raise FileNotFoundError(path)
        files = sorted(path.rglob("*")) if path.is_dir() else [path]
        for file in files:
            if file.is_symlink():
                raise ValueError(f"Symlink: {file}")
            if not file.is_file() or file.name == "demo.html" or file.name.startswith("demo."):
                continue
            info = zipfile.ZipInfo(file.relative_to(root).as_posix(), (1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, file.read_bytes(), compresslevel=9)
checksum = hashlib.sha256(out.read_bytes()).hexdigest()
(root / "theme.zip.sha256").write_text(checksum + "  theme.zip\n")
print(f"Created {out.name}: {out.stat().st_size} bytes; SHA256 {checksum}")
