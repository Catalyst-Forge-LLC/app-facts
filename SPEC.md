# AppFacts Specification — v0.1.3

## File

A file named `APP_FACTS.md`, placed at the root of a repository, alongside `README.md`.

## Structure

The file has two parts:

1. **YAML frontmatter** — the **sole source of truth**. Structured, validated, machine-parseable.
2. **Markdown body** — a **rendered view** of the frontmatter for humans (nutrition-label style).

Hand edits to the body are fine for local readability, but the body **MAY drift** from the frontmatter if either side is edited by hand. Tooling does **not** verify body-vs-frontmatter consistency. Regenerating from the frontmatter (re-running a generator, or any future "render body from FM" tool) should always be possible; that is how you resync the table.

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

**Scope:** `--check` verifies only *scanned repo inputs vs. the recorded fingerprint* — i.e. "has the project changed since this file was generated." It does **not** verify that the Markdown body matches the frontmatter.

### Fingerprint canonicalization

`generated.inputs_fingerprint` is the **first 16 characters of the lowercase hex SHA-256 digest** (first 8 bytes) of a **canonical UTF-8 text** built from the scan. Independent implementations MUST produce the same string for the same scan inputs.

This is **not** a raw concatenation of file bytes, and it is **independent of the LLM prompt.** The fingerprint has its own frozen contract: changing how the generator *summarizes inputs for prompting* MUST NOT change the fingerprint. Generators hash a deterministic, line-oriented serialization of *derived scan facts* (so JSON escaping and filesystem quirks cannot diverge).

#### Serialization framing (normative)

The canonical text is built by appending **entries** to an ordered list, then joining that list with a single `\n` (U+000A). The following rules make the join unambiguous:

- Every `append` in the pseudocode below contributes **exactly one entry** to the list, **including when the value is the empty string**. An empty value contributes an empty entry (which becomes an empty line after the join), never zero entries.
- A label and its value are appended as **two separate entries** (a label entry, then a value entry), each contributing one line.
- Newlines **inside** a value are normalized to LF (`\r\n` and `\r` → `\n`) and are otherwise **preserved as-is**. Because framing is by entry-count and fixed ordering — not by scanning for newlines — embedded newlines in a value do not affect parsing or the digest, provided every implementation builds the same ordered list.
- No trailing newline is added after the final entry beyond what the join produces.

Sort keys and paths with **byte-wise / code-unit** ordering on the UTF-8/JS string (not locale-aware collation).

#### Included inputs (derived facts)

| Fact channel | How it contributes to the hash text |
|---|---|
| Manifests | For each manifest path (repo-relative, POSIX `/`), a label entry `manifest:<path>` then a value entry of that manifest's **fingerprint canonical form** (defined below — this is a fixed serialization, **not** the prompt summary). |
| Signal files | `LICENSE*`, `SPEC.md`, etc.: label `signal:<name>` then normalized text excerpt (see excerpt limit below). |
| README | Label `readme` then normalized excerpt (or empty string). |
| Top-level tree | Label `tree` then sorted entry names (`dir/` suffix for directories), joined with `\n`. |
| Language census | Label `languages` then sorted `Language:count` lines; label `fileTypes` then sorted `ext:count`; label `notable` then sorted relative paths of code files (vendored dirs excluded from the census). |
| Env templates | For each `.env.example`-style file: label `envTemplate:<path>` then **sorted key names only**, one per line — **never values**. Real `.env` / `.env.local` / `.env.prod` files are **excluded**. |
| Shape configs | Framework config excerpts: label `shapeConfig:<filename>` then normalized excerpt (see excerpt limit below). |
| Deploy / CI | Label `deploySignals` then sorted paths; label `ciWorkflows` then sorted workflow filenames. |
| Lockfile PM | Label `packageManager` then the detected manager string, or empty. |
| Flags | `hasCi` → `1`/`0`; `hasDocker` → `1`/`0`. |
| Git remote | Label `gitRemote` then the raw `origin` URL string (or empty). Alias resolution for the published `repository` field does **not** change this input. |

**Excerpt limit (normative):** wherever an entry above says "excerpt," the value is the file's text with newlines normalized to LF, then truncated to the **first 8192 bytes of UTF-8** (not characters). If truncation would split a multi-byte UTF-8 sequence, drop the trailing partial sequence so the excerpt is always valid UTF-8. This limit is a fixed constant of the fingerprint contract and is independent of any (possibly different) limit the generator uses when reading files for prompting.

**Manifest fingerprint canonical form (normative).** For the fingerprint, each manifest is reduced to a fixed, prompt-independent serialization:

