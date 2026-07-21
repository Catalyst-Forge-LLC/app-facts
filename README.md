<h1 align="center">AppFacts</h1>

<p align="center">
  <strong>A "Nutrition Facts" label for software.</strong>
</p>

<p align="center">
  A tiny, standardized <code>APP_FACTS.md</code> that lives next to your <code>README.md</code>
  and answers one question in ten seconds: <em>what is this app built from?</em>
</p>

<p align="center">
  <a href="https://appfacts.dev">appfacts.dev</a> ·
  <a href="./SPEC.md">Spec</a> ·
  <a href="./schema/app-facts.schema.json">Schema</a> ·
  <a href="./examples/APP_FACTS.md">Example</a>
</p>

---

## What is this?

`package.json`, `pyproject.toml`, `Cargo.toml` and friends are **complete but noisy** — full dependency trees, dev tooling, pinned versions. They're written for package managers, not for a human trying to get their bearings.

READMEs have a "Tech Stack" section by convention, but it's **unstructured prose that rots** and can't be validated or parsed.

`APP_FACTS.md` sits between the two: **curated, human-glanceable, and still machine-parseable** via YAML frontmatter. Think of it as the label on the side of the box — not the full ingredient supply chain, just the facts that tell you what you're looking at.

Useful for:

- **New contributors** orienting themselves in an unfamiliar repo
- **Future you**, six months later
- **AI coding agents** that need a fast, structured read on a project's shape
- **Clients and stakeholders** who want the stack without reading source

## What it looks like

Every `APP_FACTS.md` has two halves. The **YAML frontmatter is the source of truth** — structured and validatable. The **Markdown body is a rendered table** for humans, generated from the frontmatter.

```markdown
---
app_facts_version: "0.1.0"
name: Acme Dashboard
type: web app (SPA)
status: active
license: MIT
stack:
  language: TypeScript
  framework: React 18 + Vite
  styling: Tailwind CSS
  backend: Fastify
  database: PostgreSQL 16
  hosting: Vercel (web) · Fly.io (api)
key_dependencies:
  - name: "@tanstack/react-query"
    purpose: Server state and caching
  - name: zod
    purpose: Schema validation
build:
  package_manager: pnpm
  test: Vitest + Playwright
  ci: GitHub Actions
generated:
  date: 2026-07-21
  generator: appfacts-cli v0.1.0
---

# App Facts — Acme Dashboard

| Layer | Choice |
|---|---|
| Language | TypeScript |
| Framework | React 18 + Vite |
| ... | ... |
```

See the [full worked example](./examples/APP_FACTS.md) and the [specification](./SPEC.md) for the complete field list.

## The generator

You *can* hand-write `APP_FACTS.md`, but the whole point is near-zero effort. The generator scans your repo's manifest files and README, asks an LLM to produce a curated summary, and writes the file for you — frontmatter and rendered table both.

It ships in **two identical flavors** so you can use whatever's already on your machine:

| | Python | Node.js |
|---|---|---|
| **File** | [`generator/generate_app_facts.py`](./generator/generate_app_facts.py) | [`generator/generate_app_facts.js`](./generator/generate_app_facts.js) |
| **Requires** | Python 3.8+ · `pip install pyyaml` | Node 18+ · zero npm deps |
| **LLM providers** | ollama · openai · anthropic · xai · gemini | ollama · openai · anthropic · xai · gemini |

Both read the same inputs, use the same prompt, and emit byte-for-byte comparable output. Pick whichever fits your toolchain — there's no functional difference.

### What the model actually sees

Only **manifest files** (root or one level down — `package.json`, `pyproject.toml`, `requirements.txt`, `Cargo.toml`, and friends), a few **signal files** (`LICENSE`, `SPEC.md`, …), a short **README excerpt**, and a top-level file listing. Repos without a package manifest still work when a README (or signals) describe the project. **Your source code is never sent.** Use the `ollama` provider if you want nothing to leave your machine at all.

## Install & run

### Python

```bash
cd generator
pip install -r requirements.txt        # just PyYAML

# then, from your project's root:
python3 generate_app_facts.py --provider ollama --model llama3.1
```

### Node.js

```bash
# no install step — Node 18+ has everything built in.
# from your project's root:
node generator/generate_app_facts.js --provider ollama --model llama3.1
```

## Choosing a provider

Both versions take `--provider` and `--model`. Local-first via Ollama needs no key and sends nothing off-device; the hosted providers each read one environment variable.

