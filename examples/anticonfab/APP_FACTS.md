---
app_facts_version: 0.1.0
name: anticonfab
type: "web app (SSR)"
status: active
license: MIT
stack:
  language: "TypeScript, Svelte, JavaScript"
  runtime: Node.js
  framework: SvelteKit
  styling: Tailwind CSS
  hosting: local server
  ai: Ollama
key_dependencies:
  - name: "@sveltejs/kit"
    purpose: primary web framework
  - name: ollanet
    purpose: network discovery for LLM hosts
  - name: zod
    purpose: schema validation
  - name: jsonrepair
    purpose: fix malformed JSON from LLMs
  - name: tippy.js
    purpose: tooltip UI component
services:
  - name: Ollama
    role: local LLM provider
build:
  package_manager: pnpm
  test: svelte-check
  ci: undisclosed
generated:
  date: 2026-08-20
  generator: "appfacts-cli v0.1.0 (ollama:gemma4:12b)"
  inputs_fingerprint: c85beddca4a712b4
---

# anticonfab

`web app (SSR)` · **active** · MIT

Curated stack label for this repository — aimed at an under-a-minute skim.

**[Open visual label →][appfacts-label]** · or scan `APP_FACTS.png`

### Stack

| Layer | Choice |
| --- | --- |
| Language | TypeScript, Svelte, JavaScript |
| Runtime | Node.js |
| Framework | SvelteKit |
| Styling | Tailwind CSS |
| Hosting | local server |
| AI | Ollama |

### Key dependencies

- `@sveltejs/kit` — primary web framework
- `ollanet` — network discovery for LLM hosts
- `zod` — schema validation
- `jsonrepair` — fix malformed JSON from LLMs
- `tippy.js` — tooltip UI component

### Services

- **Ollama** — local LLM provider

### Build

- **Package Manager** — pnpm
- **Test** — svelte-check

---
*Generated with [AppFacts](https://appfacts.dev) · Scan `APP_FACTS.png` or open the [visual label][appfacts-label]*

[appfacts-label]: https://appfacts.dev/v#af1.eNpFkktv2zAQhP8KMacGYFv0qlOAnpLmAUTJKSiKNbWS1-ILJC1HNfTfC0quc-V-M5wd8owJzQ8NT47RgHwRE3xPO2iUOdazE-8Uxai-tO3LDTRyoXLMFTZFJoaGFcM-V_bx7nUjzIjmDEt-ONJQJ69z5NYkiUWrdmJbWKt7mmg7g0Y6-iJriKfQ8bdDhkafyPEppBENNtEvKesFsxU_VFsSexLfqZ9tC419yGUb2GDIqsxp4gQNEjR4tpYcYdHoOGY072d4NLjNq_Uhfx9X94gGMYmjNKu6_GeKRW-KYC15_s96LnWqOskmTJxm1YekHh4eVY2Tr6q_obsostmzIzWRlY6KBH9lDjn4xJEkXdBePpQj24fkuFP37fOT6lNw1f7TuUiM81ZZ1ZQQbJGo3u6UCS4Gz75g-a2RJ3Pd-lKGRrq2VSPHFCbpOK387ii2qw8ZyYw08B9Hngauiuijq3-Ec6kLrQ1-NXs2I5blHyoExjs
