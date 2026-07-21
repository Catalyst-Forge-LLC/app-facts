#!/usr/bin/env node
/**
 * generate_app_facts.js — draft an APP_FACTS.md for a repo using an LLM.
 * Providers: ollama (local), openai, anthropic, xai, gemini.
 * Requires Node >= 18 (built-in fetch). No npm dependencies.
 *
 * Usage:
 *   node generate_app_facts.js --provider ollama --model llama3.1
 *   node generate_app_facts.js --provider openai --model gpt-4o
 *   node generate_app_facts.js --provider anthropic --model claude-sonnet-4-6
 *   node generate_app_facts.js --provider xai --model grok-4
 *   node generate_app_facts.js --provider gemini --model gemini-2.5-pro
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const MANIFESTS = [
  "package.json", "pyproject.toml", "Cargo.toml", "go.mod",
  "Gemfile", "composer.json", "pubspec.yaml", "requirements.txt",
  "Pipfile", "setup.py", "setup.cfg", "deno.json", "deno.jsonc",
];
const LOCKFILE_PM = {
  "package-lock.json": "npm", "yarn.lock": "yarn", "pnpm-lock.yaml": "pnpm",
  "poetry.lock": "poetry", "Cargo.lock": "cargo", "go.sum": "go modules",
  "Gemfile.lock": "bundler", "composer.lock": "composer", "Pipfile.lock": "pipenv",
};
/** Non-manifest project signals useful when a repo has no package manager file. */
const SIGNAL_FILES = [
  "LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING",
  "SPEC.md", "CONTRIBUTING.md", "Makefile", "Justfile",
];
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "venv", ".venv", "__pycache__", "target"]);

// ---------- CLI args ----------

function parseArgs(argv) {
  const args = {
    path: ".", output: null, provider: "ollama", model: null,
    ollamaHost: "http://localhost:11434",
    consultingLink: null, consultingName: null, dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--path") args.path = next();
    else if (a === "--output") args.output = next();
    else if (a === "--provider") args.provider = next();
    else if (a === "--model") args.model = next();
    else if (a === "--ollama-host") args.ollamaHost = next();
    else if (a === "--consulting-link") args.consultingLink = next();
    else if (a === "--consulting-name") args.consultingName = next();
    else if (a === "--dry-run") args.dryRun = true;
  }
  if (!args.model) {
    console.error("Missing required --model <name>");
    process.exit(1);
  }
  return args;
}

// ---------- Repo scanning ----------

function readText(p, limit = 6000) {
  try {
    return fs.readFileSync(p, "utf8").slice(0, limit);
  } catch {
    return "";
  }
}

function collectManifests(dir, labelPrefix = "") {
  const found = {};
  for (const m of MANIFESTS) {
    const p = path.join(dir, m);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      found[labelPrefix + m] = readText(p);
    }
  }
  return found;
}

function detectPackageManager(dir) {
  for (const [lock, pm] of Object.entries(LOCKFILE_PM)) {
    if (fs.existsSync(path.join(dir, lock))) return pm;
  }
  return null;
}

function detectRepoFacts(root) {
  const facts = {
    manifests: {}, signals: {}, packageManager: null,
    readmeExcerpt: "", tree: [], hasCi: false, hasDocker: false, gitRemote: null,
  };

  Object.assign(facts.manifests, collectManifests(root));
  facts.packageManager = detectPackageManager(root);

  // One level of nested manifests (e.g. generator/requirements.txt, apps/web/package.json)
  for (const item of fs.readdirSync(root)) {
    if (item.startsWith(".") || SKIP_DIRS.has(item)) continue;
    const sub = path.join(root, item);
    if (!fs.statSync(sub).isDirectory()) continue;
    Object.assign(facts.manifests, collectManifests(sub, item + "/"));
    if (!facts.packageManager) facts.packageManager = detectPackageManager(sub);
  }

  for (const name of SIGNAL_FILES) {
    const p = path.join(root, name);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      facts.signals[name] = readText(p, 2000);
    }
  }

  for (const name of ["README.md", "readme.md", "Readme.md"]) {
    const p = path.join(root, name);
    if (fs.existsSync(p)) {
      facts.readmeExcerpt = readText(p, 3000);
      break;
    }
  }

  for (const item of fs.readdirSync(root)) {
    if (item.startsWith(".") || SKIP_DIRS.has(item)) continue;
    const isDir = fs.statSync(path.join(root, item)).isDirectory();
    facts.tree.push(item + (isDir ? "/" : ""));
  }

  facts.hasCi = fs.existsSync(path.join(root, ".github", "workflows"));
  facts.hasDocker = fs.existsSync(path.join(root, "Dockerfile")) || fs.existsSync(path.join(root, "docker-compose.yml"));

  try {
    facts.gitRemote = execSync("git remote get-url origin", { cwd: root, stdio: ["pipe", "pipe", "ignore"] })
      .toString().trim();
  } catch {
    facts.gitRemote = null;
  }

  return facts;
}

