# Esquema y arquitectura de la base de datos 🗄️

Documento técnico del modelo de datos de Nalu: diagrama entidad-relación, migraciones, convenciones y **guía para extender** el esquema sin romper nada.

> Complementa a [`docs/DATABASE.md`](./DATABASE.md) (visión general) y [`docs/OFFLINE.md`](./OFFLINE.md) (sincronización). Este documento se enfoca en el **esquema concreto** y en cómo evolucionarlo.

---

## 1. Diagrama entidad-relación (ERD)

```
┌───────────────────────┐
│      businesses       │  ← un solo negocio por ahora (Nalu)
│───────────────────────│
│ id PK                 │
│ name                  │
│ currency              │
│ default_purchase_cost │
│ default_home_price    │
│ primary/secondary_color│
│ contact, report_footer│
│ alert_email           │  ← destinatario de alertas por email
│ pin_hash, pin_salt    │  ← autenticación (nunca el PIN en claro)
└───────┬───────────────┘
        │
        │ 1 ── N
        ├───────────────► ┌──────────────────────┐
        │                 │       flavors        │  nombre, slug único,
        │                 └──────────────────────┘  emoji, color, min_stock
        │ 1 ── N
        ├───────────────► ┌──────────────────────┐
        │                 │      suppliers       │  nombre, contacto, notas
        │ 1 ── N
        ├───────────────► ┌──────────────────────┐
        │                 │      locations       │  Casa, Puesto, Otro…
        │ 1 ── N
        ├───────────────► ┌──────────────────────┐
        │                 │      purchases       │  compra a un proveedor
        │                 └──────────┬───────────┘
        │                            │ 1 ── N
        │                            ▼
        │                 ┌──────────────────────┐
        │                 │   purchase_items     │  cantidad, unit_cost, subtotal
        │ 1 ── N
        ├───────────────► ┌──────────────────────┐
        │                 │        sales         │  venta (única que genera ingresos)
        │                 └──────────┬───────────┘
        │                            │ 1 ── N
        │                            ▼
        │                 ┌──────────────────────┐
        │                 │     sale_items       │  unit_cost_snapshot = costo histórico
        │ 1 ── N
        ├───────────────► ┌──────────────────────┐
        │                 │ inventory_movements  │  ★ MODELO AUTORITATIVO
        │                 │  (flavor_id → flavors)│  cantidad CON SIGNO
        │ 1 ── N
        └───────────────► ┌──────────────────────┐
                          │      sessions        │  token_hash (SHA-256), expires_at
                          └──────────────────────┘

(global) ──────────────► ┌──────────────────────┐
                         │  sync_operations     │  op_id PK (deduplicación outbox)
                         └──────────────────────┘
```

### Cardinalidades

| Relación | Cardinalidad | Notas |
|---|---|---|
| `businesses` → `flavors/suppliers/locations` | 1:N | todo pertenece al negocio |
| `purchases` → `purchase_items` | 1:N | `ON DELETE CASCADE` |
| `sales` → `sale_items` | 1:N | `ON DELETE CASCADE` |
| `purchases` → `suppliers` | N:1 | FK obligatoria |
| `sales` → `flavors` | indirecta | vía `sale_items.flavor_id` |
| `inventory_movements` → `flavors` | N:1 | FK obligatoria |

---

## 2. Migraciones (historial)

| Archivo | Contenido |
|---|---|
| `0001_init.sql` | Esquema base: todas las tablas + CHECK de `movement_type` + índices |
| `0002_indexes.sql` | Índices adicionales para reportes (`sale_items(unit_price)`, `sales(location)`) |
| `0003_auth.sql` | Autenticación: columnas `pin_hash/pin_salt/alert_email` en `businesses` + tabla `sessions` + backfill del PIN por defecto `1234` |
| `seed.sql` | Datos demo idempotentes (`INSERT OR IGNORE` con UUIDs fijos) |

**Reglas de oro:**

1. **Nunca** se modifica producción a mano: solo migraciones nuevas numeradas (`0004_…sql`).
2. Las migraciones se aplican en orden alfabético (local y D1).
3. `seed.sql` es idempotente y seguro de re-ejecutar.

