/**
 * Badge HTML — JS ≡ Python, and site/badge/render.js stays a byte copy.
 * Run: node --test generator/test/badge.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const os = require("os");
const {
  renderBadgeHtml,
  renderBadgeMarkdown,
  stackSummaryLine,
  labelValueText,
} = require("../badge.js");

const ROOT = path.resolve(__dirname, "../..");
const SAMPLE_URL =
  "https://appfacts.dev/v#af1.eNpNkU1qwzAQha8iZpWSOCZ0E7wLgZSWJKQ_m1JKUeyJLCpLQhob3JBzdd-TdWS3kJXQzDfvPY3O0EGxmIGVDUIBK-83sqQIM6Dep0r0WIpckHNGW8X1SJLayB3mdIdcMbpEGxO8u38ZifITijMYaVUrVeo8yE4-l0F7ElNx6Kl2lsnQWtKD8d5VKBbLqfj5_muL2_lyyoxnMamSdwFfGFxWoY9i4Af2dbXbsmZEZR3jtYs0wmvj2upkZEBx4BARLjNIs1C8ncEyMM4mC74MMqfgLDWSCIOYjDFueGzE_x0S_fgkDvu7K-Z9BsdWmyo9e0yMH420fATGvfZiotBikOSCcNb0SZfDNujHBdVEPhZ5Lr0_pR-YV9ilDaF3UfNQf8UoTXV7nJeuydeSpOkjZRsXFGbb7TopZIMEXH4BQlmeJw";
const FM = {
  type: "web app (SSR)",
  stack: { language: "TypeScript", framework: "SvelteKit", database: "Postgres" },
};

function pyRender(variant, url, fm) {
  const script = path.join(__dirname, "print_badge.py");
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

  it("site/badge/render.js matches generator/badge.js", () => {
    const a = fs.readFileSync(path.join(ROOT, "generator/badge.js"), "utf8");
    const b = fs.readFileSync(path.join(ROOT, "site/badge/render.js"), "utf8");
    assert.equal(b, a, "copy generator/badge.js → site/badge/render.js after edits");
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
