-- Tipo de pago en ventas y compras (por defecto efectivo).
ALTER TABLE sales ADD COLUMN payment_type TEXT NOT NULL DEFAULT 'cash';
ALTER TABLE purchases ADD COLUMN payment_type TEXT NOT NULL DEFAULT 'cash';