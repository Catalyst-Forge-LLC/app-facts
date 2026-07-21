#!/usr/bin/env python3
"""
generate_app_facts.py — draft an APP_FACTS.md for a repo using an LLM.

Providers: ollama (local), openai, anthropic, xai, gemini.
Only stdlib + PyYAML required (see requirements.txt).
"""
import argparse, json, os, re, sys, datetime, subprocess
import urllib.request, urllib.error
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
# Non-manifest project signals useful when a repo has no package manager file.
SIGNAL_FILES = [
    "LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING",
    "SPEC.md", "CONTRIBUTING.md", "Makefile", "Justfile",
]
SKIP_DIRS = {"node_modules", ".git", "dist", "build", "venv", ".venv", "__pycache__", "target"}


def read_text(path: Path, limit=6000):
    try:
        return path.read_text(errors="ignore")[:limit]
    except Exception:
        return ""


def collect_manifests(dir_path: Path, label_prefix=""):
    found = {}
    for m in MANIFESTS:
        p = dir_path / m
        if p.is_file():
            found[label_prefix + m] = read_text(p)
    return found


def detect_package_manager(dir_path: Path):
    for lock, pm in LOCKFILE_PM.items():
        if (dir_path / lock).exists():
            return pm
    return None


def detect_repo_facts(root: Path):
    facts = {
        "manifests": {}, "signals": {}, "package_manager": None,
        "readme_excerpt": "", "tree": [],
    }
    facts["manifests"].update(collect_manifests(root))
    facts["package_manager"] = detect_package_manager(root)

    # One level of nested manifests (e.g. generator/requirements.txt, apps/web/package.json)
    for item in sorted(root.iterdir()):
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
    for item in sorted(root.iterdir()):
        if item.name.startswith(".") or item.name in SKIP_DIRS:
            continue
        facts["tree"].append(item.name + ("/" if item.is_dir() else ""))
    facts["has_ci"] = (root / ".github" / "workflows").exists()
    facts["has_docker"] = (root / "Dockerfile").exists() or (root / "docker-compose.yml").exists()
    try:
        remote = subprocess.run(["git", "-C", str(root), "remote", "get-url", "origin"],
                                 capture_output=True, text=True, timeout=5)
        facts["git_remote"] = remote.stdout.strip() if remote.returncode == 0 else None
    except Exception:
        facts["git_remote"] = None
    return facts


def has_enough_evidence(facts):
    return bool(facts["manifests"] or facts["readme_excerpt"] or facts["signals"])


SYSTEM_PROMPT = """You produce a JSON object describing a software project's stack for a
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
- If information is genuinely unavailable, use "unknown" rather than guessing wildly.
"""


def build_user_prompt(facts):
    parts = ["Repository facts:\n"]
    if facts.get("git_remote"):
        parts.append(f"Git remote: {facts['git_remote']}")
    parts.append(f"Top-level files/dirs: {', '.join(facts['tree'])}")
    parts.append(f"Detected package manager (from lockfile): {facts.get('package_manager')}")
    parts.append(f"Has CI config: {facts.get('has_ci')}")
    parts.append(f"Has Docker config: {facts.get('has_docker')}")
    if not facts["manifests"]:
        parts.append("No package-manager manifest was found; use README and signal files.")
    for name, content in facts["manifests"].items():
        parts.append(f"\n--- {name} ---\n{content}")
    for name, content in facts["signals"].items():
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


# ---------- Rendering ----------

def render_app_facts(data, generator_label, consulting_link=None, consulting_name=None):
    fm = {
        "app_facts_version": "0.1.0",
        "name": data.get("name", "unknown"),
        "type": data.get("type", "unknown"),
        "status": data.get("status", "active"),
        "license": data.get("license", "UNKNOWN"),
        "stack": data.get("stack", {}),
        "key_dependencies": data.get("key_dependencies", []),
        "build": data.get("build", {}),
        "generated": {
            "date": datetime.date.today().isoformat(),
            "generator": generator_label,
        },
    }
    if consulting_link:
        fm["credits"] = {
            "generated_with": "https://appfacts.dev",
            "built_by": f"{consulting_name or ''} — {consulting_link}".strip(" —"),
        }

    frontmatter = yaml.safe_dump(fm, sort_keys=False, allow_unicode=True)

    stack_rows = "\n".join(f"| {k.title()} | {v} |" for k, v in fm["stack"].items())
    dep_rows = "\n".join(f"| `{d['name']}` | {d['purpose']} |" for d in fm["key_dependencies"])
    build_rows = "\n".join(f"| {k.replace('_', ' ').title()} | {v} |" for k, v in fm["build"].items())

    footer = "*Generated with [AppFacts](https://appfacts.dev)*"
    if consulting_link:
        footer = f"*Generated with [AppFacts](https://appfacts.dev) · Built by [{consulting_name or consulting_link}]({consulting_link})*"

    body = f"""# App Facts — {fm['name']}

| | |
|---|---|
| **Type** | {fm['type']} |
| **Status** | {fm['status']} |
| **License** | {fm['license']} |

## Stack

| Layer | Choice |
|---|---|
{stack_rows}

## Key Dependencies

| Package | Purpose |
|---|---|
{dep_rows}

## Build & Test

| | |
|---|---|
{build_rows}

---
{footer}
"""
    return f"---\n{frontmatter}---\n\n{body}"


def main():
    ap = argparse.ArgumentParser(description="Generate APP_FACTS.md for a repo")
    ap.add_argument("--path", default=".", help="Repo path (default: current dir)")
    ap.add_argument("--output", default=None, help="Output path (default: <path>/APP_FACTS.md)")
    ap.add_argument("--provider", choices=PROVIDERS.keys(), default="ollama")
    ap.add_argument("--model", required=True, help="Model name for chosen provider")
    ap.add_argument("--ollama-host", default="http://localhost:11434")
    ap.add_argument("--consulting-link", default=None)
    ap.add_argument("--consulting-name", default=None)
    ap.add_argument("--dry-run", action="store_true", help="Print without writing")
    args = ap.parse_args()

    root = Path(args.path).resolve()
    out_path = Path(args.output) if args.output else root / "APP_FACTS.md"

    facts = detect_repo_facts(root)
    if not has_enough_evidence(facts):
        sys.exit(
            f"Not enough project evidence in {root}. Need a README, a signal file "
            f"({', '.join(SIGNAL_FILES[:4])}, …), or a manifest "
            f"({', '.join(MANIFESTS[:4])}, …) at the root or one level down."
        )
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

    generator_label = f"appfacts-cli v0.1.0 ({args.provider}:{args.model})"
    output = render_app_facts(data, generator_label, args.consulting_link, args.consulting_name)

    if args.dry_run:
        print(output)
    else:
        out_path.write_text(output)
        print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()