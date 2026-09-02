# Board — Nalu Paluka

Kanban for the **nalu-paluka** monorepo. This is the **single source of truth** for task tracking, planning, and business rules.

## How to add a new task

Add a row to the appropriate project section:

```markdown
| ## | Title | Spec | — | 📋 Backlog | — |
```

**Columns**: `# | Task | Spec | Branch | Status | PR`

**Statuses**: 📋 Backlog → 🔜 Ready → 🔄 In Progress → 🔍 In Review → ✅ Done (or ⏸️ Blocked)

**Projects**: `frontend`, `backend`, `docs`

---

## frontend

| # | Task | Spec | Branch | Status | PR |
|---|---|---|---|---|---|
|  01  |  Offline-first storage with Dexie + outbox  |  `.specs/offline-storage.md`  |  —  |  📋 Backlog  |  —  |
| 02 | API client typed with Zod schemas | `.specs/api-schemas.md` | — | 📋 Backlog | — |
| 03 | PWA manifest y service worker configuration | `.specs/pwa-config.md` | — | 📋 Backlog | — |
| 04 | Spanish UI localization — mobile-first | `.specs/ui-localization.md` | — | 📋 Backlog | — |
| 05 | Tailwind v4 theme tokens — Nalu color palette | `.specs/design-tokens.md` | — | 📋 Backlog | — |

## backend

| # | Task | Spec | Branch | Status | PR |
|---|---|---|---|---|---|
| 10 | D1 migrations + seed scripts | `.specs/d1-migrations.md` | — | 📋 Backlog | — |
| 11 | Zod validation for sale/commerce entities | `.specs/zod-validation.md` | — | 📋 Backlog | — |
| 12 | Atomic sale transaction — entity + items + movements | `.specs/atomic-transaction.md` | — | 📋 Backlog | — |
| 13 | Inventory model — signed movements (no counters) | `.specs/inventory-model.md` | — | 📋 Backlog | — |
| 14 | Historical cost snapshot — freeze at sale time | `.specs/cost-freeze.md` | — | 📋 Backlog | — |

## docs

| # | Task | Spec | Branch | Status | PR |
|---|---|---|---|---|---|
| 20 | Spanish documentation — business rules | `.specs/business-rules.md` | — | 📋 Backlog | — |
| 21 | Deployment guide — Cloudflare Workers + D1 | `.specs/deployment.md` | — | 📋 Backlog | — |
| 22 | Codebase Memory verification protocol | `AGENTS.md` (CM) | — | 📋 Backlog | — |

## Workflow & Standards

| # | Task | Spec | Branch | Status | PR |
|---|---|---|---|---|---|
| W1 | Codebase Memory up-to-date verification | `AGENTS.md` (line 13) | — | 📋 Backlog | — |
| W2 | Gate verification per sub-proyecto | `AGENTS.md` (gate) | — | 📋 Backlog | — |
| W3 | Lint + typecheck gate | `pnpm lint / pnpm typecheck` | — | 📋 Backlog | — |

## Quality & Infra

| # | Task | Spec | Branch | Status | PR |
|---|---|---|---|---|---|
| Q1 | Codebase Memory schema_version check | `.codebase-memory/graph.db.zst` | — | 📋 Backlog | — |
| Q2 | CI workflow per package | — | — | ✅ Done | — |
| Q3 | Upgrade Wrangler + dependencies | — | — | 📋 Backlog | — |

## Releases

| Version | Date | Repos |
|---|---|---|
| **v1.0.0** | — | First release |

## Post-incidente

| # | Tarea | Status | PR |
|---|---|---|---|
