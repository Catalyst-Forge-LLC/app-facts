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
| `type` | string | Free-form. Recommended: `"web app (SPA)"`, `"web app (SSR)"`, `"CLI tool"`, `"API service"`, `"mobile app"`, `"library"`, `"spec / tooling"`, `"monorepo"`, `"desktop app"`, `"other"` |
| `status` | enum | One of: `active`, `maintenance`, `archived`, `experimental` |
| `license` | string | SPDX identifier, e.g. `"MIT"`, or `"UNKNOWN"` |
| `stack` | map<string,string> | Layer name → choice, e.g. `language: TypeScript` |
| `key_dependencies` | list of `{name, purpose}` | Curated packages — **max 8** (may be empty) |
| `build` | map<string,string> | e.g. `package_manager`, `test`, `ci` |
| `generated` | object | `date`, `generator`; optional `inputs_fingerprint` |

## Optional fields

| Field | Type | Description |
|---|---|---|
| `homepage` | string (URL) | |
| `repository` | string (URL) | Recommended when a public git remote exists |
| `services` | list of `{name, role}` | Curated third-party / hosted integrations — **max 6** |
| `generated.inputs_fingerprint` | string | 16-char hex SHA-256 prefix of scanned inputs; enables `--check` |
| `credits.generated_with` | string (URL) | e.g. `"https://appfacts.dev"` |
| `credits.built_by` | string | Author/consultancy name + link |

## Conventions

- Curate, don't dump. `key_dependencies` is not `package.json`'s full tree — up to 8 items that actually explain the app's shape.
- `services` is for hosted integrations (Stripe, PostHog, Resend, …), separate from package deps.
- `stack` keys are free-form (not a fixed enum) since apps vary — but common keys are `language`, `runtime`, `framework`, `styling`, `state`, `backend`, `database`, `hosting`, plus when evidenced `ai`, `billing`, `analytics`, `email`, `scraping`, `auth`.
- Generators may read `.env.example`-style templates for **key names only**; they must never read real `.env` files.
- Keep the body short enough to skim in under a minute.
- Re-generate rather than hand-maintain where possible — see `generator/`.
- Machine validation uses [`site/schema/app-facts.schema.json`](./site/schema/app-facts.schema.json), published at `https://appfacts.dev/schema/app-facts.schema.json`.

## Staleness (`--check`)

Generators may write `generated.inputs_fingerprint`. Running with `--check` re-scans the repo and exits non-zero if the fingerprint no longer matches (or the file / fingerprint is missing). Intended for CI.

## Portable viewer (`/v`)

Generators may also emit `APP_FACTS.png`, a QR code whose URL is:

`https://appfacts.dev/v#af1.<base64url(zlib(json))>`

The JSON is a compact subset of the frontmatter (`name`, `type`, `status`, `license`, `stack`, `deps`, optional `svc` / `build` / links). The static page at `/v` inflates the fragment and renders a nutrition-label UI. No backend storage.

## Versioning

This is v0.1 — the required-field list may still change before v1.0. Files should declare `app_facts_version` so tooling can handle multiple spec versions.

## License

CC0 — public domain. No attribution required.
