# AppFacts Specification — v0.1.1

## File

A file named `APP_FACTS.md`, placed at the root of a repository, alongside `README.md`.

## Structure

The file has two parts:

1. **YAML frontmatter** — the **sole source of truth**. Structured, validated, machine-parseable.
2. **Markdown body** — a **rendered view** of the frontmatter for humans (nutrition-label style).

Hand edits to the body are fine for local readability, but the body **MAY drift** from the frontmatter if either side is edited by hand. Tooling does **not** verify body-vs-frontmatter consistency. Regenerating from the frontmatter (re-running a generator, or any future “render body from FM” tool) should always be possible; that is how you resync the table.

## Required frontmatter fields

| Field | Type | Description |
|---|---|---|
| `app_facts_version` | string | Spec version this *file* conforms to, e.g. `"0.1.0"` |
| `name` | string | App/project name |
| `type` | string | Free-form. Recommended: `"web app (SPA)"`, `"web app (SSR)"`, `"CLI tool"`, `"API service"`, `"mobile app"`, `"library"`, `"spec / tooling"`, `"monorepo"`, `"desktop app"`, `"other"` |
| `status` | enum | One of: `active`, `maintenance`, `archived`, `experimental` |
| `license` | string | SPDX identifier, e.g. `"MIT"`, or `"UNKNOWN"` |
| `stack` | map\<string,string\> | Layer name → choice. **MUST contain at least one entry.** |
| `key_dependencies` | list of `{name, purpose}` | Curated packages — **0–8 items** (empty array allowed) |
| `build` | map\<string,string\> | e.g. `package_manager`, `test`, `ci` (may be `{}`) |
| `generated` | object | `date`, `generator`; optional `inputs_fingerprint` |

If the stack cannot be determined, generators **MUST** still emit a non-empty `stack` so validation succeeds — e.g. `language: unknown` — rather than an empty map.

## Optional fields

| Field | Type | Description |
|---|---|---|
| `homepage` | string (URL) | |
| `repository` | string (URL) | Recommended when a public git remote exists |
| `services` | list of `{name, role}` | Curated third-party / hosted integrations — **0–6 items** when present; omit the field or use `[]` |
| `generated.inputs_fingerprint` | string | 16-char hex SHA-256 prefix of scanned inputs; enables `--check` |
| `credits.generated_with` | string (URL) | e.g. `"https://appfacts.dev"` |
| `credits.built_by` | string | Author/consultancy name + link |

## Conventions

