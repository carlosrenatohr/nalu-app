import type { Db } from "../db/types";
import type { Business } from "../domain/types";
import { createBusinessRepository } from "../repositories/business.repository";
import { createSessionRepository } from "../repositories/session.repository";
import { ApiError } from "../utils/http-error";
import { generateSalt, generateToken, hashPin, hashToken, verifyPin } from "../utils/auth";

// ---------------------------------------------------------------------
// Autenticación por PIN con sesiones de larga duración (90 días).
// Reglas:
//   * El PIN tiene 4-6 dígitos; se verifica en tiempo constante.
//   * El token se entrega al cliente y SOLO se guarda su hash.
//   * La sesión vive 90 días para que la app móvil no cierre sesión
//     constantemente.
// ---------------------------------------------------------------------

const PIN_PATTERN = /^\d{4,6}$/;

export interface LoginResult {
  token: string;
  expiresAt: string;
  business: Business;
}

export function createAuthService(deps: { db: Db; getBusinessId: () => Promise<string> }) {
  // El login es contra el negocio por defecto (uno solo por ahora);
  // getBusinessId se mantiene en la firma por consistencia con los demás.
  const { db } = deps;
  const businessRepo = createBusinessRepository(db);
  const sessions = createSessionRepository(db);

  /** Datos de acceso del negocio (PIN) — nunca se exponen por la API. */
  async function getCredentials(): Promise<{ id: string; pinHash: string; pinSalt: string } | null> {
    return db.first<{ id: string; pinHash: string; pinSalt: string }>(
      `SELECT id, pin_hash AS pinHash, pin_salt AS pinSalt
       FROM businesses
       ORDER BY created_at LIMIT 1`,
    );
  }

  async function login(pin: string): Promise<LoginResult> {
    const creds = await getCredentials();
    if (!creds || !creds.pinHash || !creds.pinSalt) {
      throw ApiError.unauthorized("La autenticación no está configurada.");
    }
    if (!verifyPin(pin, creds.pinSalt, creds.pinHash)) {
      throw ApiError.unauthorized("PIN incorrecto. Intenta de nuevo.");
    }

    const token = generateToken();
    await sessions.create({
      tokenHash: hashToken(token),
      businessId: creds.id,
      createdAt: "",
      expiresAt: "",
    });
    const expiresAt = await db.first<{ expiresAt: string }>(
      `SELECT expires_at AS expiresAt FROM sessions WHERE token_hash = ?`,
      [hashToken(token)],
    );
    const business = await businessRepo.getDefault();
    return { token, expiresAt: expiresAt?.expiresAt ?? "", business: business! };
  }

  async function logout(token: string): Promise<void> {
    await sessions.delete(hashToken(token));
  }

  /** Devuelve el negocio si el token es válido; null si no. */
  async function me(token: string): Promise<Business | null> {
    const session = await sessions.findByTokenHash(hashToken(token));
    if (!session) return null;
    return businessRepo.getDefault();
  }

  /** Valida un token y devuelve el businessId (usado por el middleware). */
  async function validateToken(token: string): Promise<string | null> {
    const session = await sessions.findByTokenHash(hashToken(token));
    return session?.businessId ?? null;
  }

  async function changePin(currentPin: string, newPin: string): Promise<void> {
    if (!PIN_PATTERN.test(newPin)) {
      throw ApiError.badRequest("INVALID_PIN", "El nuevo PIN debe tener entre 4 y 6 dígitos.");
    }
    const creds = await getCredentials();
    if (!creds || !creds.pinHash || !creds.pinSalt) {
      throw ApiError.unauthorized("La autenticación no está configurada.");
    }
    if (!verifyPin(currentPin, creds.pinSalt, creds.pinHash)) {
      throw ApiError.unauthorized("El PIN actual es incorrecto.");
    }

    // Salt nuevo por negocio: un cambio de PIN invalida hashes previos.
    const salt = generateSalt();
    await db.run(
      "UPDATE businesses SET pin_hash = ?, pin_salt = ?, updated_at = ? WHERE id = ?",
      [hashPin(newPin, salt), salt, new Date().toISOString(), creds.id],
    );
  }

  async function hasPin(): Promise<boolean> {
    const creds = await getCredentials();
    return Boolean(creds?.pinHash && creds.pinSalt);
  }

  return { login, logout, me, validateToken, changePin, hasPin };
}

// Re-export para no acoplar el middleware al servicio completo.
export type AuthService = ReturnType<typeof createAuthService>;
