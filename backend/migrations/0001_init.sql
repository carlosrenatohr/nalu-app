-- =====================================================================
-- NALU — Migración 0001: esquema inicial
-- Convenciones:
--   * IDs: TEXT (UUID v4) generados por la aplicación.
--     Permiten operaciones atómicas multi-tabla en un solo batch de D1
--     y sincronización offline con deduplicación por clave primaria.
--   * Cantidades de inventario: SIEMPRE con signo.
--     + = entrada (PURCHASE, RETURN, ADJUSTMENT positivo)
--     - = salida  (SALE, GIFT, PERSONAL_USE, LOSS, ADJUSTMENT negativo)
--   * Dinero: REAL, redondeado a 2 decimales en la capa de dominio.
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- Negocios (una sola empresa por ahora; Nalu es la configuración inicial)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS businesses (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'NIO',
  default_purchase_cost REAL NOT NULL DEFAULT 28,
  default_home_price    REAL NOT NULL DEFAULT 60,
  primary_color         TEXT NOT NULL DEFAULT '#36C9C6',
  secondary_color       TEXT NOT NULL DEFAULT '#FF6F91',
  contact               TEXT,
  report_footer         TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- Sabores
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS flavors (
  id          TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  emoji       TEXT,
  color       TEXT,
  min_stock   INTEGER NOT NULL DEFAULT 10,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (business_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_flavors_business ON flavors(business_id);

-- ---------------------------------------------------------------------
-- Proveedores
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
  id          TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name        TEXT NOT NULL,
  contact     TEXT,
  notes       TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (business_id, name)
);

CREATE INDEX IF NOT EXISTS idx_suppliers_business ON suppliers(business_id);

-- ---------------------------------------------------------------------
-- Ubicaciones de venta (configurables desde Ajustes)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS locations (
  id          TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name        TEXT NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (business_id, name)
);

-- ---------------------------------------------------------------------
-- Compras
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchases (
  id            TEXT PRIMARY KEY,
  business_id   TEXT NOT NULL REFERENCES businesses(id),
  supplier_id   TEXT NOT NULL REFERENCES suppliers(id),
  purchase_date TEXT NOT NULL,
  notes         TEXT,
  total_cost    REAL NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_purchases_business_date
  ON purchases(business_id, purchase_date);

CREATE TABLE IF NOT EXISTS purchase_items (
  id          TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  flavor_id   TEXT NOT NULL REFERENCES flavors(id),
  quantity    INTEGER NOT NULL,
  unit_cost   REAL NOT NULL,
  subtotal    REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_flavor ON purchase_items(flavor_id);

-- ---------------------------------------------------------------------
-- Ventas
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales (
  id          TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  sale_date   TEXT NOT NULL,
  location    TEXT,
  notes       TEXT,
  total       REAL NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sales_business_date
  ON sales(business_id, sale_date);

CREATE TABLE IF NOT EXISTS sale_items (
  id                TEXT PRIMARY KEY,
  sale_id           TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  flavor_id         TEXT NOT NULL REFERENCES flavors(id),
  quantity          INTEGER NOT NULL,
  unit_price        REAL NOT NULL,
  -- Costo histórico: se congela en el momento de la venta.
  -- Nunca se recalcula con el costo actual del proveedor.
  unit_cost_snapshot REAL NOT NULL,
  subtotal          REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_flavor ON sale_items(flavor_id);

-- ---------------------------------------------------------------------
-- Movimientos de inventario (modelo autoritativo)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_movements (
  id            TEXT PRIMARY KEY,
  business_id   TEXT NOT NULL REFERENCES businesses(id),
  flavor_id     TEXT NOT NULL REFERENCES flavors(id),
  movement_type TEXT NOT NULL CHECK (
    movement_type IN ('PURCHASE', 'SALE', 'GIFT', 'PERSONAL_USE', 'LOSS', 'ADJUSTMENT', 'RETURN')
  ),
  -- Cantidad CON SIGNO: positivo = entrada, negativo = salida
  quantity     INTEGER NOT NULL,
  unit_cost    REAL,
  -- Referencia a la entidad que originó el movimiento (compra, venta, ...)
  reference_id TEXT,
  date         TEXT NOT NULL,
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_movements_flavor_date
  ON inventory_movements(flavor_id, date);
CREATE INDEX IF NOT EXISTS idx_movements_business_date
  ON inventory_movements(business_id, date);
CREATE INDEX IF NOT EXISTS idx_movements_reference
  ON inventory_movements(reference_id);

-- ---------------------------------------------------------------------
-- Operaciones sincronizadas (outbox offline → servidor)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_operations (
  op_id          TEXT PRIMARY KEY,
  operation_type TEXT NOT NULL,
  entity_type    TEXT NOT NULL,
  entity_id      TEXT,
  status         TEXT NOT NULL DEFAULT 'applied',
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sync_operations_status
  ON sync_operations(status, created_at);
