# Desarrollo local

## Requisitos

- Node.js ≥ 24 (usa `node:sqlite`, SQLite nativo — sin dependencias nativas).
- pnpm ≥ 10 (se usa pnpm como gestor de paquetes; el repo usa workspaces).

## Instalación

```bash
pnpm install
```

pnpm workspaces instala `frontend/` y `backend/` juntos. Los scripts de build de dependencias (`esbuild`, `workerd`, `sharp`, `core-js`) están permitidos en `pnpm-workspace.yaml` (`allowBuilds`); si cambias de máquina y pnpm los bloquea, confirma con:

```bash
pnpm approve-builds
```

## Comandos

| Comando (raíz) | Descripción |
|---|---|
| `pnpm dev` | API en `http://localhost:3002` + web en `http://localhost:5173` (Vite con proxy `/api` → 3002) |
| `pnpm dev:worker` | Ejecuta la API en el runtime de Workers (`wrangler dev`, puerto 8787) con D1 local |
| `pnpm build` | Compila backend (`tsc`) y frontend (`vite build`) |
| `pnpm test` | Vitest: tests de dominio + API (backend) y componentes (frontend) |
| `pnpm lint` | ESLint (backend y frontend) |
| `pnpm typecheck` | `tsc --noEmit` en ambos paquetes |
| `pnpm db:migrate` | Aplica migraciones a la base local `backend/data/nalu.db` |
| `pnpm db:seed` | Carga los datos semilla (demo) |
| `pnpm preview` | Sirve el frontend construido (`vite preview`) |

## Puertos

- Frontend (Vite): **5173**
- API local (Node/Express): **3002**
- API en runtime Workers (`wrangler dev`): **8787**

> El puerto 3002 se eligió para no chocar con otras apps locales (3001 es común).

## Base de datos local

- Archivo: `backend/data/nalu.db` (SQLite con WAL).
- Se crea sola con las migraciones; si está vacía, se siembra automáticamente al arrancar.
- Para borrarla: `pnpm --filter @nalu/backend db:reset` (o borra `backend/data/`).

## Probar la API directamente

```bash
curl http://localhost:3002/api/health
curl http://localhost:3002/api/inventory
curl -X POST http://localhost:3002/api/sales \
  -H "Content-Type: application/json" \
  -d '{"location":"Casa","items":[{"flavorId":"20000000-0000-4000-8000-000000000001","quantity":2,"unitPrice":60}]}'
```

## Probar el runtime de Workers localmente

```bash
cd backend
pnpm exec wrangler d1 migrations apply nalu-db --local   # crea la D1 local
pnpm dev:worker                                          # Express dentro de workerd en :8787
```

El worker sirve también el frontend construido (assets): ejecuta antes `pnpm --filter @nalu/frontend build`.

## Notas por paquete

### Backend

- Scripts propios: `pnpm --filter @nalu/backend dev`, `pnpm --filter @nalu/backend test`, etc.
- `pnpm --filter @nalu/backend cf-typegen` regenera `worker-configuration.d.ts` (tipos de bindings).

### Frontend

- `pnpm --filter @nalu/frontend icons` regenera los iconos PWA desde `public/icon.svg`.
- El service worker se genera en build (`dist/sw.js`); en desarrollo está desactivado (`devOptions.enabled: false`).
