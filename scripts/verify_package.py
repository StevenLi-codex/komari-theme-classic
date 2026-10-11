#!/usr/bin/env python3
"""Check the publish artifact against the actual Monitor Hub extractor contract."""
import gzip
import json
import pathlib
import tarfile
import tempfile

root = pathlib.Path(__file__).resolve().parent.parent
path = root / "theme.tar.gz"
assert path.stat().st_size <= 32 * 1024**2, "Compressed package too large"
with path.open("rb") as f:
    assert f.read(2) == b"\x1f\x8b", "Not a gzip stream"
# Verify full gzip trailer/CRC, not just the tar entries.
with gzip.open(path, "rb") as f:
    while f.read(1048576):
        pass
with tarfile.open(path, "r:gz") as archive:
    members = archive.getmembers()
    assert len(members) <= 2000, "More than 2000 entries"
    assert all(m.isfile() or m.isdir() for m in members), "Unsupported tar member"
    assert all(m.size <= 8 * 1024**2 for m in members), "Oversized file"
    assert sum(m.size for m in members) <= 64 * 1024**2, "Expanded payload too large"
    names = {m.name for m in members if m.isfile()}
    assert {"theme.json", "dist/index.html", "preview.png", "LICENSE", "THIRD_PARTY.md", "THIRD_PARTY_NOTICES.txt"} <= names, "Wrong archive root"
    assert not any("demo" in n for n in names), "Demo payload must not be shipped"
    assert not any(n.startswith("x86-monitor/") for n in names), "Nested root directory"
    assert not any(n.startswith("/") or ".." in pathlib.PurePosixPath(n).parts for n in names), "Unsafe member path"
    # Mimic the Hub staging directory: files must exist at staging/{name}.
    with tempfile.TemporaryDirectory(prefix="x86-monitor-verify-") as temp:
        archive.extractall(temp, filter="data")
        staging = pathlib.Path(temp)
        assert (staging / "theme.json").is_file(), "Hub won't find theme.json"
        assert (staging / "dist/index.html").is_file(), "Hub won't find entry HTML"
        manifest = json.loads((staging / "theme.json").read_text(encoding="utf-8"))
        assert manifest["short"] == "x86-monitor"
        assert manifest["version"] == json.loads((root / "theme.json").read_text(encoding="utf-8"))["version"]
        html = (staging / "dist/index.html").read_text(encoding="utf-8")
        import re, hashlib
        js = re.search(r'/assets/(main\.[0-9a-f]{16}\.js)', html)
        css = re.search(r'/assets/(styles\.[0-9a-f]{16}\.css)', html)
        assert js and css, "Unhashed asset names will be cached for one year by Monitor Hub"
        for match in (js, css):
            filename = match.group(1)
            data = (staging / "dist/assets" / filename).read_bytes()
            assert hashlib.sha256(data).hexdigest().startswith(filename.split('.')[1]), "Asset content hash differs from filename"
        assert f'content="{manifest["version"]}"' in html, "Version marker missing"
        assert not b"Tokyo-01" in (staging / "dist/assets" / js.group(1)).read_bytes(), "Demo node dataset leaked into production"
        assert hashlib.sha256(path.read_bytes()).hexdigest() == (root / "theme.tar.gz.sha256").read_text().split()[0], "Package checksum mismatch"
        print(f"PASS: Hub-compatible theme.tar.gz, version {manifest['version']}, {len(members)} entries")
