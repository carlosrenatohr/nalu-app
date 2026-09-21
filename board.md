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

## QA Feedback — funcional y UX (release v1.3.0)

| # | Tarea | Status | PR |
|---|---|---|---|
| 01 | Compras: edición y eliminación con integridad de inventario (bloqueo 409 si stock negativo) | ✅ Done | #5 |
| 02 | Compras: menú de acciones (Editar / Eliminar) | ✅ Done | #7 |
| 03 | Drafts de compras y ventas (recuperar/descartar) | ✅ Done | #10 |
| 04 | Sabores: eliminar (borrar si sin referencias / archivar si referenciado) | ✅ Done | #2, #4 |
| 05 | Sabores: activo/inactivo, bloqueo en ventas/compras nuevas | ✅ Done | #2, #4 |
| 06 | Contadores con cantidad manual (Stepper editable) | ✅ Done | #9 |
| 07 | Feedback visual al registrar venta >1 unidad | ✅ Done | #9 |
| 08 | Ajuste de stock bidireccional ± con motivo (movimiento firmado) | ✅ Done | #6 |
| 09 | Consistencia salida/devolución (ExitModal + Totales ajustadas/devueltas) | ✅ Done | #9 |
| 10 | UI de sabores en grilla compacta (más info sin scroll) | ✅ Done | #4 |
| 11 | Selector de emoji en modal con default 🍧 | ✅ Done | #4 |
| 12 | Personalización de icono: no existe en el código → N/A | ✅ Done | #4 |
| 13 | Offline extendido a ventas y sabores (edit/delete vía outbox+sync) | ✅ Done | #13 |
| 14 | Detalle de cambios pendientes + descarte (revert) seguro | ✅ Done | #12 |
| 15 | Sync robusta: backoff + reintento automático (causa raíz item 15) | ✅ Done | #11 |
| 16 | Reutilización de componentes (ActionMenu, DraftBanner, Modal, Stepper) + touch targets ≥44px | ✅ Done | #7, #10, #14 |

## Releases

| Version | Date | Repos |
|---|---|---|
| **v1.0.0** | — | First release |
| **v1.1.0** | 2026-08-17 | CRUD sabores/ventas/proveedores |
| **v1.2.0** | 2026-09-02 | Sprint 15 |
| **v1.3.0** | 2026-09-20 | QA Feedback funcional y UX |

## Post-incidente

| # | Tarea | Status | PR |
|---|---|---|---|
| 01 | **BUG crítico (v1.3.0):** crear/editar ventas y compras daba 500 en producción. Causa: `db.transaction` usa `BEGIN`, que D1 no soporta. Fix: `runAtomic` con `db.batch` (D1) / `db.transaction` (SQLite). | ✅ Done | #16 |

## Backlog — CI / e2e (diferido)

> Detener el trabajo de CI y manejarlo aquí. No bloquea deploys (main sin protección; `deploy.yml` no corre e2e).

| # | Tarea | Status | PR |
|---|---|---|---|
| CI-1 | **Hang del job E2E en CI.** El paso "Tests e2e" queda `in_progress` 20+ min aunque el suite pasa local (~34s). Causa: el `webServer` del backend usa `tsx src/server.ts` (pnpm→tsx→node) y el hijo que abre :3002 queda huérfano en el teardown → Playwright espera para siempre. Red de seguridad ya aplicada: `globalTimeout: 300_000` (#14). | 🔜 Ready | — |
| CI-2 | **Fix de raíz del hang (opción 2).** Cambiar el `webServer` del backend a correr el build compilado: `rm -f data/e2e.db* && pnpm exec tsc -p tsconfig.build.json && node dist/server.js` (proceso único que Playwright cierra limpio). Validar `pnpm test:e2e` local y en CI. | 📋 Backlog | — |
| CI-3 | **Logs/diagnóstico CI.** El run colgado se inspecciona con `gh run view <id> --log` y `wrangler tail nalu-api` (los errores de negocio salen por `console.error` en `error-handler.ts`). | 📋 Backlog | — |
