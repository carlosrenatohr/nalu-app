# AGENTS.md — Tests e2e 🧪

Guía para los tests end-to-end de Nalu (Playwright).

## ¿Qué se prueba aquí?

Flujos críticos del negocio de punta a punta (navegador real → UI React → API Express → SQLite):
- `smoke.spec.ts`: health de la API, dashboard, **venta rápida completa** e inventario.

## Cómo correrlos

```bash
pnpm test:e2e
```

Playwright **arranca solo** ambos servidores (config en `playwright.config.ts`):
1. API local en `:3002` con base limpia `backend/data/e2e.db` (el propio comando del webServer borra la BD antes de abrirla → siempre datos semilla).
2. Frontend Vite en `:5173` con proxy `/api` → `:3002`.

> ⚠️ **Importante**: NO limpiar la BD desde `globalSetup` — Playwright arranca los webServers **antes** de `globalSetup`, así que borrar el archivo con el servidor abierto deja la conexión en un inode desvinculado donde las escrituras fallan con `SQLITE_READONLY`.
> ⚠️ No tener `pnpm dev` corriendo: los puertos son estrictos (`--strictPort`) y `reuseExistingServer: false`.

## Convenciones

- **Selectores**: priorizar roles accesibles (`getByRole("button", { name: "..." })`, `getByText`, `getByLabel`). Evitar selectores CSS frágiles.
- **Idioma**: los textos de la UI están en español — los selectores usan el texto visible en español.
- **Determinismo**: nunca depender del estado acumulado de la BD; `global-setup.ts` la limpia.
- **Sequencial**: `workers: 1` porque los flujos escriben en la misma BD.
- Instalar el navegador una sola vez: `pnpm exec playwright install chromium`.

## Estructura

```
e2e/
├── playwright.config.ts  # servidores, workers, proyectos, reporter
└── tests/                # specs (smoke.spec.ts, …)
```
