# AppFacts Specification — v0.1

## File

A file named `APP_FACTS.md`, placed at the root of a repository, alongside `README.md`.

## Structure

The file has two parts:

1. **YAML frontmatter** — the source of truth. Structured, validated, machine-parseable.
2. **Markdown body** — a human-rendered "Nutrition Facts" table, generated from the frontmatter. Hand edits to the body are fine, but regenerating from frontmatter should always be possible.

## Required frontmatter fields

| Field | Type | Description |
|---|---|---|
| `app_facts_version` | string | Spec version this file conforms to, e.g. `"0.1.0"` |
| `name` | string | App/project name |
| `type` | string | e.g. `"web app (SPA)"`, `"CLI tool"`, `"mobile app"`, `"API service"` |
| `status` | string | e.g. `"active"`, `"maintenance"`, `"archived"` |
| `license` | string | SPDX identifier, e.g. `"MIT"` |
| `stack` | map<string,string> | Layer name → choice, e.g. `language: TypeScript` |
| `key_dependencies` | list of `{name, purpose}` | Curated, not exhaustive — 5-8 items max |
| `build` | map<string,string> | e.g. `package_manager`, `test`, `ci` |
| `generated` | `{date, generator}` | When and how this file was produced |

## Optional fields

| Field | Type | Description |
|---|---|---|
| `homepage` | string (URL) | |
| `repository` | string (URL) | |
| `credits.generated_with` | string (URL) | e.g. `"https://appfacts.dev"` |
| `credits.built_by` | string | Author/consultancy name + link |

## Conventions

- Curate, don't dump. `key_dependencies` is not `package.json`'s full tree — 5-8 items that actually explain the app's shape.
- `stack` keys are free-form (not a fixed enum) since apps vary — but common keys are `language`, `runtime`, `framework`, `styling`, `state`, `backend`, `database`, `hosting`.
- Keep the body table short enough to read in ~10 seconds.
- Re-generate rather than hand-maintain where possible — see `generator/`.

## Versioning

This is v0.1 — the required-field list may still change before v1.0. Files should declare `app_facts_version` so tooling can handle multiple spec versions.

## License

CC0 — public domain. No attribution required.