function hasEnoughEvidence(facts) {
  return Object.keys(facts.manifests).length > 0
    || Boolean(facts.readmeExcerpt)
    || Object.keys(facts.signals).length > 0;
}

// ---------- Prompting ----------

const SYSTEM_PROMPT = `You produce a JSON object describing a software project's stack for a
concise, curated "APP_FACTS.md" file. Output ONLY valid JSON, no prose, no code fences.

Schema (all fields required unless noted):
{
  "name": string,
  "type": string (e.g. "web app (SPA)", "CLI tool", "API service", "mobile app"),
  "status": string (guess "active" unless evidence suggests otherwise),
  "license": string (SPDX id if you can tell, else "UNKNOWN"),
  "stack": { "<layer>": "<choice>", ... }  // 4-8 entries: language, runtime, framework,
        styling, state, backend, database, hosting — only include layers that apply
  "key_dependencies": [ { "name": string, "purpose": string (<=8 words) }, ... ]  // 5-8 MAX,
        curated for what best explains the app's shape — do not dump every dependency
  "build": { "package_manager": string, "test": string, "ci": string, "<other>": string }
}

Rules:
- Prefer dependencies that appear in provided manifest content. Never invent package names.
- When manifests are sparse or absent (docs/spec/tooling repos), derive stack from README and signal files; key_dependencies may be fewer than 5 or empty [].
- Be concise. Purpose strings are short phrases, not sentences.
- If information is genuinely unavailable, use "unknown" rather than guessing wildly.`;

function buildUserPrompt(facts) {
  const parts = ["Repository facts:\n"];
  if (facts.gitRemote) parts.push(`Git remote: ${facts.gitRemote}`);
  parts.push(`Top-level files/dirs: ${facts.tree.join(", ")}`);
  parts.push(`Detected package manager (from lockfile): ${facts.packageManager}`);
  parts.push(`Has CI config: ${facts.hasCi}`);
  parts.push(`Has Docker config: ${facts.hasDocker}`);
  if (Object.keys(facts.manifests).length === 0) {
    parts.push("No package-manager manifest was found; use README and signal files.");
  }
  for (const [name, content] of Object.entries(facts.manifests)) {
    parts.push(`\n--- ${name} ---\n${content}`);
  }
  for (const [name, content] of Object.entries(facts.signals)) {
    parts.push(`\n--- ${name} ---\n${content}`);
  }
  if (facts.readmeExcerpt) parts.push(`\n--- README.md (excerpt) ---\n${facts.readmeExcerpt}`);
  parts.push("\nReturn the JSON object described in the system prompt now.");
  return parts.join("\n");
}

// ---------- Provider backends ----------

async function callOllama(system, user, model, host) {
  const res = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      stream: false,
      format: "json",
    }),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.message.content;
}

async function callOpenAI(system, user, model) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Set OPENAI_API_KEY");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function callAnthropic(system, user, model) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Set ANTHROPIC_API_KEY");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.content.filter(b => b.type === "text").map(b => b.text).join("");
}

async function callXai(system, user, model) {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("Set XAI_API_KEY");
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`xAI error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function callGemini(system, user, model) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Set GEMINI_API_KEY");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { response_mime_type: "application/json" },
    }),
  });
  if (!res.ok) throw new Error(`Gemini error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

const PROVIDERS = {
  ollama: (s, u, m, args) => callOllama(s, u, m, args.ollamaHost),
  openai: (s, u, m) => callOpenAI(s, u, m),
  anthropic: (s, u, m) => callAnthropic(s, u, m),
  xai: (s, u, m) => callXai(s, u, m),
  gemini: (s, u, m) => callGemini(s, u, m),
};

function extractJson(text) {
  const cleaned = text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned);
}

// ---------- Minimal YAML writer (no deps) ----------

function yamlEscape(str) {
  if (/^[\w.\-/: ]*$/.test(str) && str.trim() === str && str !== "") return str;
  return JSON.stringify(str);
}

