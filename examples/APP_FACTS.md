---
app_facts_version: "0.1.0"
name: Acme Dashboard
type: web app (SPA)
status: active
license: MIT
homepage: https://dashboard.acme.example
repository: https://github.com/acme/dashboard
stack:
  language: TypeScript
  runtime: Node 20
  framework: React 18 + Vite
  styling: Tailwind CSS
  state: Zustand
  backend: Fastify
  database: PostgreSQL 16
  hosting: Vercel (web) · Fly.io (api)
key_dependencies:
  - name: "@tanstack/react-query"
    purpose: Server state and caching
  - name: zod
    purpose: Schema validation
  - name: recharts
    purpose: Charts
  - name: prisma
    purpose: Database ORM
build:
  package_manager: pnpm
  test: Vitest + Playwright
  ci: GitHub Actions
  node_required: ">=20"
generated:
  date: 2026-07-21
  generator: appfacts-cli v0.1.0 (claude-sonnet-4-6)
  inputs_fingerprint: "0123456789abcdef"
credits:
  generated_with: https://appfacts.dev
  built_by: "Catalyst Forge — https://www.catalystforge.com/"
---

# App Facts — Acme Dashboard

| | |
|---|---|
| **Type** | web app (SPA) |
| **Status** | active |
| **License** | MIT |

## Stack

| Layer | Choice |
|---|---|
| Language | TypeScript |
| Runtime | Node 20 |
| Framework | React 18 + Vite |
| Styling | Tailwind CSS |
| State | Zustand |
| Backend | Fastify |
| Database | PostgreSQL 16 |
| Hosting | Vercel (web) · Fly.io (api) |

## Key Dependencies

| Package | Purpose |
|---|---|
| `@tanstack/react-query` | Server state and caching |
| `zod` | Schema validation |
| `recharts` | Charts |
| `prisma` | Database ORM |

## Build & Test

| | |
|---|---|
| Package manager | pnpm |
| Test | Vitest + Playwright |
| CI | GitHub Actions |
| Node required | >=20 |

---
*Generated with [AppFacts](https://appfacts.dev) · Built by [Catalyst Forge](https://www.catalystforge.com/)*