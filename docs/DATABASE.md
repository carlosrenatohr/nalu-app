# Base de datos

## Motor

- **Producción:** Cloudflare D1 (SQLite administrado, global, sin servidor).
- **Desarrollo local y tests:** `node:sqlite` (SQLite nativo de Node 24). Misma interfaz `Db`, mismos archivos de migración.

## Migraciones

Las migraciones viven en `backend/migrations/` como archivos SQL numerados (`0001_init.sql`, `0002_indexes.sql`).

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
