# AGENTS.md — Backend 🍧

Guía para trabajar en `backend/` (Express 5 + TypeScript + Cloudflare D1).

---

## 📁 Estructura

```
src/
├── app.ts            # fábrica de la app Express (middleware + rutas) — recibe servicios inyectados
├── server.ts         # entrada LOCAL (Node ≥ 24): node:sqlite + listen :3002
├── worker.ts         # entrada Cloudflare Workers: binding D1 + fetch handler
├── config/           # bootstrap: creación de servicios según entorno
├── routes/           # definición de rutas REST → controllers
├── controllers/      # capa HTTP fina: leer req, validar params, delegar, responder
├── services/         # lógica de negocio (orquestación, reglas, transacciones)
├── repositories/     # SQL puro → filas tipadas (alias a camelCase)
├── schemas/          # esquemas Zod (validación de entrada)
├── middleware/       # validate, error-handler, logger, not-found
├── domain/
│   ├── calculations/ # ⚠️ funciones PURAS de negocio (money, sales, inventory) — sin I/O
│   └── types.ts      # tipos del dominio
├── db/
│   ├── types.ts      # interfaz Db (única abstracción de BD)
│   ├── d1-adapter.ts # adaptador D1 (producción / wrangler dev)
│   ├── sqlite-adapter.ts # adaptador node:sqlite (local / tests)
│   ├── migrate.ts / seed.ts / reset.ts / index.ts / paths.ts
├── utils/            # ids, dates, http-error, response, zod (traducción de errores), request, slugify
└── migrations/       # SQL: 0001_init.sql, 0002_indexes.sql, seed.sql
```

## 🏛️ Arquitectura de capas (obligatoria)

```
Route → Controller → Service → Repository → Db (D1 | node:sqlite)
```

- **Controller**: solo HTTP (status codes, `req`/`res`, delegación). Sin SQL, sin reglas de negocio.
- **Service**: orquesta repositorios, aplica reglas de negocio, ejecuta transacciones atómicas. Sin HTTP.
- **Repository**: SQL parametrizado, devuelve tipos explícitos con alias `AS camelCase`.
- **Domain/calculations**: funciones puras (totales, ganancia, margen, inventario) — se testean de forma aislada.
- **Db**: interfaz común; en D1 las transacciones usan `batch`, en SQLite `BEGIN/COMMIT`.

## 🧠 Reglas de negocio críticas

1. `PURCHASE` → inventario `+`; `SALE | GIFT | PERSONAL_USE | LOSS | ADJUSTMENT | RETURN` según corresponda. Solo `SALE` genera ingresos.
2. **Costo histórico**: `sale_items.unit_cost_snapshot` se congela al vender (nunca recalcular con costo actual).
3. **Inventario insuficiente** → `HttpError` 409 `INSUFFICIENT_INVENTORY`, sin mutar stock.
4. **Transacciones atómicas**: venta = `sales` + `sale_items` + movimientos en un solo `batch`/`BEGIN`.
5. **Sync idempotente**: la API acepta `opId` (UUID) y deduplica contra `sync_operations` + PK — reintentos seguros.
6. Ventas desnormalizan el **nombre de ubicación** a propósito (soporta edición futura de ubicaciones).

## 📡 Contrato de API

- Respuestas: `{ success: true, data }` o `{ success: false, error: { code, message } }` — mensajes en español.
- Errores centralizados en `middleware/error-handler.ts` (nunca repetir try/catch en cada controller).
- Validación Zod en `middleware/validate.ts` (`validateBody`/`validateQuery`/`validateParams`).
- Endpoints principales: `/api/health`, `/api/flavors`, `/api/sales`, `/api/purchases`, `/api/inventory`, `/api/inventory/movements`, `/api/suppliers`, `/api/reports/*`, `/api/business`, `/api/locations`, `/api/sync/*`.

## 🗄️ Base de datos

- Migraciones SQL compartidas (`migrations/`) aplicables a D1 (`wrangler d1 migrations apply`) y local (`pnpm db:migrate`).
- `seed.sql` es **idempotente** (`INSERT OR IGNORE` con UUIDs fijos) — Wrangler lo aplica como migración; local se aplica aparte.
- IDs: UUID v4. Cantidades firmadas: `+` entrada, `−` salida (documentado en `docs/DATABASE.md`).
- **Nunca** alterar el esquema de producción a mano: siempre nueva migración.

## ⚙️ Compatibilidad con Workers

- El código debe correr en el runtime de Workers (`nodejs_compat`). **Prohibido**: filesystem, child_process, estado persistente local en módulo, I/O asíncrono en scope global de módulo.
- Los servicios resuelven el `businessId` de forma perezosa por request (evita I/O en el scope global — error D1).
- Bindings tipados vía `wrangler types` → `worker-configuration.d.ts`.

## 🧪 Tests

- Unit (dominio): `tests/domain/calculations.test.ts` — funciones puras con los ejemplos del negocio.
- API: `tests/api/api.test.ts` — Supertest contra la app Express real con BD SQLite fresca por caso.
- Correr: `pnpm --filter @nalu/backend test`, watch: `pnpm --filter @nalu/backend test:watch`.

## 📝 Commits

Usar [Conventional Commits](https://www.conventionalcommits.org/): `<type>(<scope>): <asunto en inglés>`. Tipos: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`. Asunto ≤ 70 chars, en inglés. Sin `Co-Authored-By` ni firmas.

## ✅ Checklist antes de terminar

1. `pnpm --filter @nalu/backend typecheck` y `pnpm --filter @nalu/backend lint` en cero.
2. `pnpm --filter @nalu/backend test` en verde (dominio + API).
3. Reglas de negocio críticas intactas (costo histórico, solo SALE genera ingresos, transacciones atómicas).
4. Compatible con Workers (sin I/O en scope global, sin filesystem).
