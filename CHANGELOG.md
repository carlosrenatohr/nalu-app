# Changelog

Todos los cambios notables de Nalu.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).

## [1.3.0] - 2026-09-20

### Added
- Compras: edición y eliminación con integridad de inventario (bloqueo 409 si el stock quedaría negativo) y menú de acciones (Editar / Eliminar).
- Borradores (drafts) de ventas y compras con recuperación (`Continuar` / `Descartar`).
- Sabores: grilla compacta, selector de emoji en modal (default 🍧), campo `minStock` editable, y eliminación/archivado según referencias históricas.
- Ajuste de stock bidireccional (±) con motivo obligatorio (movimiento firmado).
- Contadores con cantidad manual (Stepper editable) y aviso visual al registrar ventas de más de una unidad.
- Detalle de cambios pendientes de sincronización con descarte (revert) seguro.
- Sincronización offline de edición/eliminación de ventas y sabores (verbos `update`/`delete` en el outbox).

### Fixed
- Costo histórico: al editar una venta, las líneas sin cambio de cantidad conservan su `unit_cost_snapshot` original.
- Robustez de sincronización: reintentos con backoff exponencial y reintento automático al volver online.
- Consistencia de salida/devolución en el registro de movimientos; Totales de inventario muestran ajustadas y devueltas.
- Sabores inactivos bloqueados en nuevas ventas/compras (`FLAVOR_INACTIVE`) sin romper el historial.
- Touch targets ≥ 44px (menú de acciones de ventas); typo en el modal de confirmación.

### Changed
- Sync ahora soporta `verb: create|update|delete` con `opId` propio para update/delete (deduplicación segura).
- `e2e/playwright.config.ts`: `globalTimeout` para evitar colgarse en CI.

## [1.1.0] - 2026-08-17

### Added
- CRUD completo de sabores con `costPrice`, `salePrice` y emoji picker por categorías (Frutas, Chocolate, Dulces)
- Edición y eliminación de ventas con `EditSaleModal` y `ConfirmDeleteModal` (advertencia visual)
- CRUD de proveedores: crear, editar, activar/desactivar
- Logo de Nativerse en el footer de MorePage ("Powered by Nativerse")
- Navegación: sección "Sabores 🍧" en el sidebar
- Ruta `/flavors` con lazy loading
- Migración `0004_flavor_prices.sql`: columnas `cost_price` y `sale_price` en `flavors`
- Seed data con precios de costo y venta

### Fixed
- Modal `panelRef.focus()` steals focus from inputs on every re-render (now only on initial open)
- Lint errors: unused imports `inArray`, `CardHeader`, `IconStore`; missing `formatMoney` import
- Type errors: missing `costPrice`/`salePrice` in test Flavor objects

### Changed
- Flavor management moved from SettingsPage to dedicated FlavorsPage
- `SuppliersPage` now supports full CRUD (previously only create + toggle active)

## [1.0.0] - 2026-08-16

### Added
- Initial release: Express API + React PWA offline-first
- Drizzle ORM migration (10 repositories, schema types, dual-driver adapters)
- Sales, purchases, inventory, suppliers, reports
- PIN authentication with 90-day sessions
- Email alerts (stock low + daily summary)
- PWA installable with offline support
- PDF and image export for reports
- CI/CD with GitHub Actions (ci.yml + deploy.yml)
- Deployed to Cloudflare Workers + D1
