/**
 * Cross-runtime fingerprint fixture — see SPEC.md “Fingerprint canonicalization”
 * Run: node --test generator/test/fingerprint.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { detectRepoFacts, inputsFingerprint, enrichData } from "../generate_app_facts.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(here, "fixtures", "mini-repo");

function pythonFingerprint(fixture) {
  const script = path.join(here, "print_fingerprint.py");
  const errors = [];
  for (const bin of ["python", "python3"]) {
    const proc = spawnSync(bin, [script, fixture], {
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    if (proc.status === 0) return proc.stdout.trim();
    errors.push(`${bin}: status=${proc.status} err=${proc.stderr || proc.error || ""}`);
  }
  throw new Error("Could not run print_fingerprint.py:\n" + errors.join("\n"));
}

describe("inputs_fingerprint", () => {
  it("is 16 lowercase hex chars for the mini-repo fixture", () => {
    const facts = detectRepoFacts(FIXTURE);
    const fp = inputsFingerprint(facts);
    assert.match(fp, /^[a-f0-9]{16}$/);
    assert.ok(facts.envTemplates[".env.example"]);
    assert.ok(facts.envTemplates[".env.example"].includes("STRIPE_SECRET_KEY"));
    assert.ok(facts.envKeys.includes("DATABASE_URL"));
  });

  it("uses package.json name@versionRange form (not the prompt summary)", () => {
    const facts = detectRepoFacts(FIXTURE);
    const fpForm = facts.fpManifests["package.json"];
    assert.ok(fpForm.includes("fastify@^5.0.0"));
    assert.ok(fpForm.includes("zod@^3.23.0"));
    assert.ok(fpForm.includes("vitest@^2.0.0"));
    // Prompt summary must not leak into the fingerprint channel
    assert.ok(!fpForm.includes("structured package.json summary"));
    assert.ok(facts.manifests["package.json"].includes("structured package.json summary"));
  });

  it("matches the Python generator on the same fixture", () => {
    const jsFp = inputsFingerprint(detectRepoFacts(FIXTURE));
    assert.equal(pythonFingerprint(FIXTURE), jsFp);
  });

  it("changes when a tracked env-template key set changes", () => {
    const before = inputsFingerprint(detectRepoFacts(FIXTURE));
    const facts = detectRepoFacts(FIXTURE);
    facts.envTemplates[".env.example"] = [...facts.envTemplates[".env.example"], "NEW_KEY_FOR_TEST"].sort();
    assert.notEqual(inputsFingerprint(facts), before);
  });

  it("enrichData fills language:unknown for empty stack", () => {
    const out = enrichData({ stack: {}, status: "active" }, { gitRemote: null, root: FIXTURE });
    assert.deepEqual(out.stack, { language: "unknown" });
  });
});
