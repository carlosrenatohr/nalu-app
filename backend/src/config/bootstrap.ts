import { asc } from "drizzle-orm";
import type { DrizzleDb } from "../db/drizzle-types";
import { businesses } from "../db/schema";

/**
 * Resuelve el id del negocio por defecto (aplicación de una sola empresa).
 * Si no hay negocio configurado, falla rápido con un mensaje claro.
 */
export async function resolveBusinessId(db: DrizzleDb): Promise<string> {
  const rows: { id: string }[] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .orderBy(asc(businesses.createdAt));
  const row = rows[0] ?? null;
  if (!row) {
    throw new Error(
      "No hay un negocio configurado. Ejecuta las migraciones y el seed (npm run db:migrate && npm run db:seed).",
    );
  }
  return row.id;
}
