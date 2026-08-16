# Arquitectura

## Visión general

```
React + Vite (PWA offline-first)
        │  cliente API tipado (services/api)
        ▼
REST HTTP API (/api/*)
        │
Express 5 (Node.js / Cloudflare Workers)
        │
Controladores (HTTP puro)
        │
Servicios (reglas de negocio)
        │
Repositorios (SQL, proyección a camelCase)
        │
Cloudflare D1 (producción) / node:sqlite (local y tests)
```

**Reglas de capas:**

- El frontend **nunca** accede a D1 directamente: solo habla con la API.
- Los controladores **no** contienen SQL ni lógica de negocio: delegan en servicios.
- Los servicios **no** contienen SQL: delegan en repositorios.
- Los repositorios **no** contienen reglas de negocio: ejecutan SQL con parámetros preparados.
- Los cálculos de negocio (ganancia, inventario, margen) viven en **funciones puras** en `domain/calculations/`, testeadas de forma independiente.

## Repositorio (monorepo con pnpm workspaces)

```
package.json          # workspaces: frontend + backend, scripts raíz
frontend/             # React + Vite + Tailwind + PWA
backend/              # Express + TypeScript + D1
docs/                 # documentación (español)
.github/workflows/    # CI (PR) y CD (main)
```

## Backend

### Flujo por petición

`app.ts` crea la app Express con: helmet (seguridad), CORS (solo desarrollo), `express.json`, logger, router `/api` y manejo centralizado de errores y 404.

`routes/index.ts` conecta cada ruta con su controlador y aplica la validación Zod (`validate()` y `validateQuery()`).

### Inyección de dependencias

Los servicios reciben `{ db, getBusinessId }`:

- `db` es la interfaz `Db` común (`all`, `first`, `run`, `batch`).
- `getBusinessId` resuelve el id del negocio **de forma perezosa**: en Cloudflare Workers no se permite I/O asíncrono (como consultas a D1) en el scope global del módulo, así que la primera consulta ocurre dentro de un request y se cachea.

### Dos entradas, misma app

| Archivo | Entorno | Base de datos |
|---|---|---|
| `src/server.ts` | Node local (`pnpm dev`) | `node:sqlite` (archivo `data/nalu.db`) |
| `src/worker.ts` | Cloudflare Workers (`wrangler dev`/`deploy`) | D1 (binding `DB`) |

Ambos usan `createApp({ db, getBusinessId })`: la lógica es idéntica; solo cambia el adaptador de base de datos.

### Adaptadores de base de datos

`src/db/` define una interfaz mínima y común:

```ts
interface Db {
  all<T>(sql, params?): Promise<T[]>;
  first<T>(sql, params?): Promise<T | null>;
  run(sql, params?): Promise<{ changes, lastRowId }>;
  batch(statements): Promise<void>;   // transacción atómica (todo o nada)
}
```

- `D1DbAdapter` envuelve el binding D1 (asíncrono nativo).
- `SqliteDbAdapter` envuelve `node:sqlite` (SQLite nativo de Node 24, sin dependencias nativas).

`batch()` es clave para la **atomicidad**: una venta se crea en un solo lote con sus ítems y movimientos de inventario.

### Transacciones atómicas

Gracias a los **IDs UUID generados por la aplicación**, una operación multi-tabla se construye con todos sus `INSERT` y se ejecuta en un único `batch`:

- Venta → `sales` + `sale_items` + `inventory_movements` (SALE, negativos).
- Compra → `purchases` + `purchase_items` + `inventory_movements` (PURCHASE, positivos).

Si algo falla, el lote se revierte por completo (no quedan transacciones parciales).

## Frontend

### Organización por features

```
src/features/
  dashboard/    # resumen del día y acciones rápidas
  sales/        # lista + venta rápida (una pantalla)
  purchases/    # lista + formulario de compra
  inventory/    # tarjetas visuales + detalle + salidas
  suppliers/    # gestión de proveedores
  reports/      # análisis + export PDF/imagen
  settings/     # negocio, precios, colores, ubicaciones, sabores
  more/         # hub secundario (compras, proveedores, ajustes)
```

### Estado

- Estado local con `useState`/`useMemo`.
- `useAsync` para carga de datos (loading/error/reload).
- Context solo donde hay estado genuinamente compartido: `BusinessProvider` (ajustes del negocio) y `ToastProvider` (notificaciones).
- Sin Redux, sin TanStack Query: la capa de datos (services/api) cubre la necesidad actual y documenta el camino para migrar si hiciera falta.

### Cliente API tipado

`services/api/` expone APIs por recurso (`salesApi.list()`, `inventoryApi.create()`, …). Los componentes **nunca** hardcodean URLs ni llaman a `fetch` directamente.

Cada método aplica el patrón offline: intenta el servidor; si no hay red, cae al caché de IndexedDB (lecturas) o crea la entidad local + outbox (escrituras).

### Code splitting

Cada feature se carga con `React.lazy`; los reportes (jsPDF + html-to-image) quedan fuera del bundle inicial.

## Decisiones de arquitectura (resumen)

| Decisión | Motivo |
|---|---|
| IDs UUID (TEXT) en lugar de INTEGER | Lotes atómicos multi-tabla en D1 y deduplicación de sincronización por clave primaria |
| Interfaz `Db` con dos adaptadores | Un solo código de repositorios para D1 (prod) y node:sqlite (dev/tests) |
| `getBusinessId` perezoso | El runtime de Workers prohíbe I/O asíncrono en el scope global |
| `batch()` como transacción | Nunca dejar ventas/compras a medias |
| Cálculos puros en `domain/` | Testeables sin base de datos ni HTTP |
| Un solo Worker con `assets` | API + frontend + PWA en un solo despliegue, sin CORS en producción |
| Sin librerías de charts | Barras CSS simples cubren la necesidad sin dependencias |
