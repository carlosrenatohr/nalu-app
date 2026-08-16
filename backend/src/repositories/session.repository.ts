import type { Db } from "../db/types";

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

export function createSessionRepository(db: Db) {
  return {
    async create(session: SessionRow): Promise<void> {
      // La expiración la calcula SQLite en el mismo formato que la
      // comparación (datetime local), para que el chequeo sea correcto.
      await db.run(
        `INSERT INTO sessions (token_hash, business_id, created_at, expires_at)
         VALUES (?, ?, datetime('now', 'localtime'), datetime('now', 'localtime', '+${SESSION_TTL_DAYS} days'))`,
        [session.tokenHash, session.businessId],
      );
    },

    /** Busca por hash de token y descarta las expiradas al vuelo. */
    async findByTokenHash(tokenHash: string): Promise<SessionRow | null> {
      const session = await db.first<SessionRow>(
        `SELECT token_hash AS tokenHash, business_id AS businessId,
                created_at AS createdAt, expires_at AS expiresAt
         FROM sessions
         WHERE token_hash = ? AND expires_at > datetime('now', 'localtime')`,
        [tokenHash],
      );
      return session;
    },

    async delete(tokenHash: string): Promise<void> {
      await db.run("DELETE FROM sessions WHERE token_hash = ?", [tokenHash]);
    },

    /** Limpia sesiones expiradas (mantenimiento opcional). */
    async deleteExpired(): Promise<void> {
      await db.run("DELETE FROM sessions WHERE expires_at <= datetime('now', 'localtime')");
    },
  };
}