- **`package.json`:** the union of the `dependencies`, `devDependencies`, `peerDependencies`, and `optionalDependencies` objects, emitted as `name@versionRange` lines (the raw version-range string as written in the file), **sorted byte-wise by the full `name@versionRange` line**, joined with `\n`. No other `package.json` fields contribute. If a dependency object is absent, it contributes nothing.
- **`Cargo.toml`, `pyproject.toml`, `Gemfile`, `composer.json`, `go.mod`, `pubspec.yaml`, and any other recognized manifest:** the file's text with newlines normalized to LF, then truncated per the excerpt limit above.

Rationale: `package.json`'s dependency set is the high-signal, low-noise part and is worth extracting deterministically; other manifests are hashed as normalized text because their formats are already reasonably stable and extracting each would add spec surface without much benefit. In all cases the serialization is fixed here and does **not** track the prompt.

#### Pseudocode

```
lines ← []                                # each append adds exactly one entry

for (path, manifest) in sort_by_key(manifests):
    append lines, "manifest:" + path
    append lines, manifest_fingerprint_form(manifest)   # fixed form, NOT the prompt summary

for (name, text) in sort_by_key(signals):
    append lines, "signal:" + name
    append lines, excerpt(text)           # LF-normalized, ≤8192 UTF-8 bytes

append lines, "readme"
append lines, excerpt(readme_text) or ""

append lines, "tree"
append lines, join(sort(tree_entries), "\n")

append lines, "languages"
append lines, join(sort("Lang:count"…), "\n")
append lines, "fileTypes"
append lines, join(sort("ext:count"…), "\n")
append lines, "notable"
append lines, join(sort(notable_paths), "\n")

for (path, keys) in sort_by_key(env_templates):
    append lines, "envTemplate:" + path
    append lines, join(sort(keys), "\n")  # KEY NAMES ONLY

for (name, text) in sort_by_key(shape_configs):
    append lines, "shapeConfig:" + name
    append lines, excerpt(text)

append lines, "deploySignals"
append lines, join(sort(deploy_paths), "\n")
append lines, "ciWorkflows"
append lines, join(sort(workflow_names), "\n")
append lines, "packageManager"
append lines, package_manager or ""
append lines, "hasCi"
append lines, "1" if has_ci else "0"
append lines, "hasDocker"
append lines, "1" if has_docker else "0"
append lines, "gitRemote"
append lines, git_remote or ""

payload ← join(lines, "\n") encoded as UTF-8
digest  ← SHA-256(payload) as lowercase hex
fingerprint ← digest[0:16]
```

Every label and every value is its own entry (its own line after the join), including empty values. Newlines inside a value are normalized to LF before inclusion.

## Portable viewer (`/v`)

Generators may also emit `APP_FACTS.png`, a QR code whose URL is:

`https://appfacts.dev/v#af1.<payload>`

The compact JSON schema, encode/decode steps, size limits, and versioning rules are defined in **[`SPEC-af1.md`](./SPEC-af1.md)**. Summary: zlib-compressed, base64url (no padding) JSON subset of the frontmatter; the static page at `/v` inflates the fragment client-side. **No backend storage.**

## Publication & discovery

Suite contract: [x-facts `DISCOVERY-AND-PUBLICATION.md`](../x-facts/specs/DISCOVERY-AND-PUBLICATION.md).

| | |
|---|---|
| **Canonical file** | Repo root `APP_FACTS.md` |
| **Primary pointer** | The public repository; README badge or link to the raw file and/or `/v` |
| **Fallback** | `/.well-known/x-facts/app.md` on the product homepage when there is no public git root |

Generators **SHOULD** print a canonical URL (when known) and the viewer URL when a portable payload is emitted. The `/v` card is for human share/skim, not the machine SoT.

## Versioning

- **This document:** v0.1.3 (publication & discovery; see revision history). Does not invalidate existing files.
- **Files** declare `app_facts_version` (currently `"0.1.0"`) so tooling can evolve independently of the prose document. Generators MUST emit the **file-format** version (`"0.1.0"`), not this document's version.
- Required-field list may still change before v1.0.

## Revision history

| Spec doc | Notes |
|---|---|
| **0.1.3** | Publication & discovery: repo-root pointer, well-known fallback, link to suite discovery contract. |
| **0.1.2** | Make the fingerprint deterministic and prompt-independent: pin the `package.json` manifest canonical form (sorted `name@versionRange`), fix an 8192-byte excerpt limit for all excerpted inputs, and add normative serialization-framing rules (one entry per append, embedded newlines preserved, empty values still contribute a line). Clarify generators emit file-format version `0.1.0`, not the doc version. |
| **0.1.1** | Document `af1` payload (`SPEC-af1.md`); pin fingerprint canonicalization; clarify body drift vs `--check`; canonical schema URL first; state `stack` ≥1 entry; confirm `key_dependencies` 0–8 and `services` 0–6 bounds. |
| **0.1** | Initial required fields, conventions, `--check`, `/v` overview. |

## License

CC0 — public domain. No attribution required.
