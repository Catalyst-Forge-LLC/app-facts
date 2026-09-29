import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { preferProductTitle, productTitle, skillLabelName } from "../product_title.js";

describe("product title", () => {
  it("reads the FilePress site title and ignores a workspace package name", () => {
    const root = mkdtempSync(path.join(tmpdir(), "product-title-"));
    mkdirSync(path.join(root, "site"));
    writeFileSync(path.join(root, "site", "filepress.config.ts"), "export default {\n  title: 'EmberDossier',\n}\n");
    writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "get-ember-dossier" }));
    assert.equal(productTitle(root), "EmberDossier");
    assert.equal(preferProductTitle("get-ember-dossier", productTitle(root)), "EmberDossier");
  });

  it("skips the demo site when the product site has a title", () => {
    const root = mkdtempSync(path.join(tmpdir(), "product-title-"));
    mkdirSync(path.join(root, "sites", "demo"), { recursive: true });
    mkdirSync(path.join(root, "sites", "getfilepress"), { recursive: true });
    writeFileSync(path.join(root, "sites", "demo", "filepress.config.ts"), "title: 'Demo'\n");
    writeFileSync(path.join(root, "sites", "getfilepress", "filepress.config.ts"), "title: 'FilePress'\n");
    assert.equal(productTitle(root), "FilePress");
  });

  it("names a skill after the product spelling", () => {
    assert.equal(skillLabelName("ember-dossier", "EmberDossier"), "EmberDossier");
    assert.equal(skillLabelName("docupuncture-docs", "DocuPuncture"), "DocuPuncture Docs");
    assert.equal(skillLabelName("cold-eye", "Cold-eye"), "Cold-eye");
    assert.equal(skillLabelName("clarify-first", "TemperPass"), "Clarify First");
  });
});
