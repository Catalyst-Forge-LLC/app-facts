# AppFacts generator

Scans your repo's manifest files (`package.json`, `pyproject.toml`, `requirements.txt`,
`Cargo.toml`, `go.mod`, …) at the root or one level down, plus signal files
(`LICENSE`, `SPEC.md`, …) and your README, sends a curated summary to an LLM, and
writes an `APP_FACTS.md`. Works for docs/spec/tooling repos that have no package
manifest, as long as a README or signal file is present.

## Install

    pip install -r requirements.txt

## Usage

Local, via Ollama (no API key, nothing leaves your machine):

    python3 generate_app_facts.py --provider ollama --model llama3.1

OpenAI:

    export OPENAI_API_KEY=sk-...
    python3 generate_app_facts.py --provider openai --model gpt-4o

Claude:

    export ANTHROPIC_API_KEY=sk-ant-...
    python3 generate_app_facts.py --provider anthropic --model claude-sonnet-4-6

xAI (Grok):

    export XAI_API_KEY=xai-...
    python3 generate_app_facts.py --provider xai --model grok-4

Gemini:

    export GEMINI_API_KEY=...
    python3 generate_app_facts.py --provider gemini --model gemini-2.5-pro

Add a credit footer linking back to you:

    python3 generate_app_facts.py --provider ollama --model llama3.1 \
      --consulting-link https://yourconsulting.example \
      --consulting-name "Your Consulting Co."

Preview without writing:

    python3 generate_app_facts.py --provider ollama --model llama3.1 --dry-run

## Notes

- The model only sees manifests, signal files, and a README excerpt — never your source code.
- `key_dependencies` is capped at 8 items by prompt instruction; the model is told not to invent package names. Sparse-manifest repos may return fewer than 5.
- Model names drift — check each provider's current model list if a name 404s.