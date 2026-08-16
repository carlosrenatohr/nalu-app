# Testing

Nalu se prueba en tres niveles. El objetivo: **no declarar completa una lógica de negocio crítica sin tests**.

## Niveles

### 1. Lógica de negocio (funciones puras) — backend

`backend/tests/domain/calculations.test.ts`

Cubre con ejemplos del negocio real:

- Total de venta (C$60 × 13 = C$780).
- Costo histórico (C$28 × 13 = C$364).
- Ganancia (C$780 − C$364 = C$416).
- Subtotal y ganancia a otros precios (C$40, C$50).
- Margen.
- Inventario por movimientos (`+30 −10 −2 −1 = 17`).
- Entradas vs. salidas (GIFT/PERSONAL_USE/LOSS no son entradas).
- Costo promedio ponderado.
- Valor del inventario y stock bajo.

### 2. API (integración) — backend

`backend/tests/api/api.test.ts` con **Supertest** contra una base SQLite en memoria (mismas migraciones que D1).

Cubre:

- Salud y contrato de errores en español (`{ success:false, error:{ code, message } }`).
- Sabores: listar, crear (slug), validación.
- Inventario: disponible calculado desde movimientos, detalle con historial.
- **Ventas:** crear (descuenta inventario, ganancia correcta), rechazar cantidades inválidas, rechazar **inventario insuficiente** (409 sin alterar stock), consultar por id.
- **Compras:** crear (aumenta inventario, último costo), proveedor inexistente (404).
- **Salidas sin venta:** un regalo reduce inventario pero **no** cambia las ventas del día.
- **Reportes:** totales por rango, sabores, ubicaciones, precios; compras por proveedor; inventario.
- **Sincronización:** aplicar una venta offline, **deduplicar el reintento**, reportar fallos por inventario insuficiente.

### 3. Frontend (componentes) — React Testing Library

- `frontend/src/features/sales/NewSalePage.test.tsx` — el flujo clave de venta rápida:
  - muestra sabores y disponibilidad,
  - calcula el total al sumar cantidades (2 × C$60 = C$120),
  - valida la ubicación antes de guardar,
  - guarda la venta con los datos correctos.
- `frontend/src/features/inventory/InventoryPage.test.tsx` — render de tarjetas visuales y estado de stock bajo.
- `frontend/src/lib/formatting/currency.test.ts` — formato de moneda (C$ sin espacios, locales).
- `frontend/src/lib/offline/outbox.test.ts` — encolado, estados y límite de reintentos del outbox.
- `frontend/src/services/api/inventory-cache.test.ts` — **regresión**: el caché de IndexedDB persiste la clave `flavorId` derivada de `flavor.id` (la tabla Dexie la usa como clave; sin normalizar, `bulkPut` falla y la UI muestra error aunque la red funcione).

### 4. E2E (navegador real) — Playwright

`e2e/tests/smoke.spec.ts` con **Playwright + Chromium** cubre el flujo crítico de punta a punta:

- Health de la API.
- Dashboard: estadísticas del día y acciones principales.
- **Venta rápida completa:** ubicación → sumar sabores → confirmar → la venta aparece en el listado.
- Inventario: sabores con su disponibilidad.

Playwright arranca solo ambos servidores (`e2e/playwright.config.ts`): API en `:3002` y Vite en `:5173` con proxy `/api`.

> ⚠️ **Base e2e**: se limpia con `rm -f data/e2e.db*` **dentro del comando del webServer** (antes de abrirla). No usar `globalSetup` para borrarla: Playwright arranca los servidores **antes** de `globalSetup`, y borrar el archivo con el servidor abierto deja la conexión en un inode desvinculado donde las escrituras fallan con `SQLITE_READONLY`.

```bash
pnpm test:e2e                  # requiere `pnpm exec playwright install chromium` una vez
```

## Cómo ejecutar

```bash
pnpm test                     # unitarios (backend + frontend)
pnpm test:e2e                 # e2e (Playwright)
pnpm --filter @nalu/backend test            # dominio + API
pnpm --filter @nalu/frontend test           # componentes
pnpm --filter @nalu/backend test:watch      # modo watch
```

## Infraestructura de tests

- **Backend:** Vitest, entorno `node`, base en memoria (`createMemoryDb`) con seed.
- **Frontend:** Vitest, entorno `jsdom`, `@testing-library/jest-dom`, `fake-indexeddb` (IndexedDB en jsdom), cleanup automático entre tests.
- **E2E:** Playwright, `workers: 1` (los flujos escriben en la misma BD), base limpia por ejecución.

## Principios

- Cada test de API usa una **base fresca** (determinista, sin contaminación entre tests).
- Los cálculos se prueban con los **números exactos del negocio** (C$28, C$60…).
- Las reglas críticas (costo histórico, no-venta de regalos, atomicidad, deduplicación) tienen **tests explícitos**.
- El lint y el typecheck estricto forman parte de CI (`pnpm lint`, `pnpm typecheck`).
