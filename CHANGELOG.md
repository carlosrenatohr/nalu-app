# Changelog

Todos los cambios notables de Nalu.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).

## [Unreleased]

### Added
- **Toggle ocultar/mostrar la tarjeta de IA** en Inventario (👁️/🙈): el cuerpo colapsa con transición suave (respeta `prefers-reduced-motion`), el contenido oculto queda `inert` y la preferencia persiste en `localStorage`; la app queda 100% operable si el proveedor de IA falla.
- Mensajes de IA **por código** en la tarjeta (429 «Jev está saturado 💤», timeout, no configurado…): título + pista + detalle del servidor, nunca un estado vacío.
- Proveedor **Vercel AI Gateway** para Jev (`AI_GATEWAY_API_KEY`, alias `typesafe-ai/jev`) con precedencia sobre OpenCode Zen y contrato de errores compartido (`services/ai/errors.ts`); tests nuevos de gateway y de selección de proveedor.

### Fixed
- **`429 AI_RATE_LIMIT` en producción**: OpenCode Zen limita por origen las IPs salientes de Cloudflare Workers; el backend llama a Jev vía Vercel AI Gateway (Zen queda como respaldo local). Diagnóstico en `docs/JEV.md` §12.

## [1.5.0] - 2026-09-22

### Added
- **Recomendación IA de inventario con Jev** (System One vía OpenCode Zen): nuevo endpoint `POST /api/ai/inventory-recommendation?days=1–365` bajo autenticación, que combina inventario + ventas reales de la ventana y devuelve sabor a priorizar, prioridad, razón compuesta en el servidor, confianza y distribución completa de probabilidades.
- Tarjeta jugable ✨ en la pantalla de Inventario: selector de ventana 7/30/90 días (re-analiza al instante), barra de confianza, barras de probabilidad por sabor y estados idle/carga/éxito/error/datos insuficientes.
- Validación en dos capas (Zod + semántica: opción ∈ lista enviada y confianza ≥ 0.3) y errores controlados `AI_NOT_CONFIGURED` (503), `AI_UNAVAILABLE` (502), `AI_TIMEOUT` (504), `AI_RATE_LIMIT` (429) e `AI_INVALID_RESPONSE` (502), todos en español y sin stack traces.
- API key exclusiva server-side (`OPENCODE_ZEN_API_KEY` como secreto de Workers / `backend/.env` local); logs de etapa sin credenciales.
- Tests: dominio, cliente Zen, API, componente y e2e (2 suites nuevas en Playwright) — sin llamadas reales al modelo.
- Documentación: guía de aprendizaje `docs/JEV.md` con diagramas y capturas, más referencia del endpoint en `docs/API-REFERENCE.md` y secretos en `docs/DEPLOYMENT.md`.

### Fixed
- e2e de venta rápida: elegir un sabor con stock ante el orden por stock ascendente (regresión preexistente de `f77e0b1`).

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