---

## 3. Convenciones de columna

- **IDs:** `TEXT` UUID v4 generados por la app → permiten lotes atómicos y deduplicación offline por PK.
- **Dinero:** `REAL` + `roundMoney()` en dominio (2 decimales).
- **Fechas de negocio:** `YYYY-MM-DD`; `created_at/updated_at` en ISO 8601.
- **Booleans:** `INTEGER` 0/1.
- **Inventario:** `quantity` CON SIGNO (`SUM` = disponible; no hay conteos paralelos).
- **Costo histórico:** `sale_items.unit_cost_snapshot` se congela al vender y nunca se recalcula.

---

## 4. Guía de extensión

### ➕ Agregar un sabor — sin tocar código

Los sabores son **datos, no un enum**: se crean desde la app (Ajustes → Sabores → Nuevo sabor) o con un `INSERT`:

```sql
INSERT INTO flavors (id, business_id, name, slug, emoji, color, min_stock)
VALUES ('uuid-v4', '10000000-0000-4000-8000-000000000001',
        'Lulo', 'lulo', '🍈', '#A8D08D', 10);
```

- El `slug` se genera automáticamente al crearlo por la API (`utils/slugify.ts`).
- Emoji y color son opcionales (la UI usa `🍦` y un degradado neutro como fallback).
- **Cero cambios de código** en frontend o backend: el inventario, la venta rápida y los reportes son data-driven.

### 🔄 Agregar un tipo de movimiento de inventario — con migración

El único "enum" real es `inventory_movements.movement_type` (CHECK constraint):

```sql
CHECK (movement_type IN ('PURCHASE','SALE','GIFT','PERSONAL_USE','LOSS','ADJUSTMENT','RETURN'))
```

Para añadir uno nuevo (p. ej. `DONATION`):

1. **Migración** `0004_add_movement_type.sql`:
   ```sql
   -- D1 no permite alterar un CHECK; se recrea la tabla (o se relaja el CHECK).
   -- En SQLite moderno: PRAGMA foreign_keys=OFF; CREATE TABLE nuevo…; INSERT SELECT; DROP; RENAME.
   ```
2. **Dominio:** ampliar `MovementType` en `backend/src/domain/types.ts` y el espejo en `frontend/src/types/index.ts`.
3. **UI:** añadir la etiqueta en el modal de salidas (`frontend/src/features/inventory/ExitModal.tsx`).
4. **Regla de entrada/salida:** si no genera ingresos y resta stock, se marca como salida en `isInbound()` (`backend/src/domain/calculations/inventory.ts`).

> Antes de crear un tipo nuevo, pregúntate si realmente es un movimiento distinto o una variante de los existentes: cada tipo nuevo se propaga por dominio, UI y reportes.

### 🗃️ Agregar una tabla nueva

1. Crear `0004_mi_tabla.sql` con `CREATE TABLE` + índices + FKs.
2. Repositorio en `backend/src/repositories/` sobre la interfaz `Db` (`all/first/run/batch`).
3. Exponerlo en un servicio y sus controladores.
4. Si el frontend necesita el dato: tipo en `frontend/src/types/index.ts` y endpoint en el cliente tipado (`frontend/src/services/api/index.ts`).

### 📧 Agregar un campo al negocio (p. ej. otro email)

Es el patrón más simple: migración `ALTER TABLE businesses ADD COLUMN …`, luego:

- `backend/src/domain/types.ts` (Business),
- `backend/src/repositories/business.repository.ts` (SELECT + COLUMN_MAP + update),
- `backend/src/schemas/business.ts` (validación Zod),
- `frontend/src/types/index.ts` y la página de Ajustes.

---

## 5. Chequeo rápido de integridad

```sql
-- Disponible por sabor (debe coincidir con la app)
SELECT f.name, SUM(m.quantity) AS disponible
FROM inventory_movements m
JOIN flavors f ON f.id = m.flavor_id
GROUP BY f.id;

-- Costo histórico congelado en las ventas
SELECT sale_id, flavor_id, unit_cost_snapshot FROM sale_items;
```
