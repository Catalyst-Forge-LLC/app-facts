#!/usr/bin/env node
/**
 * generate_app_facts.js — draft an APP_FACTS.md for a repo using an LLM.
 * Providers: ollama (local), openai, anthropic, xai, gemini.
 * Requires Node >= 18 (built-in fetch). No npm dependencies.
 *
 * Usage:
 *   node generate_app_facts.js /path/to/project --provider ollama --model llama3.1
 *   node generate_app_facts.js --path /path/to/project --check
 *   node generate_app_facts.js . --provider ollama --model llama3.1 \
 *     --consulting-link https://www.catalystforge.com/ \
 *     --consulting-name "Catalyst Forge"
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execSync, execFileSync } = require("child_process");
const { writeQrPng } = require("./qr.js");
const {
  viewerUrlFor,
  buildViewerPayload,
  encodeViewerHash,
  decodeViewerHash,
} = require("./viewer_codec.js");

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
const SIGNAL_FILES = [
  "LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING",
  "SPEC.md", "CONTRIBUTING.md", "Makefile", "Justfile",
];
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "venv", ".venv", "__pycache__", "target"]);
// Vendored/third-party code is excluded from the language census only (it is not
// the project's own code). Keep in sync with the Python generator.
const VENDOR_DIRS = new Set(["vendor", "vendored", "third_party", "third-party", "bower_components", "external"]);
const STATUS_ENUM = new Set(["active", "maintenance", "archived", "experimental"]);
const MAX_DEPS = 8;
const MAX_SERVICES = 6;

/** Framework / tooling config files (root) — short excerpts for the model. */
const FRAMEWORK_CONFIGS = [
  "svelte.config.js", "svelte.config.ts", "svelte.config.mjs",
  "next.config.js", "next.config.mjs", "next.config.ts",
  "nuxt.config.js", "nuxt.config.ts", "nuxt.config.mjs",
  "astro.config.mjs", "astro.config.ts", "astro.config.js",
  "vite.config.ts", "vite.config.js", "vite.config.mjs",
  "angular.json", "remix.config.js", "vue.config.js",
  "pnpm-workspace.yaml", "lerna.json", "nx.json", "turbo.json",
];
/** Deploy / hosting signals (root or under deploy/). */
const DEPLOY_FILES = [
  "Dockerfile", "docker-compose.yml", "docker-compose.yaml",
  "fly.toml", "vercel.json", "netlify.toml", "wrangler.toml", "wrangler.jsonc",
  "railway.toml", "render.yaml", "Caddyfile", "Procfile", "app.yaml",
];

/**
 * Well-known env key prefixes → service hints (names only; never values).
 * Keep in sync with the Python generator.
 */
const ENV_SERVICE_HINTS = [
  [/^STRIPE_/i, "Stripe (billing)"],
  [/^PUBLIC_STRIPE_/i, "Stripe (billing)"],
  [/^POSTHOG_/i, "PostHog (analytics)"],
  [/^PUBLIC_POSTHOG_/i, "PostHog (analytics)"],
  [/^ANTHROPIC_/i, "Anthropic (LLM)"],
  [/^OPENAI_/i, "OpenAI (LLM)"],
  [/^GEMINI_/i, "Google Gemini (LLM)"],
  [/^XAI_/i, "xAI (LLM)"],
  [/^OLLAMA_/i, "Ollama (local LLM)"],
  [/^LLM_/i, "LLM provider"],
  [/^RESEND_/i, "Resend (email)"],
  [/^SENDGRID_/i, "SendGrid (email)"],
  [/^MAILGUN_/i, "Mailgun (email)"],
  [/^POSTMARK_/i, "Postmark (email)"],
  [/^TAVILY_/i, "Tavily (search/scrape)"],
  [/^BRIGHT_DATA_/i, "Bright Data (scrape)"],
  [/^POCKETBASE_/i, "PocketBase"],
  [/^OUTPOST_/i, "Outpost (scrape edge)"],
  [/^SENTRY_/i, "Sentry"],
  [/^AWS_/i, "AWS"],
  [/^S3_/i, "S3-compatible storage"],
  [/^CLOUDFLARE_/i, "Cloudflare"],
  [/^CF_/i, "Cloudflare"],
  [/^OAUTH_GOOGLE/i, "Google OAuth"],
  [/^OAUTH_MICROSOFT/i, "Microsoft OAuth"],
  [/^OAUTH_LINKEDIN/i, "LinkedIn OAuth"],
  [/^GOOGLE_CLIENT_/i, "Google OAuth"],
  [/^AUTH0_/i, "Auth0"],
  [/^CLERK_/i, "Clerk (auth)"],
  [/^SUPABASE_/i, "Supabase"],
  [/^FIREBASE_/i, "Firebase"],
  [/^DATABASE_URL$/i, "Database (URL)"],
  [/^POSTGRES_/i, "PostgreSQL"],
  [/^MYSQL_/i, "MySQL"],
  [/^REDIS_/i, "Redis"],
  [/^TWILIO_/i, "Twilio"],
  [/^SLACK_/i, "Slack"],
  [/^GITHUB_/i, "GitHub"],
  [/^VERCEL_/i, "Vercel"],
];

