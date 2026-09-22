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
|  01  |  Offline-first storage with Dexie + outbox  |  `.specs/offline-storage.md`  |  —  |  ✅ Done  |  —  |
| 02 | API client typed with Zod schemas | `.specs/api-schemas.md` | — | 📋 Backlog | — |
> **02 (deuda real):** el cliente ya está tipado por TS (`frontend/src/services/api/`), pero la validación **Zod vive solo en backend** (`backend/src/schemas/`). Falta compartir esquemas Zod al frontend (`frontend/src/lib/validation/` reservado).
| 03 | PWA manifest y service worker configuration | `.specs/pwa-config.md` | — | ✅ Done | — |
| 04 | Spanish UI localization — mobile-first | `.specs/ui-localization.md` | — | ✅ Done | — |
| 05 | Tailwind v4 theme tokens — Nalu color palette | `.specs/design-tokens.md` | — | ✅ Done | — |

## backend

| # | Task | Spec | Branch | Status | PR |
|---|---|---|---|---|---|
| 10 | D1 migrations + seed scripts | `.specs/d1-migrations.md` | — | ✅ Done | — |
| 11 | Zod validation for sale/commerce entities | `.specs/zod-validation.md` | — | ✅ Done | — |
| 12 | Atomic sale transaction — entity + items + movements | `.specs/atomic-transaction.md` | — | ✅ Done | — |
| 13 | Inventory model — signed movements (no counters) | `.specs/inventory-model.md` | — | ✅ Done | — |
| 14 | Historical cost snapshot — freeze at sale time | `.specs/cost-freeze.md` | — | ✅ Done | — |

## docs

| # | Task | Spec | Branch | Status | PR |
|---|---|---|---|---|---|
| 20 | Spanish documentation — business rules | `.specs/business-rules.md` | — | ✅ Done | — |
| 21 | Deployment guide — Cloudflare Workers + D1 | `.specs/deployment.md` | — | ✅ Done | — |
| 22 | Codebase Memory verification protocol | `AGENTS.md` (CM) | — | ✅ Done | — |

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

## Improvement plan — búsqueda/stock/offline UX (post v1.3.0)

| # | Fase | Status | PR |
|---|---|---|---|
| F1 | Búsqueda de sabores compartida: acentos + mayúsculas (`SearchInput`, `matchesSearch`) | ✅ Done | #22 |
| F2 | Fila compacta compartida + filtro de inactivos (venta/compra/edición/salida/offline) | ✅ Done | #23 |
| F3 | Orden/filtro por stock + catálogo compacto en Inicio + quick-add compra en header | 🔄 In Progress | — |
| F4 | Paginación de ventas (page/limit + "Cargar más") | 📋 Backlog | — |
| F5 | Detalle de compra + swipe actions + sabor rápido reutilizando `FlavorModal` | 📋 Backlog | — |
| F6 | Offline: cola de edición de compras/proveedores + fix recursión + `lastError` visible | 📋 Backlog | — |
| F7 | Integridad SQLite: `db:integrity` + `db:backup:local` + docs | 📋 Backlog | — |
| F8 | "Ajustar stock" desde Sabores vía `ExitModal` (motivo obligatorio) + emoji solo en modal | 📋 Backlog | — |
| F9 | Sweep final: gate completo, regresión de reglas críticas, board/docs/memory al día | 📋 Backlog | — |

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
| CI-1 | **Hang del job E2E en CI.** El paso "Tests e2e" queda `in_progress` 20+ min aunque el suite pasa local (~34s). Causa: el `webServer` del backend usa `tsx src/server.ts` (pnpm→tsx→node) y el hijo que abre :3002 queda huérfano en el teardown → Playwright espera para siempre. Red de seguridad ya aplicada: `globalTimeout: 300_000` (#14). **Mitigación aplicada:** job e2e pausado en CI (`7c94dfa`); los e2e corren manualmente (`docs/TESTING.md`). Fix de raíz sigue pendiente. | 🔜 Ready | — |
| CI-2 | **Fix de raíz del hang (opción 2).** Cambiar el `webServer` del backend a correr el build compilado: `rm -f data/e2e.db* && pnpm exec tsc -p tsconfig.build.json && node dist/server.js` (proceso único que Playwright cierra limpio). Validar `pnpm test:e2e` local y en CI. | 📋 Backlog | — |
| CI-3 | **Logs/diagnóstico CI.** El run colgado se inspecciona con `gh run view <id> --log` y `wrangler tail nalu-api` (los errores de negocio salen por `console.error` en `error-handler.ts`). | 📋 Backlog | — |
