#!/usr/bin/env python3
"""Compatibility entry: capture the current standalone demo preview."""
from pathlib import Path
import subprocess
root = Path(__file__).resolve().parent.parent
raise SystemExit(subprocess.call(['node', 'scripts/capture-previews.mjs'], cwd=root))
