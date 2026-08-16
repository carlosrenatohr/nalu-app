import type { Db } from "../db/types";

/**
 * Resuelve el id del negocio por defecto (aplicación de una sola empresa).
 * Si no hay negocio configurado, falla rápido con un mensaje claro.
 */
export async function resolveBusinessId(db: Db): Promise<string> {
  const row = await db.first<{ id: string }>(
    "SELECT id FROM businesses ORDER BY created_at LIMIT 1",
  );
  if (!row) {
    throw new Error(
      "No hay un negocio configurado. Ejecuta las migraciones y el seed (npm run db:migrate && npm run db:seed).",
    );
  }
  return row.id;
}
