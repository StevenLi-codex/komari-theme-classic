#!/usr/bin/env python3
"""Package the theme for Monitor Hub's *upload* endpoint.

Important: the Hub extracts directly into its staging directory and requires
`theme.json` and `dist/index.html` at that root.  Do NOT add the theme's short
name as an archive prefix: the Hub creates `<themes>/<short>` itself.
"""
import hashlib
import json
import pathlib
import tarfile
import gzip
import io

root = pathlib.Path(__file__).resolve().parent.parent
manifest = json.loads((root / "theme.json").read_text(encoding="utf-8"))
assert manifest["short"] == "x86-monitor"
include = ["theme.json", "preview.png", "LICENSE", "THIRD_PARTY.md", "THIRD_PARTY_NOTICES.txt", "dist"]
out = root / "theme.tar.gz"
with out.open("wb") as raw, gzip.GzipFile(fileobj=raw, mode="wb", filename="", mtime=0) as compressed, tarfile.open(fileobj=compressed, mode="w", format=tarfile.USTAR_FORMAT) as archive:
    for name in include:
        path = root / name
        if not path.exists():
            raise FileNotFoundError(f"Missing required package input: {path}")
        files = sorted(path.rglob("*")) if path.is_dir() else [path]
        for file in files:
            if file.is_symlink():
                raise ValueError(f"Symlinks are not allowed: {file}")
            if not file.is_file():
                continue
            if file.name == "demo.html" or file.name.startswith("demo."):
                continue
            data = file.read_bytes()
            info = tarfile.TarInfo(file.relative_to(root).as_posix())
            info.size = len(data)
            info.mode = 0o644
            info.mtime = 0
            archive.addfile(info, io.BytesIO(data))

# Fail the build rather than uploading another archive which can't install.
with tarfile.open(out, "r:gz") as archive:
    entries = {member.name for member in archive.getmembers() if member.isfile()}
    assert "theme.json" in entries, "Manifest MUST be at archive root"
    assert "dist/index.html" in entries, "HTML MUST be at archive root/dist/"
    assert not any(name.startswith(manifest["short"] + "/") for name in entries)
print(f"Created {out.name}: {out.stat().st_size:,} bytes")
print("SHA256:", hashlib.sha256(out.read_bytes()).hexdigest())
(root / "theme.tar.gz.sha256").write_text(hashlib.sha256(out.read_bytes()).hexdigest() + "  theme.tar.gz\n", encoding="utf-8")
