# AppFacts generator

Scans a target repo's manifests (`package.json` as a structured dependency-name
summary, `pyproject.toml`, `requirements.txt`, …) at the root or one level down,
plus signal files, framework/deploy configs, CI workflows, `.env.example`-style
templates (**key names only** — never real `.env` files), a language census, and
the README. Sends a curated summary to an LLM and writes `APP_FACTS.md`
(+ `APP_FACTS.png`). Works for docs/spec/tooling repos that have no package
manifest, as long as a README or signal file is present.

Both languages share [`prompt.md`](./prompt.md) so the system prompt cannot drift.

The **script directory** and the **target project** are independent. Always pass the
project to scan as a positional `TARGET` (or `--path`). Scanning `.` inside this
checkout labels AppFacts itself, not the app you meant.

## Extraction vs curation vs verification

| Step | What happens | What it does not prove |
|---|---|---|
| **Extraction** | Deterministic scan of manifests, signals, README excerpt, language census, and `.env.example` key names | That the later summary is complete |
| **Curation** | LLM (or a human) picks stack lines, up to 8 key dependencies, and optional services | That those picks match the repo |
| **Verification** | Schema required-fields/enums, plus `--check` against `generated.inputs_fingerprint` | Factual correctness or a full SBOM |

Absent evidence should stay absent, `unknown`, or `undisclosed` in hand-authored files. Do not invent packages or services. There is no `--no-llm` generate mode. `--check` is the no-model path and only compares scanned inputs to the stored fingerprint.

## Install

```bash
pip install -r requirements.txt   # PyYAML + segno (QR PNGs)
```

Node needs no install (QR encoder is vendored under `vendor/`).

## Usage

From this `generator/` folder, against another project:

```bash
python3 generate_app_facts.py /path/to/my-app --provider ollama --model llama3.1
node generate_app_facts.js /path/to/my-app --provider ollama --model llama3.1
```

From the app-facts repo root (same idea — pass the target explicitly):

```bash
python3 generator/generate_app_facts.py /path/to/my-app --provider ollama --model llama3.1
node generator/generate_app_facts.js /path/to/my-app --provider ollama --model llama3.1
```

Dogfood this repo:

```bash
python3 generator/generate_app_facts.py . --provider ollama --model llama3.1 \
  --consulting-link https://www.catalystforge.com/ \
  --consulting-name "Catalyst Forge"
```

Writes `<TARGET>/APP_FACTS.md` and `<TARGET>/APP_FACTS.png`. Skip the PNG with `--no-qr`.

Emit a self-contained HTML badge (and `BADGE.md` with all three variants):

```bash
node generate_app_facts.js /path/to/my-app --provider ollama --model llama3.1 --badge
node generate_app_facts.js /path/to/my-app --provider ollama --model llama3.1 --badge=card
```

Variants: `pill` (default), `label`, `card`. Printed HTML matches [appfacts.dev/badge](https://appfacts.dev/badge/). Spec: [`../BADGE_SPEC.md`](../BADGE_SPEC.md).

Preview without writing:

```bash
python3 generate_app_facts.py /path/to/my-app --provider ollama --model llama3.1 --dry-run
```

CI staleness check (no model / no network):

```bash
python3 generate_app_facts.py /path/to/my-app --check
node generate_app_facts.js /path/to/my-app --check
```

## Notes

- The model sees manifests, framework/deploy signals, env-template **keys**, signal files, and a README excerpt — never source bodies and never real `.env` secrets.
- Optional frontmatter `services` (max 6) captures hosted integrations (Stripe, PostHog, …) separately from package `key_dependencies`.
- Output includes `generated.inputs_fingerprint` (16-char SHA-256 prefix of scanned inputs).
- `--check` re-scans and fails if that fingerprint no longer matches.
- Generators autofill `repository` from `git remote` and `license` from `LICENSE*` / README when missing.
- Model JSON is validated before write (status enum, max 8 deps, max 6 services, required fields).
- `APP_FACTS.png` QR encodes `https://appfacts.dev/v#af1.…` — a compressed facts payload rendered by the static viewer (no server)
- Relative `--output` paths are resolved under `TARGET`.
- Schema: https://appfacts.dev/schema/app-facts.schema.json
- Compact `/v` payload: [`../SPEC-af1.md`](../SPEC-af1.md)
- Fingerprint algorithm: [`../SPEC.md`](../SPEC.md) v0.1.2 (prompt-independent; `package.json` → sorted `name@versionRange`)

## Tests

```bash
# Node (built-in node:test)
node --test generator/test/af1_roundtrip.test.js generator/test/fingerprint.test.js generator/test/badge.test.js

# Python
python -m unittest discover -s generator/test -p 'test_*.py' -v
```

Cross-runtime checks assert that Node and Python produce the same `inputs_fingerprint` for `generator/test/fixtures/mini-repo`.
