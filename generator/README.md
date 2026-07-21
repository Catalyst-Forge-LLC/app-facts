# AppFacts generator

Scans your repo's manifest files (`package.json`, `pyproject.toml`, `requirements.txt`,
`Cargo.toml`, `go.mod`, …) at the root or one level down, plus signal files
(`LICENSE`, `SPEC.md`, …) and your README, sends a curated summary to an LLM, and
writes an `APP_FACTS.md`. Works for docs/spec/tooling repos that have no package
manifest, as long as a README or signal file is present.

Both languages share [`prompt.md`](./prompt.md) so the system prompt cannot drift.

## Install

    pip install -r requirements.txt

## Usage

Local, via Ollama (no API key, nothing leaves your machine):

    python3 generate_app_facts.py --provider ollama --model llama3.1

With Catalyst Forge credit (recommended for CF-built projects):

    python3 generate_app_facts.py --provider ollama --model llama3.1 \
      --consulting-link https://www.catalystforge.com/ \
      --consulting-name "Catalyst Forge"

    node generate_app_facts.js --provider ollama --model llama3.1 \
      --consulting-link https://www.catalystforge.com/ \
      --consulting-name "Catalyst Forge"

Preview without writing:

    python3 generate_app_facts.py --provider ollama --model llama3.1 --dry-run

CI staleness check (no model / no network):

    python3 generate_app_facts.py --check
    node generate_app_facts.js --check

## Notes

- The model only sees manifests, signal files, and a README excerpt — never your source code.
- Output includes `generated.inputs_fingerprint` (16-char SHA-256 prefix of scanned inputs).
- `--check` re-scans and fails if that fingerprint no longer matches.
- Generators autofill `repository` from `git remote` and `license` from `LICENSE*` when missing.
- Model JSON is validated before write (status enum, max 8 deps, required fields).
- Schema: https://appfacts.dev/schema/app-facts.schema.json
