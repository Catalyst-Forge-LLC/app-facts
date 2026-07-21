/**
 * af1 compact payload round-trip — see SPEC-af1.md
 * Run: node --test generator/test/af1_roundtrip.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildViewerPayload,
  encodeViewerHash,
  decodeViewerHash,
  viewerUrlFor,
  VIEWER_PREFIX,
  MAX_VIEWER_URL_LEN,
} = require("../viewer_codec.js");

const SAMPLE_FM = {
  name: "Demo",
  type: "web app (SSR)",
  status: "active",
  license: "MIT",
  stack: { language: "TypeScript", framework: "SvelteKit" },
  key_dependencies: [
    { name: "@sveltejs/kit", purpose: "SSR framework" },
    { name: "stripe", purpose: "Billing" },
  ],
  services: [
    { name: "Stripe", role: "Billing" },
    { name: "PostHog", role: "Analytics" },
  ],
  build: { package_manager: "pnpm", ci: "GitHub Actions" },
  homepage: "https://example.com",
  repository: "https://github.com/acme/demo",
};

describe("af1 compact payload", () => {
  it("builds the documented compact schema keys", () => {
    const p = buildViewerPayload(SAMPLE_FM);
    assert.equal(p.v, 1);
    for (const k of ["name", "type", "status", "license", "stack", "deps"]) {
      assert.ok(k in p, `missing ${k}`);
    }
    assert.equal(p.deps[0].n, "@sveltejs/kit");
    assert.equal(p.deps[0].p, "SSR framework");
    assert.equal(p.svc[0].n, "Stripe");
    assert.equal(p.svc[0].r, "Billing");
    assert.equal(p.homepage, SAMPLE_FM.homepage);
    assert.equal(p.repository, SAMPLE_FM.repository);
  });

  it("round-trips encode → decode", () => {
    const payload = buildViewerPayload(SAMPLE_FM);
    const hash = encodeViewerHash(payload);
    assert.ok(hash.startsWith(VIEWER_PREFIX));
    assert.ok(!hash.includes("="), "base64url padding must be stripped");
    const decoded = decodeViewerHash(hash);
    assert.deepEqual(decoded, payload);
    const fromUrl = decodeViewerHash(`https://appfacts.dev/v#${hash}`);
    assert.deepEqual(fromUrl, payload);
  });

  it("viewerUrlFor stays within the documented URL ceiling", () => {
    const url = viewerUrlFor(SAMPLE_FM);
    assert.ok(url.startsWith("https://appfacts.dev/v#af1."));
    assert.ok(url.length <= MAX_VIEWER_URL_LEN);
    const decoded = decodeViewerHash(url);
    assert.equal(decoded.name, "Demo");
    assert.equal(decoded.v, 1);
  });

  it("rejects unknown afN prefixes with an update message", () => {
    assert.throws(
      () => decodeViewerHash("af99.eNqAAAA"),
      /not supported|update your viewer/i,
    );
  });
});
