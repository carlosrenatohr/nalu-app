import { eq, sql } from "drizzle-orm";
import type { DrizzleDb } from "../db/drizzle-types";
import { sessions } from "../db/schema";

// ---------------------------------------------------------------------
// Sesiones de acceso. Solo se almacena el hash del token; la expiración
// se compara con la fecha local del servidor.
// ---------------------------------------------------------------------

export interface SessionRow {
  tokenHash: string;
  businessId: string;
  createdAt: string;
  expiresAt: string;
}

export const SESSION_TTL_DAYS = 90;

export function createSessionRepository(db: DrizzleDb) {
  return {
    async create(session: SessionRow): Promise<void> {
      await db.insert(sessions).values({
        tokenHash: session.tokenHash,
        businessId: session.businessId,
        createdAt: sql`datetime('now', 'localtime')`.toString(),
        expiresAt: sql`datetime('now', 'localtime', '+${SESSION_TTL_DAYS} days')`.toString(),
      });
    },

    /** Busca por hash de token y descarta las expiradas al vuelo. */
    async findByTokenHash(tokenHash: string): Promise<SessionRow | null> {
      const now = new Date().toISOString();
      const result = await db
        .select({
          tokenHash: sessions.tokenHash,
          businessId: sessions.businessId,
          createdAt: sessions.createdAt,
          expiresAt: sessions.expiresAt,
        })
        .from(sessions)
        .where(eq(sessions.tokenHash, tokenHash))
        .then((rows: SessionRow[]) => rows[0] ?? null);

      if (!result) return null;
      if (result.expiresAt <= now) return null;
      return result;
    },

    async delete(tokenHash: string): Promise<void> {
      await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    },

    /** Limpia sesiones expiradas (mantenimiento opcional). */
    async deleteExpired(): Promise<void> {
      const now = new Date().toISOString();
      await db.delete(sessions).where(sql`${sessions.expiresAt} <= ${now}`);
    },
  };
}
