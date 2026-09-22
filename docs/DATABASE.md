# Base de datos

## Motor

- **Producción:** Cloudflare D1 (SQLite administrado, global, sin servidor).
- **Desarrollo local y tests:** `node:sqlite` (SQLite nativo de Node 24). Misma interfaz `Db`, mismos archivos de migración.

## Migraciones

Las migraciones viven en `backend/migrations/` como archivos SQL numerados (`0001_init.sql`, `0002_indexes.sql`, `0003_auth.sql`, …). Ver el detalle en [`docs/DATABASE-SCHEMA.md`](./DATABASE-SCHEMA.md) (ERD + guía de extensión).

| Entorno | Comando |
|---|---|
| Local (node:sqlite) | `pnpm db:migrate` (tracking en tabla `_migrations`) |
| D1 local (wrangler dev) | `pnpm exec wrangler d1 migrations apply nalu-db --local` |
| D1 producción | `pnpm exec wrangler d1 migrations apply nalu-db --remote` |

> **Nota:** Wrangler aplica también `seed.sql` como parte de las migraciones. Es seguro porque usa `INSERT OR IGNORE` con UUIDs fijos (idempotente). Localmente, `seed.sql` se aplica aparte con `pnpm db:seed` (y automáticamente al arrancar si la base está vacía).

**Regla:** el esquema de producción solo se modifica con migraciones nuevas, nunca a mano.

## Modelo de datos

### Convenciones

- **IDs:** `TEXT` (UUID v4) generados por la aplicación. Permiten:
  - lotes atómicos multi-tabla (se conoce el id antes de insertar),
  - sincronización offline con deduplicación por clave primaria.
- **Dinero:** `REAL`, redondeado a 2 decimales en la capa de dominio (`roundMoney`).
- **Fechas:** texto `YYYY-MM-DD` para fechas de negocio; `created_at`/`updated_at` en ISO 8601.
- **Booleans:** `INTEGER` 0/1.

### Tablas

| Tabla | Propósito |
|---|---|
| `businesses` | Configuración del negocio (nombre, moneda, costos/precios por defecto, colores, contacto). Nalu es la configuración inicial; la lógica no depende del nombre. |
| `flavors` | Sabores (nombre, slug único, emoji, color, stock mínimo). |
| `suppliers` | Proveedores. |
| `locations` | Ubicaciones de venta configurables (Casa, Puesto, Otro…). |
| `purchases` / `purchase_items` | Compras y sus líneas (cantidad, costo unitario, subtotal). |
| `sales` / `sale_items` | Ventas y sus líneas. `sale_items.unit_cost_snapshot` guarda el **costo histórico** congelado al vender. |
| `inventory_movements` | **Modelo autoritativo de inventario** (ver convención de signos). |
| `sessions` | Sesiones de acceso (token hash, expiración a 90 días). |
| `sync_operations` | Registro de operaciones sincronizadas desde el outbox (deduplicación). |

### Convención de cantidades firmadas (inventario)

La columna `quantity` de `inventory_movements` tiene **signo**:

- **Positiva = entrada:** `PURCHASE`, `RETURN`, `ADJUSTMENT` positivo.
- **Negativa = salida:** `SALE`, `GIFT`, `PERSONAL_USE`, `LOSS`, `ADJUSTMENT` negativo.

El disponible de un sabor es `SUM(quantity)`. **No existen conteos paralelos.**

`movement_type` está restringido por `CHECK`: `PURCHASE | SALE | GIFT | PERSONAL_USE | LOSS | ADJUSTMENT | RETURN`.

### Costo histórico

`calculateAverageCost()` (función pura) calcula el costo promedio ponderado por sabor a partir de las compras:

```
avgCost = SUM(cantidad × costo) / SUM(cantidad)
```

Al registrar una venta, ese promedio se congela en `sale_items.unit_cost_snapshot`. **Las ventas antiguas nunca se recalculan** con el costo actual del proveedor.

### Índices

- `inventory_movements(flavor_id, date)` y `(business_id, date)` — historial e inventario.
- `inventory_movements(reference_id)` — trazabilidad compra/venta.
- `sales(business_id, sale_date)`, `purchases(business_id, purchase_date)` — reportes por rango.
- `sale_items(unit_price)` — análisis por precio.
- `sales(location)` — análisis por ubicación.
- `sync_operations(status, created_at)` — outbox.
- Claves foráneas con `ON DELETE CASCADE` en ítems de venta/compra.

## Datos semilla

`backend/migrations/seed.sql` crea un negocio Nalu con:

- 6 sabores con emoji y color (Coco, Oreo, Fresa Kiwi, Nutella con Almendras, Maracumango, Guanábana).
- 2 proveedores, 3 ubicaciones.
- Una compra inicial y ventas de ejemplo **relativas a hoy** (`date('now','localtime',…)`) para que los reportes siempre muestren datos.
- Ejemplos de regalo, consumo propio y pérdida.

## Integridad y respaldos locales

La base local de desarrollo (`backend/data/nalu.db`, `node:sqlite`) tiene comandos propios:

```bash
pnpm db:integrity       # PRAGMA integrity_check + foreign_key_check (solo lectura)
pnpm db:backup:local    # instantánea consistente con VACUUM INTO
pnpm db:backup          # export de D1 en producción (wrangler d1 export)
```

- **`db:integrity`** verifica la estructura del archivo y las claves
  foráneas; sale con código 1 si encuentra problemas (sirve para CI o
  scripts). Acepta una ruta opcional: `pnpm db:integrity <ruta.db>`.
- **`db:backup:local`** crea `backups/nalu-local-<fecha>.db` con
  `VACUUM INTO`: SQLite genera una instantánea consistente aunque el
  servidor de desarrollo esté escribiendo (a diferencia de copiar el
  archivo a mano). Verifica el respaldo con
  `pnpm db:integrity <ruta>`. Acepta rutas: `pnpm db:backup:local [origen] [destino]`.
- Las **rutas relativas** se prueban primero contra `backend/` y luego
  contra la raíz del repositorio (donde se invoca `pnpm`), así que
  `pnpm db:integrity backups/archivo.db` funciona desde la raíz.
- `backups/` está en `.gitignore`: los respaldos nunca se versionan.
- En producción la fuente es D1: respaldos con `pnpm db:backup` y
  migraciones solo con `wrangler d1 migrations apply`
  (ver [`DEPLOYMENT.md`](DEPLOYMENT.md)).
