#!/usr/bin/env python3
"""
generate_app_facts.py — draft an APP_FACTS.md for a repo using an LLM.

Providers: ollama (local), openai, anthropic, xai, gemini.
Deps: stdlib + PyYAML + segno (see requirements.txt).

  python3 generate_app_facts.py /path/to/project --provider ollama --model llama3.1
  python3 generate_app_facts.py --path /path/to/project --check
  python3 generate_app_facts.py . --provider ollama --model llama3.1 \
    --consulting-link https://www.catalystforge.com/ \
    --consulting-name "Catalyst Forge"
"""
import argparse, base64, hashlib, json, os, re, sys, datetime, subprocess, zlib
import urllib.request
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("Missing dependency: pip install -r requirements.txt")

MANIFESTS = [
    "package.json", "pyproject.toml", "Cargo.toml", "go.mod",
    "Gemfile", "composer.json", "pubspec.yaml", "requirements.txt",
    "Pipfile", "setup.py", "setup.cfg", "deno.json", "deno.jsonc",
]
LOCKFILE_PM = {
    "package-lock.json": "npm", "yarn.lock": "yarn", "pnpm-lock.yaml": "pnpm",
    "poetry.lock": "poetry", "Cargo.lock": "cargo", "go.sum": "go modules",
    "Gemfile.lock": "bundler", "composer.lock": "composer", "Pipfile.lock": "pipenv",
}
SIGNAL_FILES = [
    "LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING",
    "SPEC.md", "CONTRIBUTING.md", "Makefile", "Justfile",
]
SKIP_DIRS = {"node_modules", ".git", "dist", "build", "venv", ".venv", "__pycache__", "target"}
# Vendored/third-party code is excluded from the language census only (it is not
# the project's own code). Keep in sync with the JS generator.
VENDOR_DIRS = {"vendor", "vendored", "third_party", "third-party", "bower_components", "external"}
STATUS_ENUM = {"active", "maintenance", "archived", "experimental"}
MAX_DEPS = 8
MAX_SERVICES = 6

# Framework / tooling config files (root) — short excerpts for the model.
FRAMEWORK_CONFIGS = [
    "svelte.config.js", "svelte.config.ts", "svelte.config.mjs",
    "next.config.js", "next.config.mjs", "next.config.ts",
    "nuxt.config.js", "nuxt.config.ts", "nuxt.config.mjs",
    "astro.config.mjs", "astro.config.ts", "astro.config.js",
    "vite.config.ts", "vite.config.js", "vite.config.mjs",
    "angular.json", "remix.config.js", "vue.config.js",
    "pnpm-workspace.yaml", "lerna.json", "nx.json", "turbo.json",
]
# Deploy / hosting signals (root or under deploy/).
DEPLOY_FILES = [
    "Dockerfile", "docker-compose.yml", "docker-compose.yaml",
    "fly.toml", "vercel.json", "netlify.toml", "wrangler.toml", "wrangler.jsonc",
    "railway.toml", "render.yaml", "Caddyfile", "Procfile", "app.yaml",
]

# Well-known env key prefixes → service hints (names only; never values).
# Keep in sync with the JS generator.
ENV_SERVICE_HINTS = [
    (re.compile(r"^STRIPE_", re.I), "Stripe (billing)"),
    (re.compile(r"^PUBLIC_STRIPE_", re.I), "Stripe (billing)"),
    (re.compile(r"^POSTHOG_", re.I), "PostHog (analytics)"),
    (re.compile(r"^PUBLIC_POSTHOG_", re.I), "PostHog (analytics)"),
    (re.compile(r"^ANTHROPIC_", re.I), "Anthropic (LLM)"),
    (re.compile(r"^OPENAI_", re.I), "OpenAI (LLM)"),
    (re.compile(r"^GEMINI_", re.I), "Google Gemini (LLM)"),
    (re.compile(r"^XAI_", re.I), "xAI (LLM)"),
    (re.compile(r"^OLLAMA_", re.I), "Ollama (local LLM)"),
    (re.compile(r"^LLM_", re.I), "LLM provider"),
    (re.compile(r"^RESEND_", re.I), "Resend (email)"),
    (re.compile(r"^SENDGRID_", re.I), "SendGrid (email)"),
    (re.compile(r"^MAILGUN_", re.I), "Mailgun (email)"),
    (re.compile(r"^POSTMARK_", re.I), "Postmark (email)"),
    (re.compile(r"^TAVILY_", re.I), "Tavily (search/scrape)"),
    (re.compile(r"^BRIGHT_DATA_", re.I), "Bright Data (scrape)"),
    (re.compile(r"^POCKETBASE_", re.I), "PocketBase"),
    (re.compile(r"^OUTPOST_", re.I), "Outpost (scrape edge)"),
    (re.compile(r"^SENTRY_", re.I), "Sentry"),
    (re.compile(r"^AWS_", re.I), "AWS"),
    (re.compile(r"^S3_", re.I), "S3-compatible storage"),
    (re.compile(r"^CLOUDFLARE_", re.I), "Cloudflare"),
    (re.compile(r"^CF_", re.I), "Cloudflare"),
    (re.compile(r"^OAUTH_GOOGLE", re.I), "Google OAuth"),
    (re.compile(r"^OAUTH_MICROSOFT", re.I), "Microsoft OAuth"),
    (re.compile(r"^OAUTH_LINKEDIN", re.I), "LinkedIn OAuth"),
    (re.compile(r"^GOOGLE_CLIENT_", re.I), "Google OAuth"),
    (re.compile(r"^AUTH0_", re.I), "Auth0"),
    (re.compile(r"^CLERK_", re.I), "Clerk (auth)"),
    (re.compile(r"^SUPABASE_", re.I), "Supabase"),
    (re.compile(r"^FIREBASE_", re.I), "Firebase"),
    (re.compile(r"^DATABASE_URL$", re.I), "Database (URL)"),
    (re.compile(r"^POSTGRES_", re.I), "PostgreSQL"),
    (re.compile(r"^MYSQL_", re.I), "MySQL"),
    (re.compile(r"^REDIS_", re.I), "Redis"),
    (re.compile(r"^TWILIO_", re.I), "Twilio"),
    (re.compile(r"^SLACK_", re.I), "Slack"),
    (re.compile(r"^GITHUB_", re.I), "GitHub"),
    (re.compile(r"^VERCEL_", re.I), "Vercel"),
]