// Map file extension -> language/tech, so polyglot repos aren't collapsed to
// whatever happens to have a manifest. Keep in sync with the Python generator.
const CODE_EXT = {
  js: "JavaScript", mjs: "JavaScript", cjs: "JavaScript", jsx: "JavaScript (React)",
  ts: "TypeScript", tsx: "TypeScript (React)",
  py: "Python", rb: "Ruby", go: "Go", rs: "Rust", java: "Java",
  kt: "Kotlin", php: "PHP", cs: "C#", c: "C", h: "C/C++ header",
  cpp: "C++", cc: "C++", hpp: "C++", swift: "Swift", m: "Objective-C",
  scala: "Scala", ex: "Elixir", exs: "Elixir", dart: "Dart",
  sh: "Shell", bash: "Shell", ps1: "PowerShell",
  html: "HTML", htm: "HTML", css: "CSS", scss: "CSS (SCSS)", sass: "CSS (Sass)",
  vue: "Vue", svelte: "Svelte", sql: "SQL",
};
const MAX_SCAN_FILES = 20000;

const SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, "prompt.md"), "utf8").trim();

// ---------- CLI args ----------

function parseArgs(argv) {
  const args = {
    target: null, path: null, output: null, provider: "ollama", model: null,
    ollamaHost: "http://localhost:11434",
    consultingLink: null, consultingName: null, dryRun: false, check: false, noQr: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined || v.startsWith("-")) {
        console.error(`Missing value after ${a}`);
        process.exit(1);
      }
      return v;
    };
    if (a === "--path") args.path = next();
    else if (a === "--output") args.output = next();
    else if (a === "--provider") args.provider = next();
    else if (a === "--model") args.model = next();
    else if (a === "--ollama-host") args.ollamaHost = next();
    else if (a === "--consulting-link") args.consultingLink = next();
    else if (a === "--consulting-name") args.consultingName = next();
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--check") args.check = true;
    else if (a === "--no-qr") args.noQr = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else if (a.startsWith("-")) {
      console.error(`Unknown option: ${a}`);
      process.exit(1);
    } else if (args.target == null) {
      args.target = a;
    } else {
      console.error(`Unexpected argument: ${a}`);
      process.exit(1);
    }
  }
  if (args.help) {
    console.log(`Usage: node generate_app_facts.js [TARGET] [options]

  TARGET                 Repo to scan (default: .). Same as --path.
  --path <dir>           Repo to scan (alternative to TARGET)
  --output <file>        Output markdown path (default: <TARGET>/APP_FACTS.md)
  --provider <name>      ollama | openai | anthropic | xai | gemini (default: ollama)
  --model <name>         Model for the provider (required unless --check)
  --ollama-host <url>    Ollama base URL
  --consulting-link <url>
  --consulting-name <name>
  --dry-run              Print markdown; do not write files
  --check                Exit non-zero if APP_FACTS.md fingerprint is stale
  --no-qr                Skip APP_FACTS.png
  -h, --help             Show this help

Examples:
  node generate_app_facts.js ~/code/my-app --provider ollama --model llama3.1
  node generate_app_facts.js --path ~/code/my-app --check`);
    process.exit(0);
  }
  if (!args.check && !args.model) {
    console.error("Missing required --model <name> (or pass --check)");
    process.exit(1);
  }
  return args;
}

/** Resolve scan root + output paths. Relative --output is relative to TARGET. */
function resolvePaths(args) {
  if (args.target && args.path) {
    const a = path.resolve(args.target);
    const b = path.resolve(args.path);
    if (a !== b) {
      console.error("Pass either a positional TARGET or --path, not both with different values");
      process.exit(1);
    }
  }
  const root = path.resolve(args.target || args.path || ".");
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    console.error(`Target is not a directory: ${root}`);
    process.exit(1);
  }
  let outPath;
  if (args.output) {
    outPath = path.isAbsolute(args.output)
      ? path.resolve(args.output)
      : path.resolve(root, args.output);
  } else {
    outPath = path.join(root, "APP_FACTS.md");
  }
  return { root, outPath };
}

// ---------- Repo scanning ----------

function readText(p, limit = 6000) {
  try {
    // Normalize newlines so JS/Python fingerprints match on Windows (CRLF) checkouts.
    const text = fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    return text.slice(0, limit);
  } catch {
    return "";
  }
}

/** True for env *templates* only — never real `.env` / `.env.local` / `.env.prod`. */
function isEnvTemplateName(name) {
  const n = String(name).toLowerCase();
  if (n === "env.example") return true;
  if (/^\.env\.(example|sample|template)$/.test(n)) return true;
  if (/^\.env\.[^.]+\.(example|sample|template)$/.test(n)) return true;
  if (/^[^.].*\.env\.(example|sample|template)$/.test(n)) return true;
  return false;
}

