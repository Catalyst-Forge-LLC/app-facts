/**
 * Badge HTML — JS ≡ Python. site/badge/render.js is the browser copy;
 * compare rendered HTML, not the module wrapper.
 * Run: node --test generator/test/badge.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import os from "node:os";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import {
  renderBadgeHtml,
  renderBadgeMarkdown,
  stackSummaryLine,
  labelValueText,
} from "../badge.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../..");
const SAMPLE_URL =
  "https://appfacts.dev/v#af1.eNpNkU1qwzAQha8iZpWSOCZ0E7wLgZSWJKQ_m1JKUeyJLCpLQhob3JBzdd-TdWS3kJXQzDfvPY3O0EGxmIGVDUIBK-83sqQIM6Dep0r0WIpckHNGW8X1SJLayB3mdIdcMbpEGxO8u38ZifITijMYaVUrVeo8yE4-l0F7ElNx6Kl2lsnQWtKD8d5VKBbLqfj5_muL2_lyyoxnMamSdwFfGFxWoY9i4Af2dbXbsmZEZR3jtYs0wmvj2upkZEBx4BARLjNIs1C8ncEyMM4mC74MMqfgLDWSCIOYjDFueGzE_x0S_fgkDvu7K-Z9BsdWmyo9e0yMH420fATGvfZiotBikOSCcNb0SZfDNujHBdVEPhZ5Lr0_pR-YV9ilDaF3UfNQf8UoTXV7nJeuydeSpOkjZRsXFGbb7TopZIMEXH4BQlmeJw";
const FM = {
  type: "web app (SSR)",
  stack: { language: "TypeScript", framework: "SvelteKit", database: "Postgres" },
};

function pyRender(variant, url, fm) {
  const script = path.join(here, "print_badge.py");
  const optsPath = path.join(os.tmpdir(), `appfacts-badge-opts-${process.pid}.json`);
  fs.writeFileSync(optsPath, JSON.stringify(fm));
  const errors = [];
  try {
    for (const bin of ["python", "python3"]) {
      const proc = spawnSync(bin, [script, variant, url, optsPath], {
        encoding: "utf8",
        shell: process.platform === "win32",
      });
      if (proc.status === 0) return proc.stdout;
      errors.push(`${bin}: status=${proc.status} err=${proc.stderr || proc.error || ""}`);
    }
  } finally {
    try { fs.unlinkSync(optsPath); } catch { /* ignore */ }
  }
  throw new Error("Could not run print_badge.py:\n" + errors.join("\n"));
}

describe("badge helpers", () => {
  it("stackSummaryLine takes first 3 values", () => {
    assert.equal(
      stackSummaryLine(FM.stack),
      "TypeScript · SvelteKit · Postgres",
    );
  });

  it("labelValueText prefers type", () => {
    assert.equal(labelValueText(FM), "web app (SSR)");
    assert.equal(labelValueText({}), "view label");
  });

  it("each variant starts with all:unset and has aria-label", () => {
    for (const v of ["pill", "label", "card"]) {
      const html = renderBadgeHtml(v, SAMPLE_URL, FM);
      assert.match(html, /style="all:unset;/);
      assert.match(html, /aria-label="View this project's AppFacts label"/);
      assert.ok(html.includes(SAMPLE_URL) || html.includes("appfacts.dev/v#af1."));
      assert.ok(!html.includes("YOUR_PAYLOAD"));
      assert.ok(!html.includes("PLACEHOLDER"));
    }
  });

  it("JS and Python produce byte-identical HTML", () => {
    for (const v of ["pill", "label", "card"]) {
      const js = renderBadgeHtml(v, SAMPLE_URL, FM);
      const py = pyRender(v, SAMPLE_URL, FM);
      assert.equal(py, js, `mismatch for ${v}`);
    }
  });

  it("site/badge/render.js produces the same HTML", () => {
    const src = fs.readFileSync(path.join(ROOT, "site/badge/render.js"), "utf8");
    const sandbox = {};
    vm.runInNewContext(src, sandbox);
    const site = sandbox.AppFactsBadge;
    assert.ok(site, "browser badge script did not set AppFactsBadge");
    for (const v of ["pill", "label", "card"]) {
      assert.equal(site.renderBadgeHtml(v, SAMPLE_URL, FM), renderBadgeHtml(v, SAMPLE_URL, FM));
    }
  });

  it("renderBadgeMarkdown includes all three variants", () => {
    const md = renderBadgeMarkdown(SAMPLE_URL, FM);
    assert.match(md, /^# AppFacts badge/m);
    assert.match(md, /## Pill/);
    assert.match(md, /## Label \+ value/);
    assert.match(md, /## Mini card/);
    assert.ok(md.includes("SvelteKit"));
  });
});