# Map file extension -> language/tech, so polyglot repos aren't collapsed to
# whatever happens to have a manifest. Keep in sync with the JS generator.
CODE_EXT = {
    "js": "JavaScript", "mjs": "JavaScript", "cjs": "JavaScript", "jsx": "JavaScript (React)",
    "ts": "TypeScript", "tsx": "TypeScript (React)",
    "py": "Python", "rb": "Ruby", "go": "Go", "rs": "Rust", "java": "Java",
    "kt": "Kotlin", "php": "PHP", "cs": "C#", "c": "C", "h": "C/C++ header",
    "cpp": "C++", "cc": "C++", "hpp": "C++", "swift": "Swift", "m": "Objective-C",
    "scala": "Scala", "ex": "Elixir", "exs": "Elixir", "dart": "Dart",
    "sh": "Shell", "bash": "Shell", "ps1": "PowerShell",
    "html": "HTML", "htm": "HTML", "css": "CSS", "scss": "CSS (SCSS)", "sass": "CSS (Sass)",
    "vue": "Vue", "svelte": "Svelte", "sql": "SQL",
}
MAX_SCAN_FILES = 20000

SYSTEM_PROMPT = (Path(__file__).with_name("prompt.md")).read_text(encoding="utf-8").strip()


def read_text(path: Path, limit=6000):
    try:
        # Normalize newlines so JS/Python fingerprints match across platforms.
        text = path.read_text(encoding="utf-8", errors="ignore")
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        return text[:limit]
    except Exception:
        return ""


def is_env_template_name(name: str) -> bool:
    """True for env *templates* only — never real `.env` / `.env.local` / `.env.prod`."""
    n = name.lower()
    if n == "env.example":
        return True
    if re.fullmatch(r"\.env\.(example|sample|template)", n):
        return True
    if re.fullmatch(r"\.env\.[^.]+\.(example|sample|template)", n):
        return True
    if re.fullmatch(r"[^.].*\.env\.(example|sample|template)", n):
        return True
    return False


def extract_env_keys(text: str):
    """Extract KEY names only from an env template (including commented `# KEY=`)."""
    keys = set()
    for line in text.split("\n"):
        t = line.strip()
        if not t:
            continue
        m = re.match(r"^(?:export\s+|#\s*)?([A-Za-z_][A-Za-z0-9_]*)\s*=", t)
        if m:
            keys.add(m.group(1))
    return sorted(keys)


def service_hints_from_env_keys(keys):
    hints = set()
    for key in keys:
        for pattern, label in ENV_SERVICE_HINTS:
            if pattern.search(key):
                hints.add(label)
    return sorted(hints)


def summarize_package_json(file_path: Path) -> str:
    """Structured package.json summary — full dependency names, no 6k truncation."""
    try:
        raw = file_path.read_text(encoding="utf-8", errors="ignore")
        raw = raw.replace("\r\n", "\n").replace("\r", "\n")
    except Exception:
        return ""
    try:
        pkg = json.loads(raw)
    except Exception:
        return raw[:6000]
    lines = ["(structured package.json summary — dependency names only)"]
    if pkg.get("name") is not None:
        lines.append(f"name: {pkg['name']}")
    if pkg.get("private") is True:
        lines.append("private: true")
    if pkg.get("type") is not None:
        lines.append(f"type: {pkg['type']}")
    if pkg.get("license") is not None:
        lines.append(f"license: {pkg['license']}")
    if pkg.get("packageManager") is not None:
        lines.append(f"packageManager: {pkg['packageManager']}")
    engines = pkg.get("engines")
    if isinstance(engines, dict):
        for k in sorted(engines):
            lines.append(f"engines.{k}: {engines[k]}")
    scripts = pkg.get("scripts")
    if isinstance(scripts, dict) and scripts:
        lines.append("scripts: " + ", ".join(sorted(scripts)))
    for field in ("dependencies", "devDependencies", "peerDependencies", "optionalDependencies"):
        obj = pkg.get(field)
        if isinstance(obj, dict) and obj:
            lines.append(f"{field}: " + ", ".join(sorted(obj)))
    return "\n".join(lines)


def collect_manifests(dir_path: Path, label_prefix=""):
    found = {}
    for m in MANIFESTS:
        p = dir_path / m
        if p.is_file():
            found[label_prefix + m] = (
                summarize_package_json(p) if m == "package.json" else read_text(p)
            )
    return found


def detect_package_manager(dir_path: Path):
    for lock, pm in LOCKFILE_PM.items():
        if (dir_path / lock).exists():
            return pm
    return None


def collect_env_templates(root: Path):
    templates = {}

    def scan_dir(dir_path: Path, label_prefix: str):
        try:
            entries = sorted(dir_path.iterdir(), key=lambda p: p.name)
        except OSError:
            return
        for ent in entries:
            if not ent.is_file() or not is_env_template_name(ent.name):
                continue
            # Keys only — values from templates are discarded after extraction.
            templates[label_prefix + ent.name] = extract_env_keys(read_text(ent, 100000))

    scan_dir(root, "")
    try:
        for item in sorted(root.iterdir(), key=lambda p: p.name):
            if item.name.startswith(".") or item.name in SKIP_DIRS:
                continue
            if item.is_dir():
                scan_dir(item, item.name + "/")
    except OSError:
        pass
    return templates


