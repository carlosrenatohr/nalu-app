-- =====================================================================
-- NALU — Migración 0003: autenticación simple (PIN + sesiones largas)
--
-- * El negocio tiene un PIN de acceso (4-6 dígitos). Se guarda como
--   hash SHA-256(salt:pin); el salt se genera por negocio al cambiar el
--   PIN. Nunca se almacena el PIN en claro.
-- * Las sesiones usan un token aleatorio (32 bytes) del que SOLO se
--   guarda su hash SHA-256 en la BD: si la base se filtra, los tokens
--   no son utilizables. La sesión dura 90 días para no cerrar la app
--   constantemente en el móvil.
-- * PIN por defecto "1234" (salt fijo nalu-default) para bases nuevas
--   y existentes. Se debe cambiar desde Ajustes.
-- =====================================================================

ALTER TABLE businesses ADD COLUMN pin_hash TEXT;
ALTER TABLE businesses ADD COLUMN pin_salt TEXT;
ALTER TABLE businesses ADD COLUMN alert_email TEXT;

-- Backfill del PIN por defecto para bases existentes (hash precalculado
-- de "nalu-default:1234"; el SQL no puede hashear en D1).
UPDATE businesses
SET pin_hash = '15c7d5e123707cd41495ca8520e5d6cae39cc40885cfaa0bea9d5c9beda2896f',
    pin_salt = 'nalu-default'
WHERE pin_hash IS NULL;

-- ---------------------------------------------------------------------
-- Sesiones (token largo con expiración)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_business ON sessions(business_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
