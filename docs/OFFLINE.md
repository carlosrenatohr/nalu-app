# Offline-first y sincronización

Nalu está diseñada para seguir funcionando **sin conexión**: es el caso más importante para vender en el puesto o en la calle.

## Arquitectura offline

```
Acción del usuario
   │
   ├─ ¿En línea? → API (Express/D1) → se actualiza el caché de IndexedDB
   │
   └─ ¿Sin conexión?
        ├─ se guarda la entidad local en IndexedDB
        ├─ se crea la operación en el OUTBOX (pendiente)
        └─ la UI refleja el cambio al instante
              │
              └─ (vuelve la conexión)
                    └─ motor de sincronización drena el outbox → API → D1
                          └─ se marca como sincronizada (idempotente)
```

## Capas

### 1. Service Worker (shell offline)

`vite-plugin-pwa` genera `sw.js` con Workbox:

- Precachea el shell de la app (HTML, JS, CSS, íconos) → la app **abre** sin conexión.
- **La API NO se cachea en el Service Worker**: el modo offline de datos vive en IndexedDB para evitar datos obsoletos.

### 2. IndexedDB (Dexie) — datos de negocio

Tablas: `flavors`, `suppliers`, `locations`, `business`, `inventory`, `sales`, `purchases`, `movements`, `outbox`.

- **Lecturas offline:** cada API de feature intenta el servidor y cae al caché si no hay red.
- **Escrituras offline:** se crea la entidad local y se encola la operación.
- **`localStorage` NO se usa para datos transaccionales** (solo permitido para preferencias simples; actualmente no se usa para nada crítico).

### 3. Outbox

Cada operación pendiente tiene:

| Campo | Descripción |
|---|---|
| `opId` | UUID de la entidad (clave de deduplicación) |
| `type` | `sale`, `purchase`, `movement`, `flavor`, `supplier` |
| `payload` | Datos completos de la entidad (incluye el `id`) |
| `status` | `pending` → `synced` / `failed` |
| `attempts` | Reintentos |
| `createdAt` | Fecha de creación |

### 4. Motor de sincronización (`syncEngine`)

- Escucha los eventos `online`/`offline` del navegador.
- Sincroniza automáticamente al volver la conexión (y tras cada escritura local, con debounce de 1,5 s).
- Envía las operaciones pendientes a `POST /api/sync/operations` y aplica el resultado:
  - `applied` / `duplicate` → se marca `synced`.
  - `failed` (p. ej. inventario insuficiente) → se marca `failed` con mensaje; la UI lo muestra y la operación queda para revisión.
- Tras sincronizar, refresca el caché de inventario desde el servidor.

## Idempotencia y protección contra duplicados

**El `opId` es el UUID de la entidad.** El servidor:

1. Verifica `sync_operations` → si el `opId` ya existe, responde `duplicate` sin reaplicar.
2. Inserta la entidad con ese mismo UUID → cualquier reintento concurrente choca con la clave primaria y se trata como duplicado.

Esto hace que los reintentos (red cortada a mitad de sync, doble clic, etc.) sean **seguros por diseño**.

## Sincronización en la UI (nunca se oculta)

El chip de estado en el encabezado muestra siempre:

- 🟢 **En línea**
- 🔴 **Sin conexión** (+ n pendientes)
- 🟡 **n cambios pendientes**
- 🔄 **Sincronizando…**
- ⚠️ errores de sincronización (con botón "Sincronizar ahora" en la página Más)

## Operaciones soportadas offline

- Registrar ventas (con totales estimados y costo histórico del caché).
- Registrar compras.
- Registrar regalos, consumo propio, pérdidas y ajustes.
- Crear sabores y proveedores.
- Ver inventario, ventas, compras y movimientos cacheados.

**Nota de exactitud:** mientras está offline, los totales mostrados son estimaciones locales; al sincronizar, el servidor recalcula y corrige los valores (el servidor es la fuente de verdad financiera).