def collect_shape_signals(root: Path):
    configs = {}
    for name in FRAMEWORK_CONFIGS:
        p = root / name
        if p.is_file():
            configs[name] = read_text(p, 2000)

    deploy = []
    for name in DEPLOY_FILES:
        if (root / name).is_file():
            deploy.append(name)
    deploy_dir = root / "deploy"
    if deploy_dir.is_dir():
        try:
            for ent in sorted(deploy_dir.iterdir(), key=lambda p: p.name):
                if ent.name.startswith(".") or not ent.is_file():
                    continue
                n = ent.name
                if (
                    re.match(r"^[Cc]addyfile", n)
                    or n.endswith(".service")
                    or re.search(r"\.(ya?ml|toml|sh)$", n)
                    or re.search(r"Dockerfile", n, re.I)
                ):
                    deploy.append(f"deploy/{n}")
        except OSError:
            pass
    deploy.sort()

    ci_workflows = []
    wf_dir = root / ".github" / "workflows"
    if wf_dir.is_dir():
        try:
            for ent in sorted(wf_dir.iterdir(), key=lambda p: p.name):
                if ent.is_file() and re.search(r"\.(ya?ml)$", ent.name, re.I):
                    ci_workflows.append(ent.name)
        except OSError:
            pass

    return {"configs": configs, "deploy": deploy, "ci_workflows": ci_workflows}


def scan_languages(root: Path):
    """Census of source files by extension (recursive, bounded, deterministic)."""
    file_types, languages, notable = {}, {}, []
    seen = [0]

    def walk(dir_path: Path, rel: str):
        try:
            entries = sorted(dir_path.iterdir(), key=lambda p: p.name)
        except OSError:
            return
        for ent in entries:
            if ent.name.startswith(".") or ent.name in SKIP_DIRS or ent.name in VENDOR_DIRS:
                continue
            rel_path = f"{rel}/{ent.name}" if rel else ent.name
            if ent.is_dir():
                walk(ent, rel_path)
            elif ent.is_file():
                if seen[0] >= MAX_SCAN_FILES:
                    return
                seen[0] += 1
                ext = ent.suffix.lower().lstrip(".")
                if ext:
                    file_types[ext] = file_types.get(ext, 0) + 1
                lang = CODE_EXT.get(ext)
                if lang:
                    languages[lang] = languages.get(lang, 0) + 1
                    notable.append(rel_path)

    walk(root, "")
    notable.sort()
    return {"file_types": file_types, "languages": languages, "notable": notable}


def detect_repo_facts(root: Path):
    facts = {
        "root": root,
        "manifests": {}, "signals": {}, "package_manager": None,
        "readme_excerpt": "", "tree": [],
        "languages": {}, "file_types": {}, "notable": [],
        "env_templates": {}, "env_keys": [], "service_hints": [],
        "shape_configs": {}, "deploy_signals": [], "ci_workflows": [],
    }
    facts["manifests"].update(collect_manifests(root))
    facts["package_manager"] = detect_package_manager(root)

    # Sort by name string (case-sensitive). Path ordering on Windows is case-insensitive.
    for item in sorted(root.iterdir(), key=lambda p: p.name):
        if item.name.startswith(".") or item.name in SKIP_DIRS:
            continue
        if not item.is_dir():
            continue
        facts["manifests"].update(collect_manifests(item, item.name + "/"))
        if not facts["package_manager"]:
            facts["package_manager"] = detect_package_manager(item)

    for name in SIGNAL_FILES:
        p = root / name
        if p.is_file():
            facts["signals"][name] = read_text(p, 2000)

    for readme_name in ("README.md", "readme.md", "Readme.md"):
        p = root / readme_name
        if p.exists():
            facts["readme_excerpt"] = read_text(p, 3000)
            break
    for item in sorted(root.iterdir(), key=lambda p: p.name):
        if item.name.startswith(".") or item.name in SKIP_DIRS:
            continue
        facts["tree"].append(item.name + ("/" if item.is_dir() else ""))
    census = scan_languages(root)
    facts["languages"] = census["languages"]
    facts["file_types"] = census["file_types"]
    facts["notable"] = census["notable"]

    facts["env_templates"] = collect_env_templates(root)
    all_env_keys = set()
    for keys in facts["env_templates"].values():
        all_env_keys.update(keys)
    facts["env_keys"] = sorted(all_env_keys)
    facts["service_hints"] = service_hints_from_env_keys(facts["env_keys"])

    shape = collect_shape_signals(root)
    facts["shape_configs"] = shape["configs"]
    facts["deploy_signals"] = shape["deploy"]
    facts["ci_workflows"] = shape["ci_workflows"]

    facts["has_ci"] = bool(facts["ci_workflows"]) or (root / ".github" / "workflows").exists()
    facts["has_docker"] = any(re.search(r"docker", d, re.I) for d in facts["deploy_signals"])
    try:
        remote = subprocess.run(["git", "-C", str(root), "remote", "get-url", "origin"],
                                 capture_output=True, text=True, timeout=5)
        facts["git_remote"] = remote.stdout.strip() if remote.returncode == 0 else None
    except Exception:
        facts["git_remote"] = None
    return facts


def has_enough_evidence(facts):
    return bool(facts["manifests"] or facts["readme_excerpt"] or facts["signals"])