/** Extract KEY names only from an env template (including commented `# KEY=`). */
function extractEnvKeys(text) {
  const keys = new Set();
  for (const line of String(text).split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const m = t.match(/^(?:export\s+|#\s*)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (m) keys.add(m[1]);
  }
  return [...keys].sort();
}

function serviceHintsFromEnvKeys(keys) {
  const hints = new Set();
  for (const key of keys) {
    for (const [re, label] of ENV_SERVICE_HINTS) {
      if (re.test(key)) hints.add(label);
    }
  }
  return [...hints].sort();
}

/**
 * Structured package.json summary — full dependency *names*, no 6k truncation.
 * Deterministic text; keep in sync with Python.
 */
function summarizePackageJson(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  } catch {
    return "";
  }
  let pkg;
  try {
    pkg = JSON.parse(raw);
  } catch {
    return raw.slice(0, 6000);
  }
  const lines = ["(structured package.json summary — dependency names only)"];
  if (pkg.name != null) lines.push(`name: ${pkg.name}`);
  if (pkg.private === true) lines.push("private: true");
  if (pkg.type != null) lines.push(`type: ${pkg.type}`);
  if (pkg.license != null) lines.push(`license: ${pkg.license}`);
  if (pkg.packageManager != null) lines.push(`packageManager: ${pkg.packageManager}`);
  if (pkg.engines && typeof pkg.engines === "object") {
    for (const k of Object.keys(pkg.engines).sort()) {
      lines.push(`engines.${k}: ${pkg.engines[k]}`);
    }
  }
  const scriptKeys = pkg.scripts && typeof pkg.scripts === "object"
    ? Object.keys(pkg.scripts).sort()
    : [];
  if (scriptKeys.length) lines.push(`scripts: ${scriptKeys.join(", ")}`);
  for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    const obj = pkg[field];
    if (!obj || typeof obj !== "object") continue;
    const names = Object.keys(obj).sort();
    if (names.length) lines.push(`${field}: ${names.join(", ")}`);
  }
  return lines.join("\n");
}

function collectManifests(dir, labelPrefix = "") {
  const found = {};
  for (const m of MANIFESTS) {
    const p = path.join(dir, m);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      found[labelPrefix + m] = m === "package.json"
        ? summarizePackageJson(p)
        : readText(p);
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

function collectEnvTemplates(root) {
  /** @type {Record<string, string[]>} */
  const templates = {};
  function scanDir(dir, labelPrefix) {
    let entries;
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries.sort()) {
      if (!isEnvTemplateName(name)) continue;
      const p = path.join(dir, name);
      try {
        if (!fs.statSync(p).isFile()) continue;
      } catch {
        continue;
      }
      // Keys only — values from templates are discarded after extraction.
      templates[labelPrefix + name] = extractEnvKeys(readText(p, 100000));
    }
  }
  scanDir(root, "");
  try {
    for (const item of fs.readdirSync(root).sort()) {
      if (item.startsWith(".") || SKIP_DIRS.has(item)) continue;
      const sub = path.join(root, item);
      try {
        if (fs.statSync(sub).isDirectory()) scanDir(sub, item + "/");
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  return templates;
}

function collectShapeSignals(root) {
  /** @type {Record<string, string>} */
  const configs = {};
  for (const name of FRAMEWORK_CONFIGS) {
    const p = path.join(root, name);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      configs[name] = readText(p, 2000);
    }
  }

  const deploy = [];
  for (const name of DEPLOY_FILES) {
    const p = path.join(root, name);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) deploy.push(name);
  }
  const deployDir = path.join(root, "deploy");
  if (fs.existsSync(deployDir) && fs.statSync(deployDir).isDirectory()) {
    try {
      for (const name of fs.readdirSync(deployDir).sort()) {
        if (name.startsWith(".")) continue;
        const p = path.join(deployDir, name);
        if (!fs.statSync(p).isFile()) continue;
        if (
          /^(Caddyfile|[Cc]addyfile)/.test(name)
          || /\.service$/.test(name)
          || /\.(ya?ml|toml|sh)$/.test(name)
          || /Dockerfile/i.test(name)
        ) {
          deploy.push(`deploy/${name}`);
        }
      }
    } catch { /* ignore */ }
  }
  deploy.sort();

  const ciWorkflows = [];
  const wfDir = path.join(root, ".github", "workflows");
  if (fs.existsSync(wfDir) && fs.statSync(wfDir).isDirectory()) {
    try {
      for (const name of fs.readdirSync(wfDir).sort()) {
        if (/\.(ya?ml)$/i.test(name)) ciWorkflows.push(name);
      }
    } catch { /* ignore */ }
  }

  return { configs, deploy, ciWorkflows };
}

/** Census of source files by extension (recursive, bounded, deterministic). */
function scanLanguages(root) {
  const fileTypes = {};
  const languages = {};
  const notable = [];
  let seen = 0;

  function walk(dir, rel) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const ent of entries) {
      if (ent.name.startsWith(".") || SKIP_DIRS.has(ent.name) || VENDOR_DIRS.has(ent.name)) continue;
      const relPath = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        walk(path.join(dir, ent.name), relPath);
      } else if (ent.isFile()) {
        if (seen >= MAX_SCAN_FILES) return;
        seen++;
        const dot = ent.name.lastIndexOf(".");
        const ext = dot > 0 ? ent.name.slice(dot + 1).toLowerCase() : "";
        if (ext) fileTypes[ext] = (fileTypes[ext] || 0) + 1;
        const lang = CODE_EXT[ext];
        if (lang) {
          languages[lang] = (languages[lang] || 0) + 1;
          notable.push(relPath);
        }
      }
    }
  }

  walk(root, "");
  notable.sort();
  return { fileTypes, languages, notable };
}