- Curate, don't dump. `key_dependencies` is not `package.json`'s full tree — **0–8** items that actually explain the app's shape (schema `maxItems: 8`, no `minItems`).
- `services` is for hosted integrations (Stripe, PostHog, Resend, …), separate from package deps — **at most 6** (schema `maxItems: 6`, field optional).
- `stack` keys are free-form (not a fixed enum) — but the map **must** have ≥1 entry (schema `minProperties: 1`). Common keys: `language`, `runtime`, `framework`, `styling`, `state`, `backend`, `database`, `hosting`, plus when evidenced `ai`, `billing`, `analytics`, `email`, `scraping`, `auth`.
- Generators may read `.env.example`-style templates for **key names only**; they must never read real `.env` files.
- Keep the body short enough to skim in under a minute.
- Re-generate rather than hand-maintain where possible — see `generator/`.
- **Canonical schema URL** (matches the schema `$id`):  
  [`https://appfacts.dev/schema/app-facts.schema.json`](https://appfacts.dev/schema/app-facts.schema.json)  
  Source in this repo: [`site/schema/app-facts.schema.json`](./site/schema/app-facts.schema.json).

## Staleness (`--check`)

Generators may write `generated.inputs_fingerprint`. Running with `--check` re-scans the repo and exits non-zero if the fingerprint no longer matches (or the file / fingerprint is missing). Intended for CI.

**Scope:** `--check` verifies only *scanned repo inputs vs. the recorded fingerprint* — i.e. “has the project changed since this file was generated.” It does **not** verify that the Markdown body matches the frontmatter.

### Fingerprint canonicalization

`generated.inputs_fingerprint` is the **first 16 characters of the lowercase hex SHA-256 digest** (first 8 bytes) of a **canonical UTF-8 text** built from the scan. Independent implementations MUST produce the same string for the same scan inputs.

This is **not** a raw concatenation of file bytes. Generators hash a deterministic, line-oriented serialization of *derived scan facts* (so JSON escaping and filesystem quirks cannot diverge).

#### Included inputs (derived facts)

| Fact channel | How it contributes to the hash text |
|---|---|
| Manifests | For each manifest path (repo-relative, POSIX `/`), label `manifest:<path>` then the **canonical text** used in the LLM prompt (for `package.json`: structured dependency-*name* summary; other manifests: file text with newlines normalized CRLF→LF, typically truncated when read for prompting — the same bytes fed into the fingerprint). |
| Signal files | `LICENSE*`, `SPEC.md`, etc.: label `signal:<name>` then normalized text excerpt. |
| README | Label `readme` then normalized excerpt (or empty string). |
| Top-level tree | Label `tree` then sorted entry names (`dir/` suffix for directories), joined with `\n`. |
| Language census | Label `languages` then sorted `Language:count` lines; label `fileTypes` then sorted `ext:count`; label `notable` then sorted relative paths of code files (vendored dirs excluded from the census). |
| Env templates | For each `.env.example`-style file: label `envTemplate:<path>` then **sorted key names only**, one per line — **never values**. Real `.env` / `.env.local` / `.env.prod` files are **excluded**. |
| Shape configs | Framework config excerpts: label `shapeConfig:<filename>` then normalized excerpt. |
| Deploy / CI | Label `deploySignals` then sorted paths; label `ciWorkflows` then sorted workflow filenames. |
| Lockfile PM | Label `packageManager` then the detected manager string, or empty. |
| Flags | `hasCi` → `1`/`0`; `hasDocker` → `1`/`0`. |
| Git remote | Label `gitRemote` then the raw `origin` URL string (or empty). Alias resolution for the published `repository` field does **not** change this input. |

**Excluded from the fingerprint:** application source bodies (beyond the language census path/count signals), real secret env files, `node_modules` / VCS / build dirs skipped by the scanner, and the contents of `APP_FACTS.md` itself.

#### Pseudocode

```
lines ← []

for (path, text) in sort_by_key(manifests):
    append lines, "manifest:" + path
    append lines, text                    # already CRLF→LF normalized

for (name, text) in sort_by_key(signals):
    append lines, "signal:" + name
    append lines, text

append lines, "readme", readme_excerpt_or_empty
append lines, "tree", join(sort(tree_entries), "\n")
append lines, "languages", join(sort("Lang:count"…), "\n")
append lines, "fileTypes", join(sort("ext:count"…), "\n")
append lines, "notable", join(sort(notable_paths), "\n")

for (path, keys) in sort_by_key(env_templates):
    append lines, "envTemplate:" + path
    append lines, join(sort(keys), "\n")   # KEY NAMES ONLY

for (name, text) in sort_by_key(shape_configs):
    append lines, "shapeConfig:" + name
    append lines, text

append lines, "deploySignals", join(sort(deploy_paths), "\n")
append lines, "ciWorkflows", join(sort(workflow_names), "\n")
append lines, "packageManager", package_manager_or_empty
append lines, "hasCi", "1" if has_ci else "0"
append lines, "hasDocker", "1" if has_docker else "0"
append lines, "gitRemote", git_remote_or_empty

payload ← join(lines, "\n") as UTF-8
digest  ← SHA-256(payload) as lowercase hex
fingerprint ← digest[0:16]
```

Sort keys and paths with **byte-wise / code-unit** ordering on the UTF-8/JS string (not locale-aware collation). Newlines inside file texts are normalized to LF before inclusion.

## Portable viewer (`/v`)

Generators may also emit `APP_FACTS.png`, a QR code whose URL is:

`https://appfacts.dev/v#af1.<payload>`

The compact JSON schema, encode/decode steps, size limits, and versioning rules are defined in **[`SPEC-af1.md`](./SPEC-af1.md)**. Summary: zlib-compressed, base64url (no padding) JSON subset of the frontmatter; the static page at `/v` inflates the fragment client-side. **No backend storage.**

## Versioning

- **This document:** v0.1.1 (clarifications and companion `af1` spec; does not invalidate existing `app_facts_version: 0.1.0` files).
- **Files** declare `app_facts_version` (currently `"0.1.0"`) so tooling can evolve independently of the prose document.
- Required-field list may still change before v1.0.

## Revision history

| Spec doc | Notes |
|---|---|
| **0.1.1** | Document `af1` payload (`SPEC-af1.md`); pin fingerprint canonicalization; clarify body drift vs `--check`; canonical schema URL first; state `stack` ≥1 entry; confirm `key_dependencies` 0–8 and `services` 0–6 bounds. |
| **0.1** | Initial required fields, conventions, `--check`, `/v` overview. |

## License

CC0 — public domain. No attribution required.
