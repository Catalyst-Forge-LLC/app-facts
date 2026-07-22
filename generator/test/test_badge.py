"""Badge HTML — Python helpers (cross-check with Node in badge.test.js)."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from badge import (  # noqa: E402
    label_value_text,
    render_badge_html,
    render_badge_markdown,
    stack_summary_line,
)

SAMPLE_URL = "https://appfacts.dev/v#af1.eNpTestPayload"
FM_TYPE = "SaaS web app"
FM_STACK = {"language": "TypeScript", "framework": "React", "database": "Postgres"}


class BadgeTests(unittest.TestCase):
    def test_stack_summary(self):
        self.assertEqual(
            stack_summary_line(FM_STACK),
            "TypeScript · React · Postgres",
        )

    def test_label_value(self):
        self.assertEqual(label_value_text({"type": FM_TYPE}), FM_TYPE)
        self.assertEqual(label_value_text({}), "view label")

    def test_variants_normative(self):
        for v in ("pill", "label", "card"):
            html = render_badge_html(v, SAMPLE_URL, type=FM_TYPE, stack=FM_STACK)
            self.assertIn('style="all:unset;', html)
            self.assertIn('aria-label="View this project\'s AppFacts label"', html)
            self.assertIn(SAMPLE_URL, html)
            self.assertNotIn("YOUR_PAYLOAD", html)

    def test_markdown(self):
        md = render_badge_markdown(SAMPLE_URL, type=FM_TYPE, stack=FM_STACK)
        self.assertIn("## Pill", md)
        self.assertIn("## Mini card", md)
        self.assertIn("React", md)


if __name__ == "__main__":
    unittest.main()
