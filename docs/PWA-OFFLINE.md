# Sistema Offline-First — Nalu

Nalu funciona sin conexión a internet. Las ventas, compras y movimientos de inventario se registran localmente y se sincronizan con el servidor cuando vuelve la red.

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    UI (React)                            │
│                                                         │
│  Feature → services/api/*.create(input)                 │
│              │                                          │
│              ├─ ¿En línea? ──► POST /api/* ──► Server   │
│              │                                   │      │
│              │                              Guarda en    │
│              │                              IndexedDB    │
│              │                                          │
│              └─ ¿Sin conexión? ──► Crea entidad local   │
│                                       │                 │
│                                       ▼                 │
│                                  IndexedDB              │
│                                  + outbox               │
│                                       │                 │
│                                       ▼                 │
│                                  syncEngine.requestSync │
│                                  (debounced 1.5s)       │
├─────────────────────────────────────────────────────────┤
│              CAPA OFFLINE (lib/offline/)                 │
│                                                         │
│  network.ts ──► syncEngine.ts ──► outbox.ts             │
│  (online/      (orquesta sync)   (IndexedDB)            │
│   offline)                                            │
├─────────────────────────────────────────────────────────┤
│              SERVIDOR (Express/D1)                       │
│                                                         │
│  POST /api/sync/operations                              │
│    → syncService.applyOperations(operations)            │
│    → Deduplicación por opId (sync_operations)           │
│    → Respuesta: applied | duplicate | failed             │
└─────────────────────────────────────────────────────────┘
```

## Componentes clave

### `network.ts`

Detección de conectividad usando `navigator.onLine` + eventos `online`/`offline` del browser. Expone un observable del estado de red.

### `outbox.ts`

Cola de operaciones pendientes almacenada en IndexedDB (Dexie). Cada operación tiene:

| Campo | Descripción |
|-------|-------------|
| `opId` | UUID de la entidad (= `entity.id`) |
| `type` | Tipo de operación (`sale`, `purchase`, `movement`, `flavor`, `supplier`) |
| `payload` | Datos de la operación |
| `status` | `pending` → `synced` \| `failed` |
| `attempts` | Conteo de intentos fallidos |
| `createdAt` | Timestamp de creación |

### `syncEngine.ts`

Orquesta la sincronización:

1. Espera 1.5 segundos después de un cambio (debounce)
2. Recopila operaciones pendientes del outbox
3. Las envía al servidor en una sola petición `POST /api/sync/operations`
4. Procesa resultados: `applied`/`duplicate` → markSynced, `failed` → markFailed
5. Refresca el caché de inventario local

Se activa cuando:
- Vuelve la conexión (evento `online`)
- El usuario pulsa "Sincronizar ahora" o el `SyncChip`
- Se crea una nueva operación de negocio

### `session.ts`

Persiste el token de autenticación en IndexedDB (no localStorage). Sobrevive recargas.

## Operaciones que pasan por el outbox

| Tipo | Operación | Creada offline |
|------|-----------|----------------|
| `"sale"` | `salesApi.create()` | Sí |
| `"purchase"` | `purchasesApi.create()` | Sí |
| `"movement"` | `inventoryApi.registerMovement()` | Sí |
| `"flavor"` | `flavorsApi.create()` | Sí |
| `"supplier"` | `suppliersApi.create()` | Sí |

**No pasan por el outbox:**
- Lecturas (list, get) — caen al caché local en error de red
- Updates (PATCH) — van directo al server
- Autenticación — siempre requiere conexión
- Reportes — siempre van al server

## Deduplicación por opId

El `opId` **es** el `id` de la entidad. No hay ID separado para la operación.

```
Cliente genera UUID ──► outbox con opId = entity.id
    │
    ▼
Servidor: ¿opId existe en sync_operations?
    ├── SÍ ──► "duplicate" ──► markSynced
    └── NO ──► Aplica la operación
                  ├── Éxito ──► "applied" ──► markSynced
                  └── Error   ──► "failed" ──► markFailed (reintento)
```

La deduplicación funciona en 2 capas:
1. **Tabla `sync_operations`**: consulta `SELECT 1 WHERE op_id = ?`
2. **Constraints de PK**: si la inserción en `sync_operations` falla con `UNIQUE constraint`, se trata como duplicado

## Estados de la UI — SyncChip

El `SyncChip` en la barra de layout muestra siempre el estado de sincronización:

| Estado | Condición | Visual |
|--------|-----------|--------|
| **Sincronizando...** | `syncing === true` | Badge turquesa + icono girando |
| **Sin conexión** | `!online` | Badge rojo + wifi-off. Muestra count de pendientes |
| **N cambios pendientes** | `online && pending > 0` | Badge amarillo + icono sync |
| **En línea** | `online && pending === 0` | Badge verde + wifi |

En la página "Más" hay un botón explícito "Sincronizar ahora".

## Limitaciones conocidas

1. **Sin resolución de conflictos bidireccional.** El modelo es "cliente escribe, servidor authoritative". Si el servidor modifica una entidad mientras el cliente tiene cambios pendientes, no hay merge.

2. **Updates no offline.** Solo `create` se encola. PATCH de flavors, suppliers, locations, business van directo al server y fallan sin conexión.

3. **Reportes sin offline.** `reportsApi` siempre hace petición al server.

4. **Estimaciones de costos.** Ventas/compras creadas offline usan el costo del caché local (`lastCost`). Si el proveedor cambió de precio, el costo histórico será una estimación.

5. **Sin retry automático con backoff.** El syncEngine hace un solo intento por ciclo. Si falla, la operación queda en `failed` y se reintenta con el próximo evento de sync.

6. **Limpieza del outbox.** Operaciones `synced` se eliminan después de 7 días, pero `cleanupOutbox()` no se llama automáticamente.

7. **Inventario delta local.** El delta aplicado offline modifica el caché pero no valida reglas de negocio del lado del cliente. La validación real ocurre en el servidor.

8. **Sesión offline.** Si el token expira y el usuario está offline, la sesión se mantiene localmente hasta que el servidor responda 401.

## Archivos principales

| Archivo | Ruta |
|---------|------|
| Schema Dexie | `frontend/src/lib/offline/db.ts` |
| Outbox | `frontend/src/lib/offline/outbox.ts` |
| Sync Engine | `frontend/src/lib/offline/syncEngine.ts` |
| Network | `frontend/src/lib/offline/network.ts` |
| Session | `frontend/src/lib/offline/session.ts` |
| SyncChip | `frontend/src/components/layout/SyncChip.tsx` |
| API Client | `frontend/src/services/api/index.ts` |
| Backend Sync | `backend/src/services/sync.service.ts` |
