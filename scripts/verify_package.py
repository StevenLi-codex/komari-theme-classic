#!/usr/bin/env python3
"""Verify native Komari ZIP paths, asset hashes, licenses and checksum."""
import hashlib
import json
import pathlib
import re
import zipfile
root = pathlib.Path(__file__).resolve().parent.parent
path = root / "theme.zip"
with zipfile.ZipFile(path) as archive:
    assert archive.testzip() is None
    members = archive.infolist()
    names = {m.filename for m in members}
    assert len(names) == len(members) < 10000
    assert {"komari-theme.json", "dist/index.html", "preview.png", "LICENSE", "THIRD_PARTY.md", "THIRD_PARTY_NOTICES.txt"} <= names
    assert not any("demo" in n or n.startswith("/") or ".." in pathlib.PurePosixPath(n).parts for n in names)
    assert not any(n.startswith("komari-classic/") for n in names)
    assert sum(m.file_size for m in members) < 64 * 1024**2
    assert all(m.file_size < 8 * 1024**2 and (m.external_attr >> 16) & 0o170000 != 0o120000 for m in members)
    manifest = json.loads(archive.read("komari-theme.json"))
    assert manifest["short"] == "komari-classic"
    assert manifest == json.loads((root / "komari-theme.json").read_text())
    html = archive.read("dist/index.html").decode()
    for kind, ext in [("main", "js"), ("styles", "css")]:
        match = re.search(r"/themes/komari-classic/dist/assets/(" + kind + r"\.[0-9a-f]{16}\." + ext + r")", html)
        assert match, "Missing namespaced hashed assets"
        filename = match.group(1)
        data = archive.read("dist/assets/" + filename)
        assert hashlib.sha256(data).hexdigest().startswith(filename.split(".")[1])
        assert b"Tokyo-01" not in data
    assert f'content="{manifest["version"]}"' in html
    assert hashlib.sha256(path.read_bytes()).hexdigest() == (root / "theme.zip.sha256").read_text().split()[0]
    print(f"PASS: native Komari theme.zip, version {manifest['version']}, {len(members)} files")