def inputs_fingerprint(facts):
    """Stable cross-runtime fingerprint (avoid JSON escaping differences)."""
    lines = []
    for k, v in sorted(facts["manifests"].items()):
        lines.extend([f"manifest:{k}", v])
    for k, v in sorted(facts["signals"].items()):
        lines.extend([f"signal:{k}", v])
    lines.extend(["readme", facts.get("readme_excerpt") or ""])
    lines.extend(["tree", "\n".join(sorted(facts["tree"]))])
    lines.extend(["languages", "\n".join(sorted(f"{k}:{v}" for k, v in facts.get("languages", {}).items()))])
    lines.extend(["fileTypes", "\n".join(sorted(f"{k}:{v}" for k, v in facts.get("file_types", {}).items()))])
    lines.extend(["notable", "\n".join(sorted(facts.get("notable", [])))])
    for k, keys in sorted(facts.get("env_templates", {}).items()):
        lines.extend([f"envTemplate:{k}", "\n".join(sorted(keys))])
    for k, v in sorted(facts.get("shape_configs", {}).items()):
        lines.extend([f"shapeConfig:{k}", v])
    lines.extend(["deploySignals", "\n".join(sorted(facts.get("deploy_signals", [])))])
    lines.extend(["ciWorkflows", "\n".join(sorted(facts.get("ci_workflows", [])))])
    pm = facts.get("package_manager")
    lines.extend(["packageManager", "" if pm is None else str(pm)])
    lines.extend(["hasCi", "1" if facts.get("has_ci") else "0"])
    lines.extend(["hasDocker", "1" if facts.get("has_docker") else "0"])
    lines.extend(["gitRemote", facts.get("git_remote") or ""])
    return hashlib.sha256("\n".join(lines).encode("utf-8")).hexdigest()[:16]


_ssh_host_map = None


def load_ssh_host_map():
    """Parse ~/.ssh/config Host → HostName (aliases like github-work → github.com)."""
    mapping = {}
    config_path = Path.home() / ".ssh" / "config"
    try:
        text = config_path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return mapping
    current = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        host_match = re.match(r"^host\s+(.+)$", line, re.I)
        if host_match:
            current = [h for h in host_match.group(1).split() if h and not re.search(r"[?*]", h)]
            continue
        name_match = re.match(r"^hostname\s+(\S+)", line, re.I)
        if name_match and current:
            for h in current:
                mapping[h.lower()] = name_match.group(1)
    return mapping


def resolve_ssh_hostname(alias):
    global _ssh_host_map
    if not alias:
        return alias
    key = alias.lower()
    if _ssh_host_map is None:
        _ssh_host_map = load_ssh_host_map()
    if key in _ssh_host_map:
        return _ssh_host_map[key]
    # Fallback: `ssh -G` expands Includes / Match blocks OpenSSH knows about.
    try:
        out = subprocess.run(
            ["ssh", "-G", alias],
            capture_output=True, text=True, timeout=4,
        )
        if out.returncode == 0:
            m = re.search(r"^hostname\s+(\S+)", out.stdout, re.M)
            if m:
                _ssh_host_map[key] = m.group(1)
                return m.group(1)
    except Exception:
        pass
    return alias


def apply_git_insteadof(remote, root=None):
    """Apply git url.*.insteadOf rewrites (local repo then global)."""
    rules = []
    queries = [
        (["git", "config", "--get-regexp", r"url\..*\.insteadof"], root),
        (["git", "config", "--global", "--get-regexp", r"url\..*\.insteadof"], None),
    ]
    for args, cwd in queries:
        try:
            out = subprocess.run(
                args, capture_output=True, text=True, timeout=3,
                cwd=str(cwd) if cwd else None,
            )
            if out.returncode != 0:
                continue
            for line in out.stdout.splitlines():
                m = re.match(r"^url\.(.+)\.insteadof\s+(.+)$", line, re.I)
                if m:
                    rules.append((m.group(1), m.group(2)))
        except Exception:
            pass
    rules.sort(key=lambda pair: len(pair[1]), reverse=True)
    for base, prefix in rules:
        if remote.startswith(prefix):
            return base + remote[len(prefix):]
    return remote


def normalize_repo_url(remote, root=None):
    """Turn a git remote into a public https URL (resolve SSH Host aliases)."""
    if not remote:
        return None
    r = apply_git_insteadof(remote.strip(), root)

    # Classic git@host:path (not Windows drive paths like C:\...)
    m = re.match(r"^([^@\s]+)@([^:/\s]+):(.+)$", r)
    if m and not re.match(r"^[A-Za-z]:", r):
        host = resolve_ssh_hostname(m.group(2))
        path = re.sub(r"\.git$", "", m.group(3), flags=re.I).lstrip("/").rstrip("/")
        return f"https://{host}/{path}"

    m = re.match(r"^ssh://(?:[^@]+@)?([^/]+)/(.+)$", r, re.I)
    if m:
        host = resolve_ssh_hostname(m.group(1))
        path = re.sub(r"\.git$", "", m.group(2), flags=re.I).rstrip("/")
        return f"https://{host}/{path}"

    if r.endswith(".git"):
        r = r[:-4]
    if re.match(r"^https?://", r, re.I):
        try:
            from urllib.parse import urlsplit, urlunsplit
            parts = urlsplit(r)
            host = resolve_ssh_hostname(parts.hostname or "")
            netloc = host
            if parts.port:
                netloc = f"{host}:{parts.port}"
            if parts.username:
                netloc = f"{parts.username}@{netloc}"
            return urlunsplit((parts.scheme, netloc, parts.path.rstrip("/"), "", ""))
        except Exception:
            return r
    return None


