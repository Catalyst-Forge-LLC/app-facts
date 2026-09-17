---
app_facts_version: 0.1.0
name: ForeBalance
version: 0.2.0
type: "web app (SPA)"
status: active
license: MIT
homepage: https://forebalance.app
repository: https://github.com/Catalyst-Forge-LLC/forebalance
stack:
  language: TypeScript
  runtime: browser
  framework: SvelteKit
  styling: Sass
  editor: CodeMirror
  storage: localStorage
  hosting: Cloudflare Pages
  build: Vite
key_dependencies:
  - name: "@sveltejs/kit"
    purpose: SvelteKit app shell
  - name: svelte
    purpose: UI
  - name: "@sveltejs/adapter-static"
    purpose: static export
  - name: codemirror
    purpose: transaction editor
  - name: dayjs
    purpose: date math
  - name: marked
    purpose: in-app help and about
  - name: sass
    purpose: styles
services:
  - name: Cloudflare Pages
    role: static hosting
build:
  package_manager: pnpm
  test: vitest
  ci: GitHub Actions
generated:
  date: 2026-09-17
  generator: publisher-authored
  inputs_fingerprint: 03550e5aaffe1b4a
reviewed:
  date: 2026-09-17
  by: Catalyst Forge
  status: publisher-authored
credits:
  generated_with: https://appfacts.dev
  built_by: "Catalyst Forge — https://www.catalystforge.com/"
---

# ForeBalance

`web app (SPA)` · **active** · MIT · v0.2.0

Curated stack label for this repository — aimed at an under-a-minute skim.

**[Open visual label →][appfacts-label]** · or scan `APP_FACTS.png`

[Homepage](https://forebalance.app) · [Repository](https://github.com/Catalyst-Forge-LLC/forebalance)

### Stack

| Layer | Choice |
| --- | --- |
| Language | TypeScript |
| Runtime | browser |
| Framework | SvelteKit |
| Styling | Sass |
| Editor | CodeMirror |
| Storage | localStorage |
| Hosting | Cloudflare Pages |
| Build | Vite |

### Key dependencies

- `@sveltejs/kit` — SvelteKit app shell
- `svelte` — UI
- `@sveltejs/adapter-static` — static export
- `codemirror` — transaction editor
- `dayjs` — date math
- `marked` — in-app help and about
- `sass` — styles

### Services

- **Cloudflare Pages** — static hosting

### Build

- **Package Manager** — pnpm
- **Test** — vitest
- **CI** — GitHub Actions

---
*Generated with [AppFacts](https://appfacts.dev) · Built by [Catalyst Forge](https://www.catalystforge.com/) · [Visual label][appfacts-label]*

[appfacts-label]: https://appfacts.dev/v#af1.eNptkk1v2zAMhv-KwdMKKA161WldgG7FWqBAul2GYaAlxlYtS4JIJzOC_PdBtvNx2E0iH5IvX-kIe9APCgL2BBqeYqYv6DEYAgUyphI8UF1hStWn7dvjHShgQRkYNKARty-gd4YCF_b1-X0mTAf6CB5DM2BTMu9joq3JLgkoyEMQN02sczwwZVCwy9jTIeYONGz35IW-O5majd6FpkSRGRSQdRIzaNhES68u55gnLOZ5ko8G_Xa5Kmgjy1y_8XGwO4-ZqjdsqPSqB-ctaPjphOCkwFJi0L-OEEDDZ55kfPC6m5SkW2WTJdyS93BSMz_jC_jj-RK_9kGLSSivioXOLOR8qehvilkuRSZa6s_LFUwyBi6Wx1AtFpxZi-MHL5hFoapHaS_ZHnNHdkm7sCrCW_KpwmArrONwHcqzw7Oq0RPD6bcC3puLJ__xMF93OHtdqhZrj5DQdNjQnx4DNlToFFJf_hexgIa9mw4KjAMNX518G-rqcVqUy5u0sac0P20rkliv17uYqZ7_6T2mVERQilxMGW-wxkk71Pcm9usNCvqRZfUUc0Orl5fNbRM4_QOCAQLO
