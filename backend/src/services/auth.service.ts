import { eq, asc } from "drizzle-orm";
import type { DrizzleDb } from "../db/drizzle-types";
import { businesses, sessions } from "../db/schema";
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

export function createAuthService(deps: { db: DrizzleDb; getBusinessId: () => Promise<string> }) {
  const { db } = deps;
  const businessRepo = createBusinessRepository(db);
  const sessionsRepo = createSessionRepository(db);

  /** Datos de acceso del negocio (PIN) — nunca se exponen por la API. */
  async function getCredentials(): Promise<{ id: string; pinHash: string; pinSalt: string } | null> {
    const row = await db
      .select({
        id: businesses.id,
        pinHash: businesses.pinHash,
        pinSalt: businesses.pinSalt,
      })
      .from(businesses)
      .orderBy(asc(businesses.createdAt))
      .then((rows: { id: string; pinHash: string | null; pinSalt: string | null }[]) => rows[0] ?? null);
    return row ?? null;
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
    await sessionsRepo.create({
      tokenHash: hashToken(token),
      businessId: creds.id,
      createdAt: "",
      expiresAt: "",
    });
    const sessionRow = await db
      .select({ expiresAt: sessions.expiresAt })
      .from(sessions)
      .where(eq(sessions.tokenHash, hashToken(token)))
      .then((rows: { expiresAt: string }[]) => rows[0] ?? null);
    const business = await businessRepo.getDefault();
    return { token, expiresAt: sessionRow?.expiresAt ?? "", business: business! };
  }

  async function logout(token: string): Promise<void> {
    await sessionsRepo.delete(hashToken(token));
  }

  /** Devuelve el negocio si el token es válido; null si no. */
  async function me(token: string): Promise<Business | null> {
    const session = await sessionsRepo.findByTokenHash(hashToken(token));
    if (!session) return null;
    return businessRepo.getDefault();
  }

  /** Valida un token y devuelve el businessId (usado por el middleware). */
  async function validateToken(token: string): Promise<string | null> {
    const session = await sessionsRepo.findByTokenHash(hashToken(token));
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
    await db
      .update(businesses)
      .set({
        pinHash: hashPin(newPin, salt),
        pinSalt: salt,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(businesses.id, creds.id));
  }

  async function hasPin(): Promise<boolean> {
    const creds = await getCredentials();
    return Boolean(creds?.pinHash && creds.pinSalt);
  }

  return { login, logout, me, validateToken, changePin, hasPin };
}

// Re-export para no acoplar el middleware al servicio completo.
export type AuthService = ReturnType<typeof createAuthService>;
