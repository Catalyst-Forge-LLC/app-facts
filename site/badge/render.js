/**
 * Canonical AppFacts HTML badge snippets (BADGE_SPEC.md).
 * Keep byte-identical with generator/badge.py and site/badge/render.js.
 * No external CSS/images — all styles inline; root starts with all:unset.
 *
 * Dual load: Node (module.exports) and browser (globalThis.AppFactsBadge).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.AppFactsBadge = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function escHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** First 2–3 stack values joined with " · " (for mini card). */
  function stackSummaryLine(stack, max = 3) {
    if (!stack || typeof stack !== "object" || Array.isArray(stack)) return "";
    const vals = Object.values(stack)
      .filter((v) => v != null && String(v).trim() && String(v).toLowerCase() !== "unknown")
      .map((v) => String(v).trim())
      .slice(0, max);
    return vals.join(" · ");
  }

  /** Right-hand text for label+value badge. */
  function labelValueText(fm) {
    const t = fm && fm.type != null ? String(fm.type).trim() : "";
    if (t && t.length <= 40 && t.toLowerCase() !== "unknown") return t;
    return "view label";
  }

  /**
   * @param {"pill"|"label"|"card"} variant
   * @param {string} viewerUrl full https://appfacts.dev/v#af1.… URL
   * @param {{ type?: string, stack?: Record<string,string>, valueText?: string, stackLine?: string }} [opts]
   */
  function renderBadgeHtml(variant, viewerUrl, opts = {}) {
    const href = escHtml(viewerUrl);
    const aria = 'aria-label="View this project\'s AppFacts label"';

    if (variant === "pill") {
      return (
        `<a href="${href}"\n` +
        `   style="all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:7px;\n` +
        `   font:600 12px/1 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;\n` +
        `   padding:6px 11px;border-radius:999px;background:#0f1115;color:#e7ecf2;\n` +
        `   border:1px solid #2a323e;text-decoration:none;vertical-align:middle;"\n` +
        `   ${aria}>\n` +
        `  <span style="display:inline-flex;align-items:center;justify-content:center;\n` +
        `    width:14px;height:14px;border-radius:3px;flex:none;background:#3ecf9a;color:#052018;\n` +
        `    font:800 8px ui-monospace,monospace;">AF</span>\n` +
        `  <span>App&nbsp;Facts</span>\n` +
        `</a>`
      );
    }

    if (variant === "label") {
      const value = escHtml(opts.valueText || labelValueText(opts)).replace(/ /g, "&nbsp;");
      return (
        `<a href="${href}"\n` +
        `   style="all:unset;cursor:pointer;display:inline-flex;align-items:stretch;\n` +
        `   font:600 12px/1 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;\n` +
        `   border-radius:6px;overflow:hidden;text-decoration:none;vertical-align:middle;\n` +
        `   border:1px solid rgba(0,0,0,.12);"\n` +
        `   ${aria}>\n` +
        `  <span style="display:inline-flex;align-items:center;gap:5px;background:#0f1115;\n` +
        `    color:#e7ecf2;padding:6px 9px;">\n` +
        `    <span style="display:inline-flex;align-items:center;justify-content:center;\n` +
        `      width:13px;height:13px;border-radius:3px;flex:none;\n` +
        `      background:#3ecf9a;color:#052018;font:800 8px ui-monospace,monospace;">AF</span>App&nbsp;Facts</span>\n` +
        `  <span style="display:inline-flex;align-items:center;background:#3ecf9a;\n` +
        `    color:#052018;padding:6px 10px;font-weight:700;">${value}</span>\n` +
        `</a>`
      );
    }

    if (variant === "card") {
      const line = escHtml(opts.stackLine || stackSummaryLine(opts.stack) || "stack label");
      return (
        `<a href="${href}"\n` +
        `   style="all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:10px;\n` +
        `   font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;\n` +
        `   padding:10px 13px;border-radius:10px;background:#12151b;\n` +
        `   border:1px solid #262e3a;text-decoration:none;vertical-align:middle;"\n` +
        `   ${aria}>\n` +
        `  <span style="display:inline-flex;align-items:center;justify-content:center;\n` +
        `    width:26px;height:26px;border-radius:6px;flex:none;\n` +
        `    background:#3ecf9a;color:#052018;font:800 11px ui-monospace,monospace;">AF</span>\n` +
        `  <span style="display:inline-flex;flex-direction:column;justify-content:center;gap:2px;">\n` +
        `    <span style="color:#e7ecf2;font-weight:700;font-size:12px;line-height:1.1;">App Facts</span>\n` +
        `    <span style="color:#8b94a3;font-weight:500;font-size:10.5px;line-height:1.1;">${line}</span>\n` +
        `  </span>\n` +
        `</a>`
      );
    }

    throw new Error(`Unknown badge variant: ${variant} (use pill|label|card)`);
  }

  function renderBadgeMarkdown(viewerUrl, fm = {}) {
    const html = renderBadgeHtml("pill", viewerUrl, fm);
    const label = renderBadgeHtml("label", viewerUrl, fm);
    const card = renderBadgeHtml("card", viewerUrl, fm);
    return (
      `# AppFacts badge\n\n` +
      `Self-contained HTML (paste into a site footer or nav). ` +
      `Links to the portable label. GitHub README strips inline styles — ` +
      `use a hosted SVG badge when that endpoint ships.\n\n` +
      `## Pill\n\n${html}\n\n` +
      `## Label + value\n\n${label}\n\n` +
      `## Mini card\n\n${card}\n`
    );
  }

  return {
    escHtml,
    stackSummaryLine,
    labelValueText,
    renderBadgeHtml,
    renderBadgeMarkdown,
  };
});
