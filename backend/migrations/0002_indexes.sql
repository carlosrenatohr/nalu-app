-- =====================================================================
-- NALU — Migración 0002: índices adicionales para reportes frecuentes
-- =====================================================================

-- Reportes por precio de venta (análisis de canales)
CREATE INDEX IF NOT EXISTS idx_sale_items_price ON sale_items(unit_price);

-- Reportes por ubicación
CREATE INDEX IF NOT EXISTS idx_sales_location ON sales(location);
