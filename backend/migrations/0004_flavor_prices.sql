-- =====================================================================
-- NALU — Migración 0004: precios de referencia en sabores
-- Agrega cost_price y sale_price para tener precios de referencia
-- por sabor (no reemplaza el costo histórico congelado en ventas).
-- =====================================================================

PRAGMA foreign_keys = ON;

ALTER TABLE flavors ADD COLUMN cost_price REAL;
ALTER TABLE flavors ADD COLUMN sale_price REAL;