function detectRepoFacts(root) {
  const facts = {
    root,
    manifests: {}, signals: {}, packageManager: null,
    readmeExcerpt: "", tree: [], languages: {}, fileTypes: {}, notable: [],
    envTemplates: {}, envKeys: [], serviceHints: [],
    shapeConfigs: {}, deploySignals: [], ciWorkflows: [],
    hasCi: false, hasDocker: false, gitRemote: null,
  };

  Object.assign(facts.manifests, collectManifests(root));
  facts.packageManager = detectPackageManager(root);

  for (const item of fs.readdirSync(root).sort()) {
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

  for (const item of fs.readdirSync(root).sort()) {
    if (item.startsWith(".") || SKIP_DIRS.has(item)) continue;
    const isDir = fs.statSync(path.join(root, item)).isDirectory();
    facts.tree.push(item + (isDir ? "/" : ""));
  }

  const census = scanLanguages(root);
  facts.languages = census.languages;
  facts.fileTypes = census.fileTypes;
  facts.notable = census.notable;

  facts.envTemplates = collectEnvTemplates(root);
  const allEnvKeys = new Set();
  for (const keys of Object.values(facts.envTemplates)) {
    for (const k of keys) allEnvKeys.add(k);
  }
  facts.envKeys = [...allEnvKeys].sort();
  facts.serviceHints = serviceHintsFromEnvKeys(facts.envKeys);

  const shape = collectShapeSignals(root);
  facts.shapeConfigs = shape.configs;
  facts.deploySignals = shape.deploy;
  facts.ciWorkflows = shape.ciWorkflows;

  facts.hasCi = facts.ciWorkflows.length > 0
    || fs.existsSync(path.join(root, ".github", "workflows"));
  facts.hasDocker = facts.deploySignals.some((d) => /docker/i.test(d));

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

function sortedObject(obj) {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
}

/** Stable cross-runtime fingerprint (avoid JSON escaping differences). */
function inputsFingerprint(facts) {
  const lines = [];
  for (const [k, v] of Object.entries(sortedObject(facts.manifests))) {
    lines.push(`manifest:${k}`, v);
  }
  for (const [k, v] of Object.entries(sortedObject(facts.signals))) {
    lines.push(`signal:${k}`, v);
  }
  lines.push("readme", facts.readmeExcerpt || "");
  lines.push("tree", [...facts.tree].sort().join("\n"));
  lines.push("languages", Object.entries(facts.languages || {}).map(([k, v]) => `${k}:${v}`).sort().join("\n"));
  lines.push("fileTypes", Object.entries(facts.fileTypes || {}).map(([k, v]) => `${k}:${v}`).sort().join("\n"));
  lines.push("notable", [...(facts.notable || [])].sort().join("\n"));
  for (const [k, keys] of Object.entries(sortedObject(facts.envTemplates || {}))) {
    lines.push(`envTemplate:${k}`, [...keys].sort().join("\n"));
  }
  for (const [k, v] of Object.entries(sortedObject(facts.shapeConfigs || {}))) {
    lines.push(`shapeConfig:${k}`, v);
  }
  lines.push("deploySignals", [...(facts.deploySignals || [])].sort().join("\n"));
  lines.push("ciWorkflows", [...(facts.ciWorkflows || [])].sort().join("\n"));
  lines.push("packageManager", facts.packageManager == null ? "" : String(facts.packageManager));
  lines.push("hasCi", facts.hasCi ? "1" : "0");
  lines.push("hasDocker", facts.hasDocker ? "1" : "0");
  lines.push("gitRemote", facts.gitRemote || "");
  return crypto.createHash("sha256").update(lines.join("\n"), "utf8").digest("hex").slice(0, 16);
}

/** Parse ~/.ssh/config Host → HostName (aliases like github-work → github.com). */
function loadSshHostMap() {
  const map = {};
  const configPath = path.join(os.homedir(), ".ssh", "config");
  let text = "";
  try {
    text = fs.readFileSync(configPath, "utf8");
  } catch {
    return map;
  }
  let current = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const hostMatch = line.match(/^host\s+(.+)$/i);
    if (hostMatch) {
      current = hostMatch[1].split(/\s+/).filter((h) => h && !/[?*]/.test(h));
      continue;
    }
    const nameMatch = line.match(/^hostname\s+(\S+)/i);
    if (nameMatch && current.length) {
      for (const h of current) map[h.toLowerCase()] = nameMatch[1];
    }
  }
  return map;
}

let _sshHostMap = null;
function resolveSshHostname(alias) {
  if (!alias) return alias;
  const key = alias.toLowerCase();
  if (_sshHostMap == null) _sshHostMap = loadSshHostMap();
  if (_sshHostMap[key]) return _sshHostMap[key];
  // Fallback: `ssh -G` expands Includes / Match blocks OpenSSH knows about.
  try {
    const out = execFileSync("ssh", ["-G", alias], {
      encoding: "utf8",
      timeout: 4000,
      stdio: ["pipe", "pipe", "ignore"],
    });
    const m = out.match(/^hostname\s+(\S+)/m);
    if (m && m[1]) {
      _sshHostMap[key] = m[1];
      return m[1];
    }
  } catch { /* ignore */ }
  return alias;
}

/** Apply git url.*.insteadOf rewrites (local repo then global). */
function applyGitInsteadOf(remote, root) {
  const rules = [];
  const queries = [
    { args: ["config", "--get-regexp", "url\\..*\\.insteadof"], cwd: root || undefined },
    { args: ["config", "--global", "--get-regexp", "url\\..*\\.insteadof"], cwd: undefined },
  ];
  for (const q of queries) {
    try {
      const out = execFileSync("git", q.args, {
        cwd: q.cwd,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
        timeout: 3000,
      });
      for (const line of out.split(/\r?\n/)) {
        const m = line.match(/^url\.(.+)\.insteadof\s+(.+)$/i);
        if (m) rules.push({ base: m[1], prefix: m[2] });
      }
    } catch { /* no rules */ }
  }
  rules.sort((a, b) => b.prefix.length - a.prefix.length);
  for (const r of rules) {
    if (remote.startsWith(r.prefix)) return r.base + remote.slice(r.prefix.length);
  }
  return remote;
}

/**
 * Turn a git remote into a public https URL.
 * Resolves SSH Host aliases (github-work → github.com) and git insteadOf.
 */
function normalizeRepoUrl(remote, root = null) {
  if (!remote) return null;
  let r = applyGitInsteadOf(remote.trim(), root);

  // Classic git@host:path (not Windows drive paths like C:\...)
  const sshScp = r.match(/^([^@\s]+)@([^:/\s]+):(.+)$/);
  if (sshScp && !/^[A-Za-z]:/.test(r)) {
    const host = resolveSshHostname(sshScp[2]);
    const p = sshScp[3].replace(/\.git$/i, "").replace(/^\/+/, "").replace(/\/$/, "");
    return `https://${host}/${p}`;
  }

  const sshUrl = r.match(/^ssh:\/\/(?:([^@]+)@)?([^/]+)\/(.+)$/i);
  if (sshUrl) {
    const host = resolveSshHostname(sshUrl[2]);
    const p = sshUrl[3].replace(/\.git$/i, "").replace(/\/$/, "");
    return `https://${host}/${p}`;
  }

  if (r.endsWith(".git")) r = r.slice(0, -4);
  if (/^https?:\/\//i.test(r)) {
    try {
      const u = new URL(r);
      u.hostname = resolveSshHostname(u.hostname);
      u.hash = "";
      u.search = "";
      return u.href.replace(/\/$/, "");
    } catch {
      return r;
    }
  }
  return null;
}

function detectLicense(facts) {
  const signals = facts.signals || {};
  const text = ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING"]
    .map(n => signals[n] || "").join("\n");
  if (text) {
    if (/Apache License/i.test(text) && /Version 2\.0/i.test(text)) return "Apache-2.0";
    if (/GNU GENERAL PUBLIC LICENSE/i.test(text) && /Version 3/i.test(text)) return "GPL-3.0";
    if (/GNU GENERAL PUBLIC LICENSE/i.test(text) && /Version 2/i.test(text)) return "GPL-2.0";
    if (/Mozilla Public License/i.test(text) && /2\.0/i.test(text)) return "MPL-2.0";
    if (/BSD 3-Clause/i.test(text) || (/Redistribution and use in source and binary forms/i.test(text) && /3-clause/i.test(text))) {
      return "BSD-3-Clause";
    }
    if (/MIT License/i.test(text) || /\bPermission is hereby granted, free of charge\b/i.test(text)) return "MIT";
    if (/\bCC0\b/i.test(text) || /Creative Commons Zero/i.test(text)) return "CC0-1.0";
  }

  // Fallback: an SPDX-ish mention in the README (e.g. "License: MIT", "## License … MIT").
  const readme = facts.readmeExcerpt || "";
  const spdx = {
    mit: "MIT", "apache-2.0": "Apache-2.0", "gpl-3.0": "GPL-3.0", "gpl-2.0": "GPL-2.0",
    "mpl-2.0": "MPL-2.0", "bsd-3-clause": "BSD-3-Clause", "bsd-2-clause": "BSD-2-Clause",
    isc: "ISC", "cc0-1.0": "CC0-1.0", unlicense: "Unlicense",
  };
  const m = readme.match(/licen[sc]e[^\n]*?\b(MIT|Apache-2\.0|GPL-3\.0|GPL-2\.0|MPL-2\.0|BSD-3-Clause|BSD-2-Clause|ISC|CC0-1\.0|Unlicense)\b/i);
  if (m) return spdx[m[1].toLowerCase()];
  if (/\bMIT License\b/i.test(readme)) return "MIT";
  return null;
}

// ---------- Prompting ----------

function buildUserPrompt(facts) {
  const parts = ["Repository facts:\n"];
  if (facts.gitRemote) {
    parts.push(`Git remote: ${facts.gitRemote}`);
    const resolved = normalizeRepoUrl(facts.gitRemote, facts.root || null);
    if (resolved) parts.push(`Resolved public repository URL: ${resolved}`);
  }
  parts.push(`Top-level files/dirs: ${facts.tree.join(", ")}`);
  const langs = Object.entries(facts.languages || {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (langs.length) {
    parts.push(`Languages by source-file count: ${langs.map(([l, c]) => `${l} (${c})`).join(", ")}`);
  }
  if (facts.notable && facts.notable.length) {
    parts.push(`Notable source files: ${facts.notable.slice(0, 20).join(", ")}`);
  }
  parts.push(`Detected package manager (from lockfile): ${facts.packageManager}`);
  parts.push(`Has CI config: ${facts.hasCi}`);
  if (facts.ciWorkflows && facts.ciWorkflows.length) {
    parts.push(`CI workflow files: ${facts.ciWorkflows.join(", ")}`);
  }
  parts.push(`Has Docker config: ${facts.hasDocker}`);
  if (facts.deploySignals && facts.deploySignals.length) {
    parts.push(`Deploy/hosting signals: ${facts.deploySignals.join(", ")}`);
  }
  if (facts.envKeys && facts.envKeys.length) {
    parts.push(
      "Env template keys (names only; from .env.example-style files — never real .env): "
      + facts.envKeys.join(", ")
    );
  }
  if (facts.serviceHints && facts.serviceHints.length) {
    parts.push(`Inferred third-party services from env key prefixes: ${facts.serviceHints.join("; ")}`);
  }
  if (Object.keys(facts.manifests).length === 0) {
    parts.push("No package-manager manifest was found; use README and signal files.");
  }
  for (const [name, content] of Object.entries(sortedObject(facts.manifests))) {
    parts.push(`\n--- ${name} ---\n${content}`);
  }
  for (const [name, content] of Object.entries(sortedObject(facts.shapeConfigs || {}))) {
    parts.push(`\n--- ${name} (excerpt) ---\n${content}`);
  }
  for (const [name, content] of Object.entries(sortedObject(facts.signals))) {
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

// ---------- Enrich + validate ----------

function enrichData(data, facts) {
  const out = { ...data };
  // Git remote is authoritative; resolve SSH Host aliases → public https URL.
  const repo = normalizeRepoUrl(facts.gitRemote, facts.root || null);
  if (repo) out.repository = repo;

  const detected = detectLicense(facts);
  if ((!out.license || out.license === "UNKNOWN" || out.license === "unknown") && detected) {
    out.license = detected;
  }

  if (out.status && !STATUS_ENUM.has(out.status)) {
    console.warn(`Coercing status "${out.status}" → "active" (not in enum)`);
    out.status = "active";
  }
  if (!out.status) out.status = "active";

  if (Array.isArray(out.key_dependencies) && out.key_dependencies.length > MAX_DEPS) {
    console.warn(`Truncating key_dependencies from ${out.key_dependencies.length} to ${MAX_DEPS}`);
    out.key_dependencies = out.key_dependencies.slice(0, MAX_DEPS);
  }

  if (Array.isArray(out.services) && out.services.length > MAX_SERVICES) {
    console.warn(`Truncating services from ${out.services.length} to ${MAX_SERVICES}`);
    out.services = out.services.slice(0, MAX_SERVICES);
  }

  // Deterministic build enrichment from scan facts.
  out.build = out.build && typeof out.build === "object" && !Array.isArray(out.build)
    ? { ...out.build }
    : {};
  if (!out.build.package_manager && facts.packageManager) {
    out.build.package_manager = facts.packageManager;
  }
  if ((!out.build.ci || String(out.build.ci).toLowerCase() === "unknown") && facts.ciWorkflows?.length) {
    out.build.ci = `GitHub Actions (${facts.ciWorkflows.join(", ")})`;
  }

  // Coerce stack values to strings (models sometimes emit arrays).
  if (out.stack && typeof out.stack === "object" && !Array.isArray(out.stack)) {
    const coerced = {};
    for (const [k, v] of Object.entries(out.stack)) {
      if (v == null) continue;
      coerced[k] = Array.isArray(v) ? v.join(", ") : String(v);
    }
    out.stack = coerced;
  }
  // Schema requires ≥1 stack entry.
  if (!out.stack || typeof out.stack !== "object" || Array.isArray(out.stack)
      || Object.keys(out.stack).length < 1) {
    out.stack = { language: "unknown" };
  }

  return out;
}

function validateFrontmatterData(fm) {
  const errors = [];
  for (const key of ["app_facts_version", "name", "type", "status", "license", "stack", "key_dependencies", "build", "generated"]) {
    if (fm[key] === undefined || fm[key] === null) errors.push(`missing required field: ${key}`);
  }
  if (fm.status && !STATUS_ENUM.has(fm.status)) {
    errors.push(`status must be one of ${[...STATUS_ENUM].join(", ")}`);
  }
  if (fm.stack && (typeof fm.stack !== "object" || Array.isArray(fm.stack) || Object.keys(fm.stack).length < 1)) {
    errors.push("stack must be a non-empty object");
  }
  if (!Array.isArray(fm.key_dependencies)) {
    errors.push("key_dependencies must be an array");
  } else {
    if (fm.key_dependencies.length > MAX_DEPS) errors.push(`key_dependencies max ${MAX_DEPS}`);
    fm.key_dependencies.forEach((d, i) => {
      if (!d || typeof d.name !== "string" || !d.name) errors.push(`key_dependencies[${i}].name required`);
      if (!d || typeof d.purpose !== "string" || !d.purpose) errors.push(`key_dependencies[${i}].purpose required`);
    });
  }
  if (fm.services !== undefined && fm.services !== null) {
    if (!Array.isArray(fm.services)) {
      errors.push("services must be an array when present");
    } else {
      if (fm.services.length > MAX_SERVICES) errors.push(`services max ${MAX_SERVICES}`);
      fm.services.forEach((s, i) => {
        if (!s || typeof s.name !== "string" || !s.name) errors.push(`services[${i}].name required`);
        if (!s || typeof s.role !== "string" || !s.role) errors.push(`services[${i}].role required`);
      });
    }
  }
  if (!fm.generated || typeof fm.generated.date !== "string" || typeof fm.generated.generator !== "string") {
    errors.push("generated.date and generated.generator are required");
  }
  if (fm.generated?.inputs_fingerprint && !/^[a-f0-9]{16}$/.test(fm.generated.inputs_fingerprint)) {
    errors.push("generated.inputs_fingerprint must be 16 lowercase hex chars");
  }
  return errors;
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

function buildFrontmatter(data, generatorLabel, fingerprint, consultingLink, consultingName) {
  const fm = {
    app_facts_version: "0.1.0",
    name: data.name || "unknown",
    type: data.type || "unknown",
    status: data.status || "active",
    license: data.license || "UNKNOWN",
  };
  if (data.homepage) fm.homepage = data.homepage;
  if (data.repository) fm.repository = data.repository;
  fm.stack = data.stack || {};
  fm.key_dependencies = data.key_dependencies || [];
  if (Array.isArray(data.services) && data.services.length) {
    fm.services = data.services.slice(0, MAX_SERVICES);
  }
  fm.build = data.build || {};
  fm.generated = {
    date: new Date().toISOString().slice(0, 10),
    generator: generatorLabel,
    inputs_fingerprint: fingerprint,
  };
  if (consultingLink) {
    fm.credits = {
      generated_with: "https://appfacts.dev",
      built_by: `${consultingName || ""} — ${consultingLink}`.replace(/^ — /, ""),
    };
  }
  return fm;
}

// Layer/build keys that should render as all-caps acronyms. Keep in sync with
// the Python generator and site/v/index.html.
const LABEL_ACRONYMS = new Set([
  "AI", "CI", "CD", "API", "DB", "UI", "UX", "URL", "CLI", "SDK", "QA",
  "CSS", "HTML", "SSR", "SPA", "ORM", "CDN", "DNS", "TLS", "HTTP", "HTTPS",
  "IDE", "OS", "VM", "PWA", "GPU", "CPU", "ID", "IO", "JSON", "YAML", "XML",
  "SQL", "PHP", "SEO", "CMS", "LLM",
]);

function titleCase(s) {
  return String(s).replace(/_/g, " ").split(/\s+/).map((w) => {
    if (!w) return w;
    const up = w.toUpperCase();
    if (LABEL_ACRONYMS.has(up)) return up;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(" ");
}

function renderAppFacts(fm, consultingLink, consultingName, viewerUrl) {
  const frontmatter = toYaml(fm);

  const stackRows = Object.entries(fm.stack)
    .map(([k, v]) => `| ${titleCase(k)} | ${v} |`)
    .join("\n");

  const depLines = (fm.key_dependencies || []).length
    ? fm.key_dependencies.map((d) => `- \`${d.name}\` — ${d.purpose}`).join("\n")
    : "_None listed_";

  const services = Array.isArray(fm.services) ? fm.services : [];
  const servicesBlock = services.length
    ? `\n### Services\n\n${services.map((s) => `- **${s.name}** — ${s.role}`).join("\n")}\n`
    : "";

  const buildEntries = Object.entries(fm.build || {})
    .filter(([, v]) => v != null && String(v).toLowerCase() !== "unknown");
  const buildBlock = buildEntries.length
    ? `\n### Build\n\n${buildEntries.map(([k, v]) => `- **${titleCase(k)}** — ${v}`).join("\n")}\n`
    : "";

  let footer = `*Generated with [AppFacts](https://appfacts.dev) · Scan \`APP_FACTS.png\` or open the [visual label][appfacts-label]*`;
  if (consultingLink) {
    footer = `*Generated with [AppFacts](https://appfacts.dev) · Built by [${consultingName || consultingLink}](${consultingLink}) · [Visual label][appfacts-label]*`;
  }

  const links = [];
  if (fm.homepage) links.push(`[Homepage](${fm.homepage})`);
  if (fm.repository) links.push(`[Repository](${fm.repository})`);
  const linkLine = links.length ? `\n${links.join(" · ")}\n` : "";

  const body = `# ${fm.name}

\`${fm.type}\` · **${fm.status}** · ${fm.license}

Curated stack label for this repository — aimed at an under-a-minute skim.

**[Open visual label →][appfacts-label]** · or scan \`APP_FACTS.png\`
${linkLine}
### Stack

| Layer | Choice |
| --- | --- |
${stackRows}

### Key dependencies

${depLines}
${servicesBlock}${buildBlock}
---
${footer}

[appfacts-label]: ${viewerUrl}
`;

  return `---\n${frontmatter}---\n\n${body}`;
}

function extractFingerprintFromFile(text) {
  const m = text.match(/inputs_fingerprint:\s*["']?([a-f0-9]{16})["']?/);
  return m ? m[1] : null;
}

/** QR encodes the /v viewer URL (facts in the fragment), with URL fallbacks if needed. */
function qrTargetUrl(fm) {
  return viewerUrlFor(fm);
}

function pngPathFor(mdPath) {
  return /\.md$/i.test(mdPath) ? mdPath.replace(/\.md$/i, ".png") : mdPath + ".png";
}

function runCheck(outPath, fingerprint) {
  if (!fs.existsSync(outPath)) {
    console.error(`APP_FACTS.md missing at ${outPath}`);
    process.exit(1);
  }
  const existing = extractFingerprintFromFile(fs.readFileSync(outPath, "utf8"));
  if (!existing) {
    console.error(`No generated.inputs_fingerprint in ${outPath}; regenerate to enable --check`);
    process.exit(1);
  }
  if (existing !== fingerprint) {
    console.error(`APP_FACTS.md is stale (file=${existing}, scan=${fingerprint})`);
    process.exit(1);
  }
  console.log(`OK - fingerprint ${fingerprint} matches ${outPath}`);
}

// ---------- Main ----------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { root, outPath } = resolvePaths(args);

  const facts = detectRepoFacts(root);
  if (!hasEnoughEvidence(facts)) {
    console.error(
      `Not enough project evidence in ${root}. Need a README, a signal file ` +
      `(${SIGNAL_FILES.slice(0, 4).join(", ")}, …), or a manifest ` +
      `(${MANIFESTS.slice(0, 4).join(", ")}, …) at the root or one level down.`
    );
    process.exit(1);
  }

  const fingerprint = inputsFingerprint(facts);

  if (args.check) {
    runCheck(outPath, fingerprint);
    return;
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
  } catch {
    console.error("Model did not return valid JSON:\n" + raw);
    process.exit(1);
  }

  data = enrichData(data, facts);
  const generatorLabel = `appfacts-cli v0.1.0 (${args.provider}:${args.model})`;
  const fm = buildFrontmatter(data, generatorLabel, fingerprint, args.consultingLink, args.consultingName);
  const errors = validateFrontmatterData(fm);
  if (errors.length) {
    console.error("Validation failed:\n- " + errors.join("\n- "));
    process.exit(1);
  }

  const qrUrl = qrTargetUrl(fm);
  const output = renderAppFacts(fm, args.consultingLink, args.consultingName, qrUrl);
  const pngPath = pngPathFor(outPath);

  if (args.dryRun) {
    console.log(output);
    if (!args.noQr) console.error(`Would write QR PNG -> ${pngPath}\nQR target: ${qrUrl}`);
  } else {
    fs.writeFileSync(outPath, output);
    console.log(`Wrote ${outPath} (fingerprint ${fingerprint})`);
    if (!args.noQr) {
      writeQrPng(qrUrl, pngPath);
      console.log(`Wrote ${pngPath} (QR -> ${qrUrl})`);
    }
  }
}

module.exports = {
  detectRepoFacts,
  inputsFingerprint,
  enrichData,
  normalizeRepoUrl,
  buildViewerPayload,
  encodeViewerHash,
  decodeViewerHash,
  viewerUrlFor,
};

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
