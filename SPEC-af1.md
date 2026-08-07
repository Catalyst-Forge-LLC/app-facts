# AppFacts compact viewer payload — `af1`

Companion to [`SPEC.md`](./SPEC.md). Defines the **portable `/v` fragment** that QR codes and shareable links use.

This document describes the format **as emitted by the current generators**. A second implementer should be able to encode and decode interoperable `/v` links from this text alone.

## URL shape

```
https://appfacts.dev/v#af1.<payload>
```

| Part | Meaning |
|---|---|
| Origin + path | `https://appfacts.dev/v` (static page; no server storage) |
| Fragment prefix | Literal `af1.` — payload format version **1** |
| `<payload>` | Compact JSON, compressed and encoded (below) |

### Encode (order of operations)

1. Build the compact JSON object (schema below).
2. Serialize to UTF-8 JSON text with no insignificant whitespace  
   (`JSON.stringify` / `json.dumps(..., separators=(",", ":"), ensure_ascii=False)`).
3. Compress with **zlib** (RFC 1950 wrapper around deflate), compression level 9 preferred.
4. Encode the compressed bytes as **base64url** (URL-safe alphabet `-` and `_`).
5. **Strip padding** `=` characters (none are written into the fragment).
6. Concatenate: `af1.` + base64url bytes as ASCII.
7. Form the full URL: `https://appfacts.dev/v#` + that string.

### Decode (order of operations)

1. Take `location.hash` (or the fragment after `#`); strip a leading `#` if present.
2. Require a recognized version prefix (`af1.` today). See [Version token](#version-token).
3. Take the substring after the prefix.
4. Restore base64 padding if needed (`length % 4`), map `-`→`+`, `_`→`/`, then standard base64-decode to bytes.
5. Inflate with zlib (raw **deflate** stream as produced by zlib compress — browsers: `DecompressionStream("deflate")`).
6. UTF-8-decode the result and `JSON.parse`.
7. Validate required fields (`v === 1`, `name` present, etc.) before rendering.

## Version token

- The literal prefix `af1` (written as `af1.` before the payload) denotes **format version 1**.
- The compact JSON also carries `"v": 1` as a redundant inner version for the JSON schema of this payload.
- Decoders **MUST** reject fragments whose prefix is not a recognized `afN.` token.
- Decoders **SHOULD** show a user-facing message such as:  
  *Label format not supported — update your viewer.*  
  rather than failing silently or treating an unknown prefix as “missing payload.”
- Future formats (`af2.`, …) may change key names or compression; old viewers must not attempt to decode them as `af1`.

## Compact JSON schema (`af1`)

Grounded in the shipped generators (`generator/viewer_codec.js` and the matching Python helpers).

| Compact key | Frontmatter source | Type | Required | Notes |
|---|---|---|---|---|
| `v` | *(payload format)* | number | yes | Always `1` for `af1` |
| `name` | `name` | string | yes | |
| `type` | `type` | string | yes | |
| `status` | `status` | string | yes | Same enum as frontmatter |
| `license` | `license` | string | yes | SPDX id or `UNKNOWN` |
| `stack` | `stack` | object\<string, string\> | yes | Same shape as frontmatter; ≥1 entry |
| `deps` | `key_dependencies` | array | no* | Usually present (may be `[]`). Max **8** items |
| `svc` | `services` | array | no | Omitted when empty. Max **6** items |
| `build` | `build` | object\<string, string\> | no | Entries with value `unknown` (case-insensitive) are dropped |
| `homepage` | `homepage` | string (URL) | no | |
| `repository` | `repository` | string (URL) | no | |

\*Generators always include `deps` (possibly empty). Decoders SHOULD treat a missing `deps` as `[]`.

### `deps[]` items

| Key | Frontmatter source | Type | Required |
|---|---|---|---|
| `n` | `key_dependencies[].name` | string | yes |
| `p` | `key_dependencies[].purpose` | string | no | May be omitted when shrinking for URL length |

### `svc[]` items

| Key | Frontmatter source | Type | Required |
|---|---|---|---|
| `n` | `services[].name` | string | yes |
| `r` | `services[].role` | string | yes |

### Example

```json
{
  "v": 1,
  "name": "Demo",
  "type": "web app (SSR)",
  "status": "active",
  "license": "MIT",
  "stack": { "language": "TypeScript", "framework": "SvelteKit" },
  "deps": [
    { "n": "@sveltejs/kit", "p": "SSR framework" },
    { "n": "stripe", "p": "Billing" }
  ],
  "svc": [
    { "n": "Stripe", "r": "Billing" },
    { "n": "PostHog", "r": "Analytics" }
  ],
  "build": { "package_manager": "pnpm", "ci": "GitHub Actions" },
  "homepage": "https://example.com",
  "repository": "https://github.com/acme/demo"
}
```

## Size guidance

Official generators target a **full URL length ≤ 1600 characters** (`https://appfacts.dev/v#…` inclusive) so phone cameras can still read the QR.

When the full payload exceeds that ceiling, generators **SHOULD** retry with progressive shrinkage (current order):

1. Drop `build`.
2. Keep services; reduce `deps` max to 5 and `svc` max to 4.
3. Drop dep purposes (`p`); keep the same caps.
4. Drop `svc` entirely; reduce `deps` max to 3.

If still over the limit after the last attempt, generators may still emit the last attempt (best-effort); scanners may fail on very long URLs.

## Optional fields (viewer UX)

| Key | Type | Notes |
|---|---|---|
| `raw` | string | Optional full Markdown (frontmatter + body). When present, the viewer flip face shows it verbatim. When absent, the viewer **reconstructs** a Markdown document from compact fields. |
| `truncated` | boolean | Optional. `true` when the encoder dropped fields to fit URL size. |

These keys are ignored by older viewers that only render the nutrition face.

## Face query

The viewer MAY accept `?face=raw` to open on the raw face:

```
https://appfacts.dev/v?face=raw#af1.<payload>
```

The fragment remains the sole payload carrier. The query only selects UI face
(label vs raw). Flip and copy-to-clipboard controls are part of the `/v` page UX
(suite plan: x-facts `specs/PORTABLE-VIEWER-AND-FLIP.md`).

## No-backend guarantee

The page at `/v` inflates and renders **entirely in the browser** from the URL fragment. Nothing from the fragment is stored or logged by appfacts.dev as part of normal operation. Treat the payload as **untrusted user-controlled data** (see the on-page trust banner).

## License

CC0 — public domain. No attribution required.