| Provider | Env var | Example model | Notes |
|---|---|---|---|
| `ollama` | — | `llama3.1` | Local. Nothing leaves your machine. |
| `openai` | `OPENAI_API_KEY` | `gpt-4o` | |
| `anthropic` | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` | |
| `xai` | `XAI_API_KEY` | `grok-4` | |
| `gemini` | `GEMINI_API_KEY` | `gemini-2.5-pro` | |

> Model names drift over time. If one 404s, check the provider's current model list.

<details>
<summary><strong>All five providers, both languages (copy-paste)</strong></summary>

**Python**

```bash
# Local (Ollama)
python3 generate_app_facts.py --provider ollama --model llama3.1

# OpenAI
export OPENAI_API_KEY=sk-...
python3 generate_app_facts.py --provider openai --model gpt-4o

# Claude
export ANTHROPIC_API_KEY=sk-ant-...
python3 generate_app_facts.py --provider anthropic --model claude-sonnet-4-6

# xAI (Grok)
export XAI_API_KEY=xai-...
python3 generate_app_facts.py --provider xai --model grok-4

# Gemini
export GEMINI_API_KEY=...
python3 generate_app_facts.py --provider gemini --model gemini-2.5-pro
```

**Node.js**

```bash
# Local (Ollama)
node generate_app_facts.js --provider ollama --model llama3.1

# OpenAI
export OPENAI_API_KEY=sk-...
node generate_app_facts.js --provider openai --model gpt-4o

# Claude
export ANTHROPIC_API_KEY=sk-ant-...
node generate_app_facts.js --provider anthropic --model claude-sonnet-4-6

# xAI (Grok)
export XAI_API_KEY=xai-...
node generate_app_facts.js --provider xai --model grok-4

# Gemini
export GEMINI_API_KEY=...
node generate_app_facts.js --provider gemini --model gemini-2.5-pro
```

</details>

## Options

Both versions accept the same flags:

| Flag | Default | Description |
|---|---|---|
| `--provider` | `ollama` | One of `ollama`, `openai`, `anthropic`, `xai`, `gemini`. |
| `--model` | *(required)* | Model name for the chosen provider. |
| `--path` | `.` | Path to the repo to scan. |
| `--output` | `<path>/APP_FACTS.md` | Where to write the result. |
| `--ollama-host` | `http://localhost:11434` | Override the Ollama endpoint. |
| `--consulting-link` | — | URL for a credit footer / `built_by` field. |
| `--consulting-name` | — | Display name for that credit. |
| `--dry-run` | off | Print the result instead of writing it. |

### Add a credit line

Link an `APP_FACTS.md` back to whoever built the project:

```bash
# Python
python3 generate_app_facts.py --provider ollama --model llama3.1 \
  --consulting-link https://yourconsulting.example \
  --consulting-name "Your Consulting Co."

# Node.js
node generate_app_facts.js --provider ollama --model llama3.1 \
  --consulting-link https://yourconsulting.example \
  --consulting-name "Your Consulting Co."
```

This adds a `credits` block to the frontmatter and a footer to the rendered table.

### Preview before writing

```bash
# either version
... --dry-run
```

## How it works

1. **Scan.** Detect manifest files (root + one subdirectory deep), signal files, the package manager (from lockfiles), a README excerpt, CI/Docker presence, and the git remote.
2. **Prompt.** Send that curated summary — never your source — to the chosen LLM with a strict JSON schema and an instruction to *curate, not dump* (max 8 key dependencies, no invented packages).
3. **Render.** Validate the returned JSON, write the YAML frontmatter, and generate the human-readable Markdown table beneath it.

## Validating a file

The frontmatter conforms to [`schema/app-facts.schema.json`](./schema/app-facts.schema.json) (JSON Schema draft-07). Extract the frontmatter and validate it with any standard validator — e.g. [`ajv`](https://ajv.js.org/) (JS) or [`jsonschema`](https://python-jsonschema.readthedocs.io/) (Python).

## Roadmap

- [ ] Publishable CLI (`npx appfacts` / `pipx install appfacts`)
- [ ] `--check` mode to flag a stale `APP_FACTS.md` in CI
- [ ] A badge (`![AppFacts](...)`) linking to a rendered card
- [ ] Editor/agent integrations that read the frontmatter directly

## Website

The static site for [appfacts.dev](https://appfacts.dev) lives in [`site/`](./site/). On Cloudflare Pages, set the project root (or build output directory) to `site` — no build step.

## Contributing

This is **v0.1** — the spec's required fields may still shift before v1.0. Issues and proposals on field taxonomy, provider support, and output format are all welcome.

## License

- **Spec & schema:** [CC0](https://creativecommons.org/publicdomain/zero/1.0/) (public domain) — adopt them freely, no attribution needed.
- **Generator scripts:** MIT.

---

<p align="center">
  Part of <a href="https://appfacts.dev">appfacts.dev</a>
</p>