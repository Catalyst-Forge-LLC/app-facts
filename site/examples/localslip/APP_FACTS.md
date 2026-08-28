---
app_facts_version: 0.1.0
name: localslip
type: "web app (SSR)"
status: active
license: Apache-2.0
homepage: https://localslip.dev
repository: https://github.com/Catalyst-Forge-LLC/localslip
stack:
  language: "TypeScript, Svelte, JavaScript, CSS, Shell, HTML"
  runtime: Node.js
  framework: SvelteKit
  styling: Tailwind CSS
  database: SQLite
  hosting: local
key_dependencies:
  - name: "@sveltejs/kit"
    purpose: web framework for the dashboard
  - name: better-sqlite3
    purpose: persistent storage for port leases
  - name: tailwindcss
    purpose: styling utility
  - name: tsx
    purpose: TypeScript execution for CLI scripts
build:
  package_manager: pnpm
  test: svelte-check
  ci: undisclosed
generated:
  date: 2026-08-20
  generator: "appfacts-cli v0.1.0 (ollama:gemma4:12b)"
  inputs_fingerprint: 781cbab31d853ca4
---

# localslip

`web app (SSR)` · **active** · Apache-2.0

Curated stack label for this repository — aimed at an under-a-minute skim.

**[Open visual label →][appfacts-label]** · or scan `APP_FACTS.png`

[Repository](https://github.com/Catalyst-Forge-LLC/localslip)

### Stack

| Layer | Choice |
| --- | --- |
| Language | TypeScript, Svelte, JavaScript, CSS, Shell, HTML |
| Runtime | Node.js |
| Framework | SvelteKit |
| Styling | Tailwind CSS |
| Database | SQLite |
| Hosting | local |

### Key dependencies

- `@sveltejs/kit` — web framework for the dashboard
- `better-sqlite3` — persistent storage for port leases
- `tailwindcss` — styling utility
- `tsx` — TypeScript execution for CLI scripts

### Build

- **Package Manager** — pnpm
- **Test** — svelte-check

---
*Generated with [AppFacts](https://appfacts.dev) · Scan `APP_FACTS.png` or open the [visual label][appfacts-label]*

[appfacts-label]: https://appfacts.dev/v#af1.eNpNUkFu2zAQ_ArBUwtIdprefGphIEhaJUCj3IqioKiNxJgiGe5KjmDk71lSqt2TgOHszOyOTnKSuy-FdGoAuZPWa2XRmiALSXNI0BEaoUIQn-r68TPDSIpG5AelyUzAiDUaHCbu96B0D-X15moh6oPcnaRVrhtVlwhPrFnraAIVop7AEhTih5rUP2xf1_zQg7WFuH26r1gmjo5MDvfgW9i8IGPPkeMefWR5ucj8NJQtZ2tcl4yUsUfj2qTID60i1aicsf5VGUqxe4-0kPPW8p1pEHiz3yfpGP2GWfkFt4csHtZjnM3Fs4-CehCtwr7xKrasscw2QASxxFfLXl_X4QARDRI4Ekg-8kWyQvCRhAVOh-d5WuNrxHV4XU2MZFhzvjDxbWVcbivgDTQTvcsG--pOYH5ggz-FbEZj21QMt3XgFH8H5fgTU0QXhlQ9ICXPfICSK-UiC6kNY6NrDWrrEdK2fMQBwtJtTxRwt92e_6FNC1MqEIJHwwvP_5E6Q_3YbLQftnvuxs5I5Y2PHZRVtb9IyPcPZOHjHg