function toYaml(obj, indent = 0) {
  const pad = "  ".repeat(indent);
  let out = "";
  for (const [key, val] of Object.entries(obj)) {
    if (val === null || val === undefined) continue;
    if (Array.isArray(val)) {
      if (val.length === 0) { out += `${pad}${key}: []\n`; continue; }
      out += `${pad}${key}:\n`;
      for (const item of val) {
        if (typeof item === "object") {
          const lines = toYaml(item, indent + 1).split("\n").filter(Boolean);
          out += `${pad}  - ${lines[0].trim()}\n`;
          for (const l of lines.slice(1)) out += `${pad}  ${l}\n`;
        } else {
          out += `${pad}  - ${yamlEscape(String(item))}\n`;
        }
      }
    } else if (typeof val === "object") {
      out += `${pad}${key}:\n${toYaml(val, indent + 1)}`;
    } else {
      out += `${pad}${key}: ${yamlEscape(String(val))}\n`;
    }
  }
  return out;
}

// ---------- Rendering ----------

function renderAppFacts(data, generatorLabel, consultingLink, consultingName) {
  const fm = {
    app_facts_version: "0.1.0",
    name: data.name || "unknown",
    type: data.type || "unknown",
    status: data.status || "active",
    license: data.license || "UNKNOWN",
    stack: data.stack || {},
    key_dependencies: data.key_dependencies || [],
    build: data.build || {},
    generated: {
      date: new Date().toISOString().slice(0, 10),
      generator: generatorLabel,
    },
  };
  if (consultingLink) {
    fm.credits = {
      generated_with: "https://appfacts.dev",
      built_by: `${consultingName || ""} — ${consultingLink}`.replace(/^ — /, ""),
    };
  }

  const frontmatter = toYaml(fm);

  const stackRows = Object.entries(fm.stack)
    .map(([k, v]) => `| ${k[0].toUpperCase() + k.slice(1)} | ${v} |`).join("\n");
  const depRows = fm.key_dependencies
    .map(d => `| \`${d.name}\` | ${d.purpose} |`).join("\n");
  const buildRows = Object.entries(fm.build)
    .map(([k, v]) => `| ${k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())} | ${v} |`).join("\n");

  let footer = "*Generated with [AppFacts](https://appfacts.dev)*";
  if (consultingLink) {
    footer = `*Generated with [AppFacts](https://appfacts.dev) · Built by [${consultingName || consultingLink}](${consultingLink})*`;
  }

  const body = `# App Facts — ${fm.name}

| | |
|---|---|
| **Type** | ${fm.type} |
| **Status** | ${fm.status} |
| **License** | ${fm.license} |

## Stack

| Layer | Choice |
|---|---|
${stackRows}

## Key Dependencies

| Package | Purpose |
|---|---|
${depRows}

## Build & Test

| | |
|---|---|
${buildRows}

---
${footer}
`;

  return `---\n${frontmatter}---\n\n${body}`;
}

// ---------- Main ----------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(args.path);
  const outPath = args.output ? path.resolve(args.output) : path.join(root, "APP_FACTS.md");

  const facts = detectRepoFacts(root);
  if (!hasEnoughEvidence(facts)) {
    console.error(
      `Not enough project evidence in ${root}. Need a README, a signal file ` +
      `(${SIGNAL_FILES.slice(0, 4).join(", ")}, …), or a manifest ` +
      `(${MANIFESTS.slice(0, 4).join(", ")}, …) at the root or one level down.`
    );
    process.exit(1);
  }
  if (Object.keys(facts.manifests).length === 0) {
    console.warn("No package manifest found; generating from README and signal files.");
  }

  const userPrompt = buildUserPrompt(facts);
  const call = PROVIDERS[args.provider];
  if (!call) {
    console.error(`Unknown provider: ${args.provider}`);
    process.exit(1);
  }

  const raw = await call(SYSTEM_PROMPT, userPrompt, args.model, args);

  let data;
  try {
    data = extractJson(raw);
  } catch (e) {
    console.error("Model did not return valid JSON:\n" + raw);
    process.exit(1);
  }

  const generatorLabel = `appfacts-cli v0.1.0 (${args.provider}:${args.model})`;
  const output = renderAppFacts(data, generatorLabel, args.consultingLink, args.consultingName);

  if (args.dryRun) {
    console.log(output);
  } else {
    fs.writeFileSync(outPath, output);
    console.log(`Wrote ${outPath}`);
  }
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});