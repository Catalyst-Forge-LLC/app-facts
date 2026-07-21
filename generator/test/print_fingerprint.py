#!/usr/bin/env python3
"""Print inputs_fingerprint for a target path (used by Node cross-runtime tests)."""
import importlib.util
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("g", root / "generate_app_facts.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
target = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root / "test" / "fixtures" / "mini-repo"
print(mod.inputs_fingerprint(mod.detect_repo_facts(target)), end="")
