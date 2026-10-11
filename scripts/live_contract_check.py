#!/usr/bin/env python3
"""Compatibility entry: run browser checks against the simulated Hub contract."""
from pathlib import Path
import subprocess
root = Path(__file__).resolve().parent.parent
raise SystemExit(subprocess.call(['node', 'node_modules/@playwright/test/cli.js', 'test', 'tests/ui/hub.spec.ts'], cwd=root))
