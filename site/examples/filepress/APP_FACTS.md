---
app_facts_version: 0.1.0
name: filepress
type: monorepo
status: active
license: MIT
homepage: https://getfilepress.com
repository: https://github.com/Catalyst-Forge-LLC/filepress
stack:
  language: "TypeScript, Svelte, JavaScript, CSS, HTML"
  runtime: Node.js
  framework: SvelteKit
  bundler: Vite
  styling: CSS
  hosting: Cloudflare Pages
key_dependencies:
  - name: "@sveltejs/kit"
    purpose: Core web framework
  - name: svelte
    purpose: UI component framework
  - name: vite
    purpose: Build tool and dev server
  - name: turndown
    purpose: Convert HTML to Markdown
  - name: unified
    purpose: Unified content processing pipeline
  - name: localberth
    purpose: Manage port leases for local development
services:
  - name: Cloudflare Pages
    role: Static hosting provider
build:
  package_manager: pnpm
  test: svelte-check
  ci: undisclosed
generated:
  date: 2026-08-20
  generator: "appfacts-cli v0.1.0 (ollama:gemma4:12b)"
  inputs_fingerprint: bacd4f5d243c913f
---

# filepress

`monorepo` · **active** · MIT

Curated stack label for this repository — aimed at an under-a-minute skim.

**[Open visual label →][appfacts-label]** · or scan `APP_FACTS.png`

[Repository](https://github.com/Catalyst-Forge-LLC/filepress)

### Stack

| Layer | Choice |
| --- | --- |
| Language | TypeScript, Svelte, JavaScript, CSS, HTML |
| Runtime | Node.js |
| Framework | SvelteKit |
| Bundler | Vite |
| Styling | CSS |
| Hosting | Cloudflare Pages |

### Key dependencies

- `@sveltejs/kit` — Core web framework
- `svelte` — UI component framework
- `vite` — Build tool and dev server
- `turndown` — Convert HTML to Markdown
- `unified` — Unified content processing pipeline
- `localberth` — Manage port leases for local development

### Services

- **Cloudflare Pages** — Static hosting provider

### Build

- **Package Manager** — pnpm
- **Test** — svelte-check

---
*Generated with [AppFacts](https://appfacts.dev) · Scan `APP_FACTS.png` or open the [visual label][appfacts-label]*

[appfacts-label]: https://appfacts.dev/v#af1.eNptkkGLGzEMhf-K0dnZoVefygZKt01KYbK9lKUotjLxxmMZWzNhCPnvxZNk9tAebX9Pen7SBUYwnzRE7AkMHHyglKkU0CBTqlc9R86UGDQUQRkKGEArfiTQELylWCq2fdndCHsCc4GAsRuwqy-7KVFrs0-iVTtSENLqG474uFu3rVZfd9sNaMhDFD87-cGOnt6rj0PGns6cT2Dgpv_uBTTsh-gCZTDwywvNzafgYwcG1m0LGo5c5H4OPLhDwEzqJ3ZU4KrBUSpgfl8ggoHPZS78XprTXDtVEWdSZ9qrDwNXfcNv9J17fVGW-8SRovyHHf1CPg8-OCXMQWF0ytGoCuWR8gLLkKPjc1wsxJGyzOkoYbXFfJqfH_wQ_cGTezi5nZTlKNVMymypFB87lXyi4CMtysAWw56yHO_iLUbsSCXOogJhoaIOnNXMVasUOPUUBa5vGspol-z-CVdDHUorKN6q-xCql9G7-tW3OjofXF2ThPaEHf3p5-ZVlmLq6_JRkSXolT2SrYlCXcTihfMEBo4iqZim6bwch_2T5b5Zo2CYiqy-cO5otdmsm4-Vvv4FzW_8rQ
