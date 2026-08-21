---
app_facts_version: 0.1.0
name: localberth
type: "web app (SSR)"
status: active
license: Apache-2.0
homepage: https://localberth.com
repository: https://github.com/Catalyst-Forge-LLC/localberth
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

# localberth

`web app (SSR)` · **active** · Apache-2.0

Curated stack label for this repository — aimed at an under-a-minute skim.

**[Open visual label →][appfacts-label]** · or scan `APP_FACTS.png`

[Repository](https://github.com/Catalyst-Forge-LLC/localberth)

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

[appfacts-label]: https://appfacts.dev/v#af1.eNpNUkuP1DAM_iuRTyClUx63nkAjIR4FCbo3hJCbetts0yTE7sxWo_nvKJmyy9X5Xv6cC5ygea3B40LQgAsGXU9JJtAgW8yzM_UKY1Qvuu7HS9DAgrIyNIBG7IlAg7OGPGfs-4hmourN4dUNaGZoLuDQjyuOGXC3RepMslG06k7khLT6jCf8Nzt2nVbdRM5p9fHuawsa0urFlnTfwkCHBwYN9wkXOoc0QwM3mS9WiuXmrB-zEVp3tn7IiqBhQMEeS8bue2slx54Cyw1c1oarhoEiQ_PzAh4aeMdF-YHruYjHvYwnc3UfkpKJ1IA89QHTAFd94_YkQqniP84Kvd3JkRJbFvKiWELCkYpCDEmUI2TiJ77s8Q3zTt5XU6tYZ2V7RvLjjnjuVtEjmVVs8MXg2H5SXB4Yrr809Kt1Qz5MRDPjSL8X9DhSyhF9XPLpiSV7lgIqM5GZcz2JYmArIW3QwCQSuanr0cq09gcTlvqIgm5jqT6ENFLVtsf6vx91_QtkIdFS