def detect_license(facts):
    text = "\n".join(facts["signals"].get(n, "") for n in ("LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING"))
    if text:
        if re.search(r"Apache License", text, re.I) and re.search(r"Version 2\.0", text, re.I):
            return "Apache-2.0"
        if re.search(r"GNU GENERAL PUBLIC LICENSE", text, re.I) and re.search(r"Version 3", text, re.I):
            return "GPL-3.0"
        if re.search(r"GNU GENERAL PUBLIC LICENSE", text, re.I) and re.search(r"Version 2", text, re.I):
            return "GPL-2.0"
        if re.search(r"Mozilla Public License", text, re.I) and re.search(r"2\.0", text, re.I):
            return "MPL-2.0"
        if re.search(r"MIT License", text, re.I) or re.search(r"Permission is hereby granted, free of charge", text, re.I):
            return "MIT"
        if re.search(r"\bCC0\b", text, re.I) or re.search(r"Creative Commons Zero", text, re.I):
            return "CC0-1.0"

    # Fallback: an SPDX-ish mention in the README (e.g. "License: MIT", "## License … MIT").
    readme = facts.get("readme_excerpt") or ""
    spdx = {
        "mit": "MIT", "apache-2.0": "Apache-2.0", "gpl-3.0": "GPL-3.0",
        "gpl-2.0": "GPL-2.0", "mpl-2.0": "MPL-2.0", "bsd-3-clause": "BSD-3-Clause",
        "bsd-2-clause": "BSD-2-Clause", "isc": "ISC", "cc0-1.0": "CC0-1.0",
        "unlicense": "Unlicense",
    }
    m = re.search(
        r"licen[sc]e[^\n]*?\b(MIT|Apache-2\.0|GPL-3\.0|GPL-2\.0|MPL-2\.0|BSD-3-Clause|BSD-2-Clause|ISC|CC0-1\.0|Unlicense)\b",
        readme, re.I)
    if m:
        return spdx[m.group(1).lower()]
    if re.search(r"\bMIT License\b", readme, re.I):
        return "MIT"
    return None


def build_user_prompt(facts):
    parts = ["Repository facts:\n"]
    if facts.get("git_remote"):
        parts.append(f"Git remote: {facts['git_remote']}")
        resolved = normalize_repo_url(facts["git_remote"], facts.get("root"))
        if resolved:
            parts.append(f"Resolved public repository URL: {resolved}")
    parts.append(f"Top-level files/dirs: {', '.join(facts['tree'])}")
    langs = sorted(facts.get("languages", {}).items(), key=lambda kv: (-kv[1], kv[0]))
    if langs:
        parts.append("Languages by source-file count: "
                     + ", ".join(f"{lang} ({count})" for lang, count in langs))
    if facts.get("notable"):
        parts.append("Notable source files: " + ", ".join(facts["notable"][:20]))
    parts.append(f"Detected package manager (from lockfile): {facts.get('package_manager')}")
    parts.append(f"Has CI config: {facts.get('has_ci')}")
    if facts.get("ci_workflows"):
        parts.append("CI workflow files: " + ", ".join(facts["ci_workflows"]))
    parts.append(f"Has Docker config: {facts.get('has_docker')}")
    if facts.get("deploy_signals"):
        parts.append("Deploy/hosting signals: " + ", ".join(facts["deploy_signals"]))
    if facts.get("env_keys"):
        parts.append(
            "Env template keys (names only; from .env.example-style files — never real .env): "
            + ", ".join(facts["env_keys"])
        )
    if facts.get("service_hints"):
        parts.append(
            "Inferred third-party services from env key prefixes: "
            + "; ".join(facts["service_hints"])
        )
    if not facts["manifests"]:
        parts.append("No package-manager manifest was found; use README and signal files.")
    for name, content in sorted(facts["manifests"].items()):
        parts.append(f"\n--- {name} ---\n{content}")
    for name, content in sorted(facts.get("shape_configs", {}).items()):
        parts.append(f"\n--- {name} (excerpt) ---\n{content}")
    for name, content in sorted(facts["signals"].items()):
        parts.append(f"\n--- {name} ---\n{content}")
    if facts["readme_excerpt"]:
        parts.append(f"\n--- README.md (excerpt) ---\n{facts['readme_excerpt']}")
    parts.append("\nReturn the JSON object described in the system prompt now.")
    return "\n".join(parts)


# ---------- Provider backends ----------

