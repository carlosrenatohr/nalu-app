import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// ---------------------------------------------------------------------
// Autenticación simple por PIN + sesiones de larga duración.
// El PIN se guarda como SHA-256(salt:pin); el token de sesión se guarda
// como SHA-256(token) para que una fuga de la BD no exponga sesiones.
// ---------------------------------------------------------------------

/** Salt aleatorio por negocio (se regenera al cambiar el PIN). */
export function generateSalt(): string {
  return randomBytes(16).toString("hex");
}

/** Hash determinista de un PIN con su salt. */
export function hashPin(pin: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${pin}`).digest("hex");
}

/** Comparación en tiempo constante para evitar ataques de timing. */
export function verifyPin(pin: string, salt: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashPin(pin, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/** Token de sesión aleatorio (64 hex = 32 bytes). */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/** Hash del token tal como se guarda en la tabla sessions. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
