---
app_facts_version: 0.1.0
name: ForgeTrail
type: spec / tooling
status: active
license: Apache-2.0
homepage: https://forgetrail.dev
repository: https://github.com/Catalyst-Forge-LLC/forgetrail
stack:
  language: "JavaScript, TypeScript"
  runtime: Node.js
  tooling: "Model Context Protocol (MCP)"
  hosting: Cloudflare
key_dependencies:
  - name: "@modelcontextprotocol/sdk"
    purpose: Model Context Protocol server implementation
  - name: zod
    purpose: Schema validation and type inference
  - name: wrangler
    purpose: Cloudflare deployment tool
  - name: getfilepress
    purpose: File-based content management
services:
  - name: Cloudflare
    role: hosting provider for website
build:
  package_manager: pnpm
  test: undisclosed
  ci: undisclosed
generated:
  date: 2026-08-20
  generator: "appfacts-cli v0.1.0 (ollama:gemma4:12b)"
  inputs_fingerprint: 80474633db4f5705
credits:
  generated_with: https://appfacts.dev
  built_by: "Catalyst Forge — https://www.catalystforge.com/"
---

# ForgeTrail

`spec / tooling` · **active** · Apache-2.0

Curated stack label for this repository — aimed at an under-a-minute skim.

**[Open visual label →][appfacts-label]** · or scan `APP_FACTS.png`

[Homepage](https://forgetrail.dev) · [Repository](https://github.com/Catalyst-Forge-LLC/forgetrail)

### Stack

| Layer | Choice |
| --- | --- |
| Language | JavaScript, TypeScript |
| Runtime | Node.js |
| Tooling | Model Context Protocol (MCP) |
| Hosting | Cloudflare |

### Key dependencies

- `@modelcontextprotocol/sdk` — Model Context Protocol server implementation
- `zod` — Schema validation and type inference
- `wrangler` — Cloudflare deployment tool
- `getfilepress` — File-based content management

### Services

- **Cloudflare** — hosting provider for website

### Build

- **Package Manager** — pnpm

---
*Generated with [AppFacts](https://appfacts.dev) · Built by [Catalyst Forge](https://www.catalystforge.com/) · [Visual label][appfacts-label]*

[appfacts-label]: https://appfacts.dev/v#af1.eNp1Uk1r3DAQ_StiTg1o10mOPrUYcihJCCS3UsqsNNaqK2uENHbiLvvfi2x320tvg3hf8zRnmKC90xBxIGjhgbOjt4w-gAaZU30riYxqlDAHHx1oKIIyFmgBjfiJQEPwhmKp4C8JzZF29_vbFWhO0J4hYHQjugr4ihO-muyTaPU2J1pn0JDHKH4J8cyW9j9LTbB5tvDEloLqOAp9iHrJLGw4qE9P3csNaDhykRXYBR5tHzATXDRYSgXab2eI0MLnoYqYVSNtEk2xJ9CQ_u9RKE-UlR9SoIGioHiOcNGr6C-2G_3VHGlANWHwdsEojFbVEpWPPWWKhq6094zRBcob929qZSkFnqvRUvmV4Uh6HyhlKmVjPfhAuwMWsmrZKooaMKJbYsLlu4Yymev6_zSjIUP7pzSVMk_eUlY9Z_VOh-KFFvZh9MHW_0toTujox6peuSmmoRacKXHxwnmugiKptE3jvBzHw97w0HQoGOYiu-Wydo-PXdPXSZYbu_wGeaPbgQ