def call_ollama(system, user, model, host="http://localhost:11434"):
    body = json.dumps({
        "model": model,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "stream": False,
        "format": "json",
    }).encode()
    req = urllib.request.Request(f"{host}/api/chat", data=body,
                                  headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        data = json.loads(resp.read())
    return data["message"]["content"]


def call_openai(system, user, model):
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        sys.exit("Set OPENAI_API_KEY")
    body = json.dumps({
        "model": model,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "response_format": {"type": "json_object"},
    }).encode()
    req = urllib.request.Request("https://api.openai.com/v1/chat/completions", data=body,
                                  headers={"Content-Type": "application/json",
                                           "Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
    return data["choices"][0]["message"]["content"]


def call_anthropic(system, user, model):
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        sys.exit("Set ANTHROPIC_API_KEY")
    body = json.dumps({
        "model": model,
        "max_tokens": 2000,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }).encode()
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body,
                                  headers={"Content-Type": "application/json",
                                           "x-api-key": key,
                                           "anthropic-version": "2023-06-01"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
    return "".join(block["text"] for block in data["content"] if block["type"] == "text")


def call_xai(system, user, model):
    key = os.environ.get("XAI_API_KEY")
    if not key:
        sys.exit("Set XAI_API_KEY")
    body = json.dumps({
        "model": model,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
    }).encode()
    req = urllib.request.Request("https://api.x.ai/v1/chat/completions", data=body,
                                  headers={"Content-Type": "application/json",
                                           "Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
    return data["choices"][0]["message"]["content"]


def call_gemini(system, user, model):
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        sys.exit("Set GEMINI_API_KEY")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    body = json.dumps({
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {"response_mime_type": "application/json"},
    }).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
    return data["candidates"][0]["content"]["parts"][0]["text"]


PROVIDERS = {
    "ollama": call_ollama, "openai": call_openai, "anthropic": call_anthropic,
    "xai": call_xai, "gemini": call_gemini,
}


def extract_json(text):
    text = re.sub(r"^```(json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    return json.loads(text)


def enrich_data(data, facts):
    out = dict(data)
    # Git remote is authoritative; resolve SSH Host aliases → public https URL.
    repo = normalize_repo_url(facts.get("git_remote"), facts.get("root"))
    if repo:
        out["repository"] = repo

    detected = detect_license(facts)
    if (not out.get("license") or out.get("license") in ("UNKNOWN", "unknown")) and detected:
        out["license"] = detected

    status = out.get("status")
    if status and status not in STATUS_ENUM:
        print(f'Coercing status "{status}" → "active" (not in enum)', file=sys.stderr)
        out["status"] = "active"
    if not out.get("status"):
        out["status"] = "active"

    deps = out.get("key_dependencies") or []
    if isinstance(deps, list) and len(deps) > MAX_DEPS:
        print(f"Truncating key_dependencies from {len(deps)} to {MAX_DEPS}", file=sys.stderr)
        out["key_dependencies"] = deps[:MAX_DEPS]

    services = out.get("services") or []
    if isinstance(services, list) and len(services) > MAX_SERVICES:
        print(f"Truncating services from {len(services)} to {MAX_SERVICES}", file=sys.stderr)
        out["services"] = services[:MAX_SERVICES]

    build = out.get("build")
    if not isinstance(build, dict):
        build = {}
    else:
        build = dict(build)
    if not build.get("package_manager") and facts.get("package_manager"):
        build["package_manager"] = facts["package_manager"]
    if (
        (not build.get("ci") or str(build.get("ci")).lower() == "unknown")
        and facts.get("ci_workflows")
    ):
        build["ci"] = "GitHub Actions (" + ", ".join(facts["ci_workflows"]) + ")"
    out["build"] = build

    stack = out.get("stack")
    if isinstance(stack, dict):
        coerced = {}
        for k, v in stack.items():
            if v is None:
                continue
            coerced[k] = ", ".join(str(x) for x in v) if isinstance(v, list) else str(v)
        out["stack"] = coerced

    return out


def validate_frontmatter_data(fm):
    errors = []
    for key in ("app_facts_version", "name", "type", "status", "license", "stack",
                "key_dependencies", "build", "generated"):
        if fm.get(key) is None:
            errors.append(f"missing required field: {key}")
    if fm.get("status") and fm["status"] not in STATUS_ENUM:
        errors.append(f"status must be one of {', '.join(sorted(STATUS_ENUM))}")
    stack = fm.get("stack")
    if not isinstance(stack, dict) or len(stack) < 1:
        errors.append("stack must be a non-empty object")
    deps = fm.get("key_dependencies")
    if not isinstance(deps, list):
        errors.append("key_dependencies must be an array")
    else:
        if len(deps) > MAX_DEPS:
            errors.append(f"key_dependencies max {MAX_DEPS}")
        for i, d in enumerate(deps):
            if not isinstance(d, dict) or not d.get("name"):
                errors.append(f"key_dependencies[{i}].name required")
            if not isinstance(d, dict) or not d.get("purpose"):
                errors.append(f"key_dependencies[{i}].purpose required")
    services = fm.get("services")
    if services is not None:
        if not isinstance(services, list):
            errors.append("services must be an array when present")
        else:
            if len(services) > MAX_SERVICES:
                errors.append(f"services max {MAX_SERVICES}")
            for i, s in enumerate(services):
                if not isinstance(s, dict) or not s.get("name"):
                    errors.append(f"services[{i}].name required")
                if not isinstance(s, dict) or not s.get("role"):
                    errors.append(f"services[{i}].role required")
    gen = fm.get("generated") or {}
    if not isinstance(gen.get("date"), str) or not isinstance(gen.get("generator"), str):
        errors.append("generated.date and generated.generator are required")
    fp = gen.get("inputs_fingerprint")
    if fp and not re.fullmatch(r"[a-f0-9]{16}", fp):
        errors.append("generated.inputs_fingerprint must be 16 lowercase hex chars")
    return errors


def build_frontmatter(data, generator_label, fingerprint, consulting_link=None, consulting_name=None):
    fm = {
        "app_facts_version": "0.1.0",
        "name": data.get("name", "unknown"),
        "type": data.get("type", "unknown"),
        "status": data.get("status", "active"),
        "license": data.get("license", "UNKNOWN"),
    }
    if data.get("homepage"):
        fm["homepage"] = data["homepage"]
    if data.get("repository"):
        fm["repository"] = data["repository"]
    fm["stack"] = data.get("stack") or {}
    fm["key_dependencies"] = data.get("key_dependencies") or []
    services = data.get("services") or []
    if isinstance(services, list) and services:
        fm["services"] = services[:MAX_SERVICES]
    fm["build"] = data.get("build") or {}
    fm["generated"] = {
        "date": datetime.date.today().isoformat(),
        "generator": generator_label,
        "inputs_fingerprint": fingerprint,
    }
    if consulting_link:
        fm["credits"] = {
            "generated_with": "https://appfacts.dev",
            "built_by": f"{consulting_name or ''} — {consulting_link}".strip(" —"),
        }
    return fm


VIEWER_ORIGIN = "https://appfacts.dev"
VIEWER_PREFIX = "af1."
MAX_VIEWER_URL_LEN = 1600


def build_viewer_payload(
    fm,
    include_build=True,
    include_dep_purpose=True,
    include_services=True,
    max_deps=8,
    max_services=6,
):
    deps = []
    for d in (fm.get("key_dependencies") or [])[:max_deps]:
        item = {"n": d["name"]}
        if include_dep_purpose and d.get("purpose"):
            item["p"] = d["purpose"]
        deps.append(item)
    payload = {
        "v": 1,
        "name": fm.get("name"),
        "type": fm.get("type"),
        "status": fm.get("status"),
        "license": fm.get("license"),
        "stack": fm.get("stack") or {},
        "deps": deps,
    }
    if include_services and fm.get("services"):
        payload["svc"] = [
            {"n": s["name"], "r": s["role"]}
            for s in fm["services"][:max_services]
            if isinstance(s, dict) and s.get("name") and s.get("role")
        ]
        if not payload["svc"]:
            del payload["svc"]
    if include_build and fm.get("build"):
        build = {
            k: v for k, v in fm["build"].items()
            if v is not None and str(v).lower() != "unknown"
        }
        if build:
            payload["build"] = build
    if fm.get("homepage"):
        payload["homepage"] = fm["homepage"]
    if fm.get("repository"):
        payload["repository"] = fm["repository"]
    return payload


def encode_viewer_hash(payload):
    # ensure_ascii=False matches JSON.stringify (keeps UTF-8; smaller QR payloads).
    raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    compressed = zlib.compress(raw, 9)
    return VIEWER_PREFIX + base64.urlsafe_b64encode(compressed).decode("ascii").rstrip("=")


def viewer_url_for(fm):
    attempts = [
        dict(include_build=True, include_dep_purpose=True, include_services=True,
             max_deps=8, max_services=6),
        dict(include_build=False, include_dep_purpose=True, include_services=True,
             max_deps=8, max_services=6),
        dict(include_build=False, include_dep_purpose=True, include_services=True,
             max_deps=5, max_services=4),
        dict(include_build=False, include_dep_purpose=False, include_services=True,
             max_deps=5, max_services=4),
        dict(include_build=False, include_dep_purpose=False, include_services=False,
             max_deps=3, max_services=0),
    ]
    url = ""
    for opts in attempts:
        url = f"{VIEWER_ORIGIN}/v#{encode_viewer_hash(build_viewer_payload(fm, **opts))}"
        if len(url) <= MAX_VIEWER_URL_LEN:
            return url
    return url


# Layer/build keys that should render as all-caps acronyms. Keep in sync with
# the JS generator and site/v/index.html.
LABEL_ACRONYMS = {
    "AI", "CI", "CD", "API", "DB", "UI", "UX", "URL", "CLI", "SDK", "QA",
    "CSS", "HTML", "SSR", "SPA", "ORM", "CDN", "DNS", "TLS", "HTTP", "HTTPS",
    "IDE", "OS", "VM", "PWA", "GPU", "CPU", "ID", "IO", "JSON", "YAML", "XML",
    "SQL", "PHP", "SEO", "CMS", "LLM",
}


def _title_case(s):
    words = []
    for w in str(s).replace("_", " ").split():
        up = w.upper()
        words.append(up if up in LABEL_ACRONYMS else (w[:1].upper() + w[1:]))
    return " ".join(words)


def render_app_facts(fm, consulting_link=None, consulting_name=None, viewer_url=None):
    frontmatter = yaml.safe_dump(fm, sort_keys=False, allow_unicode=True)
    viewer_url = viewer_url or viewer_url_for(fm)

    stack_rows = "\n".join(f"| {_title_case(k)} | {v} |" for k, v in fm["stack"].items())
    if fm["key_dependencies"]:
        dep_lines = "\n".join(f"- `{d['name']}` — {d['purpose']}" for d in fm["key_dependencies"])
    else:
        dep_lines = "_None listed_"

    services = fm.get("services") or []
    if services:
        services_block = "\n### Services\n\n" + "\n".join(
            f"- **{s['name']}** — {s['role']}" for s in services
        ) + "\n"
    else:
        services_block = ""

    build_entries = [
        (k, v) for k, v in (fm.get("build") or {}).items()
        if v is not None and str(v).lower() != "unknown"
    ]
    if build_entries:
        build_block = "\n### Build\n\n" + "\n".join(
            f"- **{_title_case(k)}** — {v}" for k, v in build_entries
        ) + "\n"
    else:
        build_block = ""

    footer = (
        "*Generated with [AppFacts](https://appfacts.dev) · "
        "Scan `APP_FACTS.png` or open the [visual label][appfacts-label]*"
    )
    if consulting_link:
        footer = (
            f"*Generated with [AppFacts](https://appfacts.dev) · "
            f"Built by [{consulting_name or consulting_link}]({consulting_link}) · "
            f"[Visual label][appfacts-label]*"
        )

    links = []
    if fm.get("homepage"):
        links.append(f"[Homepage]({fm['homepage']})")
    if fm.get("repository"):
        links.append(f"[Repository]({fm['repository']})")
    link_line = ("\n" + " · ".join(links) + "\n") if links else ""

    body = f"""# {fm['name']}

`{fm['type']}` · **{fm['status']}** · {fm['license']}

Curated stack label for this repository — aimed at an under-a-minute skim.

**[Open visual label →][appfacts-label]** · or scan `APP_FACTS.png`
{link_line}
### Stack

| Layer | Choice |
| --- | --- |
{stack_rows}

### Key dependencies

{dep_lines}
{services_block}{build_block}
---
{footer}

[appfacts-label]: {viewer_url}
"""
    return f"---\n{frontmatter}---\n\n{body}"


def extract_fingerprint_from_file(text):
    m = re.search(r"inputs_fingerprint:\s*['\"]?([a-f0-9]{16})['\"]?", text)
    return m.group(1) if m else None


def qr_target_url(fm):
    """QR encodes the /v viewer URL (facts in the fragment)."""
    return viewer_url_for(fm)


def png_path_for(md_path: Path) -> Path:
    if md_path.suffix.lower() == ".md":
        return md_path.with_suffix(".png")
    return Path(str(md_path) + ".png")


def write_qr_png(text: str, out_path: Path):
    try:
        import segno
    except ImportError:
        sys.exit("Missing dependency for QR PNGs: pip install -r requirements.txt")
    qr = segno.make(text, error="m")
    qr.save(str(out_path), scale=8, border=2)


def run_check(out_path: Path, fingerprint: str):
    if not out_path.exists():
        sys.exit(f"APP_FACTS.md missing at {out_path}")
    existing = extract_fingerprint_from_file(out_path.read_text(errors="ignore"))
    if not existing:
        sys.exit(f"No generated.inputs_fingerprint in {out_path}; regenerate to enable --check")
    if existing != fingerprint:
        sys.exit(f"APP_FACTS.md is stale (file={existing}, scan={fingerprint})")
    print(f"OK - fingerprint {fingerprint} matches {out_path}")


def resolve_paths(target, path_flag, output_flag):
    """Resolve scan root + output. Relative --output is relative to TARGET."""
    if target and path_flag:
        if Path(target).expanduser().resolve() != Path(path_flag).expanduser().resolve():
            sys.exit("Pass either a positional TARGET or --path, not both with different values")
    root = Path(target or path_flag or ".").expanduser().resolve()
    if not root.is_dir():
        sys.exit(f"Target is not a directory: {root}")
    if output_flag:
        out = Path(output_flag).expanduser()
        out_path = out.resolve() if out.is_absolute() else (root / out).resolve()
    else:
        out_path = root / "APP_FACTS.md"
    return root, out_path


def main():
    ap = argparse.ArgumentParser(
        description="Generate APP_FACTS.md for a repo",
        epilog="Example: %(prog)s ~/code/my-app --provider ollama --model llama3.1",
    )
    ap.add_argument(
        "target", nargs="?", default=None,
        help="Repo to scan (default: --path or current directory)",
    )
    ap.add_argument(
        "--path", default=None,
        help="Repo to scan (alternative to positional TARGET)",
    )
    ap.add_argument(
        "--output", default=None,
        help="Output markdown path (default: <TARGET>/APP_FACTS.md; relative paths are under TARGET)",
    )
    ap.add_argument("--provider", choices=PROVIDERS.keys(), default="ollama")
    ap.add_argument("--model", default=None, help="Model name for chosen provider")
    ap.add_argument("--ollama-host", default="http://localhost:11434")
    ap.add_argument("--consulting-link", default=None)
    ap.add_argument("--consulting-name", default=None)
    ap.add_argument("--dry-run", action="store_true", help="Print without writing")
    ap.add_argument("--check", action="store_true",
                    help="Re-scan and exit non-zero if APP_FACTS.md fingerprint is stale")
    ap.add_argument("--no-qr", action="store_true", help="Skip writing APP_FACTS.png")
    args = ap.parse_args()

    if not args.check and not args.model:
        ap.error("--model is required unless --check is set")

    root, out_path = resolve_paths(args.target, args.path, args.output)

    facts = detect_repo_facts(root)
    if not has_enough_evidence(facts):
        sys.exit(
            f"Not enough project evidence in {root}. Need a README, a signal file "
            f"({', '.join(SIGNAL_FILES[:4])}, …), or a manifest "
            f"({', '.join(MANIFESTS[:4])}, …) at the root or one level down."
        )

    fingerprint = inputs_fingerprint(facts)

    if args.check:
        run_check(out_path, fingerprint)
        return

    if not facts["manifests"]:
        print("No package manifest found; generating from README and signal files.",
              file=sys.stderr)

    user_prompt = build_user_prompt(facts)

    if args.provider == "ollama":
        raw = call_ollama(SYSTEM_PROMPT, user_prompt, args.model, args.ollama_host)
    else:
        raw = PROVIDERS[args.provider](SYSTEM_PROMPT, user_prompt, args.model)

    try:
        data = extract_json(raw)
    except json.JSONDecodeError:
        sys.exit(f"Model did not return valid JSON:\n{raw}")

    data = enrich_data(data, facts)
    generator_label = f"appfacts-cli v0.1.0 ({args.provider}:{args.model})"
    fm = build_frontmatter(data, generator_label, fingerprint, args.consulting_link, args.consulting_name)
    errors = validate_frontmatter_data(fm)
    if errors:
        sys.exit("Validation failed:\n- " + "\n- ".join(errors))

    qr_url = qr_target_url(fm)
    output = render_app_facts(fm, args.consulting_link, args.consulting_name, qr_url)
    png_path = png_path_for(out_path)

    if args.dry_run:
        print(output)
        if not args.no_qr:
            print(f"Would write QR PNG -> {png_path}\nQR target: {qr_url}", file=sys.stderr)
    else:
        with out_path.open("w", encoding="utf-8", newline="\n") as fh:
            fh.write(output)
        print(f"Wrote {out_path} (fingerprint {fingerprint})")
        if not args.no_qr:
            write_qr_png(qr_url, png_path)
            print(f"Wrote {png_path} (QR -> {qr_url})")


if __name__ == "__main__":
    main()
