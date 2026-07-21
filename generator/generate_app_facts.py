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
STATUS_ENUM = {"active", "maintenance", "archived", "experimental"}
MAX_DEPS = 8

SYSTEM_PROMPT = (Path(__file__).with_name("prompt.md")).read_text(encoding="utf-8").strip()


def read_text(path: Path, limit=6000):
    try:
        # Normalize newlines so JS/Python fingerprints match across platforms.
        text = path.read_text(encoding="utf-8", errors="ignore")
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        return text[:limit]
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


def inputs_fingerprint(facts):
    """Stable cross-runtime fingerprint (avoid JSON escaping differences)."""
    lines = []
    for k, v in sorted(facts["manifests"].items()):
        lines.extend([f"manifest:{k}", v])
    for k, v in sorted(facts["signals"].items()):
        lines.extend([f"signal:{k}", v])
    lines.extend(["readme", facts.get("readme_excerpt") or ""])
    lines.extend(["tree", "\n".join(sorted(facts["tree"]))])
    pm = facts.get("package_manager")
    lines.extend(["packageManager", "" if pm is None else str(pm)])
    lines.extend(["hasCi", "1" if facts.get("has_ci") else "0"])
    lines.extend(["hasDocker", "1" if facts.get("has_docker") else "0"])
    lines.extend(["gitRemote", facts.get("git_remote") or ""])
    return hashlib.sha256("\n".join(lines).encode("utf-8")).hexdigest()[:16]


def normalize_repo_url(remote):
    if not remote:
        return None
    r = remote.strip()
    m = re.match(r"^git@([^:]+):(.+?)(?:\.git)?$", r)
    if m:
        return f"https://{m.group(1)}/{m.group(2).rstrip('/')}"
    if r.endswith(".git"):
        r = r[:-4]
    if re.match(r"^https?://", r, re.I):
        return r
    return None


def detect_license(facts):
    text = "\n".join(facts["signals"].get(n, "") for n in ("LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING"))
    if not text:
        return None
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
    return None


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
    for name, content in sorted(facts["manifests"].items()):
        parts.append(f"\n--- {name} ---\n{content}")
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
    repo = normalize_repo_url(facts.get("git_remote"))
    if not out.get("repository") and repo:
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


def build_viewer_payload(fm, include_build=True, include_dep_purpose=True, max_deps=8):
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
        dict(include_build=True, include_dep_purpose=True, max_deps=8),
        dict(include_build=False, include_dep_purpose=True, max_deps=8),
        dict(include_build=False, include_dep_purpose=True, max_deps=5),
        dict(include_build=False, include_dep_purpose=False, max_deps=5),
        dict(include_build=False, include_dep_purpose=False, max_deps=3),
    ]
    url = ""
    for opts in attempts:
        url = f"{VIEWER_ORIGIN}/v#{encode_viewer_hash(build_viewer_payload(fm, **opts))}"
        if len(url) <= MAX_VIEWER_URL_LEN:
            return url
    return url


def _title_case(s):
    return str(s).replace("_", " ").title()


def render_app_facts(fm, consulting_link=None, consulting_name=None, viewer_url=None):
    frontmatter = yaml.safe_dump(fm, sort_keys=False, allow_unicode=True)
    viewer_url = viewer_url or viewer_url_for(fm)

    stack_rows = "\n".join(f"| {_title_case(k)} | {v} |" for k, v in fm["stack"].items())
    if fm["key_dependencies"]:
        dep_lines = "\n".join(f"- `{d['name']}` — {d['purpose']}" for d in fm["key_dependencies"])
    else:
        dep_lines = "_None listed_"

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

Curated stack label for this repository — aimed at a ~10 second read.

**[Open visual label →][appfacts-label]** · or scan `APP_FACTS.png`
{link_line}
### Stack

| Layer | Choice |
| --- | --- |
{stack_rows}

### Key dependencies

{dep_lines}
{build_block}
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
