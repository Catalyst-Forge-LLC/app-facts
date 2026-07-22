#!/usr/bin/env python3
"""Print badge HTML for cross-runtime tests.

Usage: print_badge.py <variant> <url> <opts.json>
opts.json: { "type": "...", "stack": { ... } }
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from badge import render_badge_html

variant, url, opts_path = sys.argv[1:4]
opts = json.loads(Path(opts_path).read_text(encoding="utf-8"))
html = render_badge_html(
    variant,
    url,
    type=opts.get("type"),
    stack=opts.get("stack"),
)
# Binary write so Windows does not translate LF → CRLF (markup must stay LF).
sys.stdout.buffer.write(html.encode("utf-8"))
