/**
 * Product spelling for a label heading.
 * A FilePress site title wins, then the xFacts family name, then a short README heading.
 * The npm package name is not the heading: efficacy-workspace and get-ember-dossier are slugs.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const FAMILY = {
  "app-facts": "AppFacts",
  "agent-facts": "AgentFacts",
  "feature-facts": "FeatureFacts",
  "model-facts": "ModelFacts",
  "skill-facts": "SkillFacts",
  "tool-facts": "ToolFacts",
  "x-facts": "xFacts",
};

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "examples"]);

function foldName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function sameProduct(current, title) {
  const left = foldName(current);
  const right = foldName(title);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.endsWith("workspace") && left.slice(0, -"workspace".length) === right) return true;
  if (left.startsWith("get") && left.slice(3) === right) return true;
  return false;
}

function walkConfigs(dir, depth, out) {
  if (depth > 3) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkConfigs(full, depth + 1, out);
    else if (/^filepress\.config\./.test(entry.name)) out.push(full);
  }
}

function configTitle(file) {
  const raw = readFileSync(file, "utf8");
  const match = raw.match(/^\s*title:\s*['"]([^'"]+)['"]/m);
  return match ? match[1].trim() : "";
}

export function productTitle(root) {
  const configs = [];
  walkConfigs(root, 0, configs);
  const titles = configs
    .map((file) => ({ file: file.replaceAll("\\", "/"), title: configTitle(file) }))
    .filter((item) => item.title);
  const preferred = titles.find((item) => /\/site\/filepress\.config\./.test(item.file))
    || titles.find((item) => !/\/sites\/demo\//.test(item.file))
    || titles[0];
  if (preferred?.title) return preferred.title;
  const family = FAMILY[path.basename(root)];
  if (family) return family;
  const readme = path.join(root, "README.md");
  if (!existsSync(readme)) return "";
  const line = readFileSync(readme, "utf8").split(/\r?\n/).find((item) => item.startsWith("# "));
  const heading = line ? line.slice(2).trim() : "";
  if (/^[A-Za-z0-9][A-Za-z0-9 .'+-]{0,40}$/.test(heading) && !heading.includes(" - ")) return heading;
  return "";
}

/** Product label heading. A resolved title replaces the package slug. */
export function preferProductTitle(current, title) {
  const name = String(current || "").trim();
  if (!title) return name;
  return title;
}

function cap(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Skill heading. The product title replaces a matching slug.
 * A skill named after the product plus a suffix keeps the product spelling.
 * Any other lowercase hyphenated slug becomes separate words.
 */
export function skillLabelName(current, title) {
  const name = String(current || "").trim();
  if (!name) return name;
  if (title && sameProduct(name, title)) return title;
  const words = name.split(/[-_\s]+/).filter(Boolean);
  if (title && words.length > 1 && sameProduct(words[0], title)) {
    return `${title} ${words.slice(1).map(cap).join(" ")}`;
  }
  if (title && !/[A-Z]/.test(name) && /[-_]/.test(name)) return words.map(cap).join(" ");
  return name;
}

export { foldName, sameProduct };
