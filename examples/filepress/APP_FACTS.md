---
app_facts_version: 0.1.0
name: filepress
type: monorepo
status: active
license: MIT
repository: https://github.com/Catalyst-Forge-LLC/filepress
stack:
  language: "TypeScript, Svelte, JavaScript, CSS, HTML"
  runtime: Node.js
  framework: SvelteKit
  styling: CSS
  build: Vite
  hosting: Cloudflare Pages
  cli: filepress
key_dependencies:
  - name: "@sveltejs/kit"
    purpose: main framework
  - name: svelte
    purpose: frontend framework
  - name: vite
    purpose: build tool
  - name: turndown
    purpose: HTML conversion
  - name: fast-xml-parser
    purpose: XML parsing
  - name: wrangler
    purpose: deployment tool
  - name: unified
    purpose: content processing
services:
  - name: Cloudflare Pages
    role: hosting
  - name: Ollama
    role: local AI execution
build:
  package_manager: pnpm
  test: svelte-check
  ci: unknown
generated:
  date: 2026-08-28
  generator: "appfacts-cli v0.1.0 (ollama:gemma4:12b)"
  inputs_fingerprint: 639186f958222b98
credits:
  generated_with: https://appfacts.dev
  built_by: "Catalyst Forge — https://www.catalystforge.com/"
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
| Styling | CSS |
| Build | Vite |
| Hosting | Cloudflare Pages |
| CLI | filepress |

### Key dependencies

- `@sveltejs/kit` — main framework
- `svelte` — frontend framework
- `vite` — build tool
- `turndown` — HTML conversion
- `fast-xml-parser` — XML parsing
- `wrangler` — deployment tool
- `unified` — content processing

### Services

- **Cloudflare Pages** — hosting
- **Ollama** — local AI execution

### Build

- **Package Manager** — pnpm
- **Test** — svelte-check

---
*Generated with [AppFacts](https://appfacts.dev) · Built by [Catalyst Forge](https://www.catalystforge.com/) · [Visual label][appfacts-label]*

[appfacts-label]: https://appfacts.dev/v#af1.eNptktFr2zAQxv8VoWenZq952giMdU27QUIpjDJU-eyoPeuEdHJqQv_3nRzHa6FPxt_9dPfdJ530oNdfKu1ND3qtW4cQIqSkK81jKFJPniIEEiWx4ZxEM5bdAKKgs-BTwW6v92fCvuj1SaPxXTZdqeylz85GF7hSuwGQoVI_zWAu2ma3q9SP_e1Wzsfs2U1O7qiBq-fio43i7UhR-urz-RvH06wRne9ElQ7y_5QdNvJ377hYO1DiuYyUmxZNBPVbLJWeFt2Hbd8q3UCQ1f6ctJfK1zQNek71yzQrlCCM8-q_mbfqjJ7JmWkjeQbffMINbqEmp4qJcKlyjr6ho5-JEoey5AeIyZFfsNYkXr32uAomJogz_SBwEcq6F_IY5QZwQWQ7pLEHzx_nZu9aB81M2ck9qxDJSixTv0dJerBLMp-EGUW-pH3p-wvR9GYuIlmD6tu1glewmaeFHpcLO-kgj0Z6_e2Nl085EXzoyxOExEvEK3sAW_LU5TkmxxTHMpk5pHVdd44P-enKUl9vDBscJanvFDtYbbeb-t1V_wOMmPsr
