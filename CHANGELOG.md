# Changelog

Todos los cambios notables de Nalu.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).

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
