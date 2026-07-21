#!/usr/bin/env python3
"""Python suite for af1 round-trip + fingerprint — see SPEC-af1.md / SPEC.md."""
from __future__ import annotations

import importlib.util
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIXTURE = Path(__file__).resolve().parent / "fixtures" / "mini-repo"

spec = importlib.util.spec_from_file_location("g", ROOT / "generate_app_facts.py")
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)

SAMPLE_FM = {
    "name": "Demo",
    "type": "web app (SSR)",
    "status": "active",
    "license": "MIT",
    "stack": {"language": "TypeScript", "framework": "SvelteKit"},
    "key_dependencies": [
        {"name": "@sveltejs/kit", "purpose": "SSR framework"},
        {"name": "stripe", "purpose": "Billing"},
    ],
    "services": [
        {"name": "Stripe", "role": "Billing"},
        {"name": "PostHog", "role": "Analytics"},
    ],
    "build": {"package_manager": "pnpm", "ci": "GitHub Actions"},
    "homepage": "https://example.com",
    "repository": "https://github.com/acme/demo",
}


class Af1RoundTrip(unittest.TestCase):
    def test_compact_schema_keys(self):
        p = g.build_viewer_payload(SAMPLE_FM)
        self.assertEqual(p["v"], 1)
        for k in ("name", "type", "status", "license", "stack", "deps"):
            self.assertIn(k, p)
        self.assertEqual(p["deps"][0]["n"], "@sveltejs/kit")
        self.assertEqual(p["deps"][0]["p"], "SSR framework")
        self.assertEqual(p["svc"][0]["n"], "Stripe")
        self.assertEqual(p["svc"][0]["r"], "Billing")

    def test_round_trip(self):
        payload = g.build_viewer_payload(SAMPLE_FM)
        h = g.encode_viewer_hash(payload)
        self.assertTrue(h.startswith(g.VIEWER_PREFIX))
        self.assertNotIn("=", h)
        decoded = g.decode_viewer_hash(h)
        self.assertEqual(decoded, payload)
        self.assertEqual(g.decode_viewer_hash(f"https://appfacts.dev/v#{h}"), payload)

    def test_url_ceiling(self):
        url = g.viewer_url_for(SAMPLE_FM)
        self.assertTrue(url.startswith("https://appfacts.dev/v#af1."))
        self.assertLessEqual(len(url), g.MAX_VIEWER_URL_LEN)

    def test_rejects_unknown_afn(self):
        with self.assertRaisesRegex(ValueError, r"not supported|update your viewer"):
            g.decode_viewer_hash("af99.eNqAAAA")


class Fingerprint(unittest.TestCase):
    def test_hex16(self):
        fp = g.inputs_fingerprint(g.detect_repo_facts(FIXTURE))
        self.assertRegex(fp, r"^[a-f0-9]{16}$")
        facts = g.detect_repo_facts(FIXTURE)
        self.assertIn("STRIPE_SECRET_KEY", facts["env_templates"][".env.example"])

    def test_matches_node(self):
        py_fp = g.inputs_fingerprint(g.detect_repo_facts(FIXTURE))
        js_helper = ROOT / "test" / "print_fingerprint.js"
        proc = subprocess.run(
            ["node", str(js_helper), str(FIXTURE)],
            capture_output=True, text=True,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(proc.stdout.strip(), py_fp)

    def test_changes_when_env_keys_change(self):
        before = g.inputs_fingerprint(g.detect_repo_facts(FIXTURE))
        facts = g.detect_repo_facts(FIXTURE)
        facts["env_templates"][".env.example"] = sorted(
            facts["env_templates"][".env.example"] + ["NEW_KEY_FOR_TEST"]
        )
        after = g.inputs_fingerprint(facts)
        self.assertNotEqual(before, after)

    def test_enrich_empty_stack_fallback(self):
        out = g.enrich_data({"stack": {}, "status": "active"}, {"git_remote": None, "root": FIXTURE})
        self.assertEqual(out["stack"], {"language": "unknown"})


if __name__ == "__main__":
    unittest.main()
