# Board — Nalu Paluka

Kanban for the **nalu-paluka** monorepo. Single source of truth for task tracking.

**Columns**: `# | Task | Branch | Status | PR`

**Statuses**: 📋 Backlog → 🔜 Ready → 🔄 In Progress → 🔍 In Review → ✅ Done (or ⏸️ Blocked)

---

## Sprint 15 — Bug fixes y mejoras UX

| # | Task | Branch | Status | PR |
|---|---|---|---|---|
| 1 | Restaurar atomicidad de ventas/compras (Drizzle transactions) | `feat/sprint-15-issues` | ✅ Done | [#4](https://github.com/carlosrenatohr/nalu-app/pull/4) |
| 2 | Ciclo de vida sabores/proveedores (activo/inactivo) | `feat/sprint-15-issues` | ✅ Done | #4 |
| 3 | EmojiPicker expandido + formularios se limpian al editar | `feat/sprint-15-issues` | ✅ Done | #4 |
| 4 | Ubicación "Otro" + crear sabor rápido desde venta | `feat/sprint-15-issues` | ✅ Done | #4 |
| 5 | Crear proveedor rápido + layout responsive | `feat/sprint-15-issues` | ✅ Done | #4 |
| 6 | Validación de precio personalizado | `feat/sprint-15-issues` | ✅ Done | #4 |
| 7 | Conectividad real con sonda HEAD | `feat/sprint-15-issues` | ✅ Done | #4 |
| 8 | Filtros de fecha expandidos en ventas | `feat/sprint-15-issues` | ✅ Done | #4 |
| 9 | Exportación de imagen mejorada | `feat/sprint-15-issues` | ✅ Done | #4 |
| 10 | Dashboard cards enlazan a ventas con filtro | `feat/sprint-15-issues` | ✅ Done | #4 |
| 11 | Conventional Commits en AGENTS.md + CONTRIBUTING.md | `feat/sprint-15-issues` | ✅ Done | #4 |

## Seguridad (pendiente — fase separada)

| # | Task | Branch | Status | PR |
|---|---|---|---|---|
| S1 | Rate limiting en endpoints de auth | — | 📋 Backlog | — |
| S2 | Proteger change-pin (requiere auth) | — | 📋 Backlog | — |
| S3 | Audit token Cloudflare en .env | — | 📋 Backlog | — |
| S4 | Default PIN 1234 en seed → solo dev | — | 📋 Backlog | — |

## Releases

| Version | Date | PR |
|---|---|---|
| **v1.1.0** | 2026-09-02 | [#4](https://github.com/carlosrenatohr/nalu-app/pull/4) |
