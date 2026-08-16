import { asc } from "drizzle-orm";
import { createApp } from "./app";
import { openLocalDb } from "./db";
import { businesses } from "./db/schema";
import { seedDatabase } from "./db/seed";
import { resolveBusinessId } from "./config/bootstrap";

// ---------------------------------------------------------------------
// Entrada de desarrollo local: Express + node:sqlite.
// En producción se usa src/worker.ts (Cloudflare Workers + D1).
// ---------------------------------------------------------------------
// Puerto 3002: evita chocar con otras apps locales (3001 es común).
const PORT = Number(process.env.PORT ?? 3002);

async function main(): Promise<void> {
  // DB_PATH permite apuntar a otra base (útil para e2e con datos limpios).
  const { db, conn } = openLocalDb(process.env.DB_PATH);

  // Si la base está vacía, cargamos los datos semilla automáticamente
  // (solo en desarrollo; en producción el seed se aplica con wrangler).
  const rows: { id: string }[] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .orderBy(asc(businesses.createdAt));
  const business = rows[0] ?? null;
  if (!business) {
    seedDatabase(conn);
    console.log("ℹ Base vacía: datos semilla cargados.");
  }

  // El id se resuelve una vez y se cachea (misma firma que el worker).
  let cachedBusinessId: string | null = null;
  async function getBusinessId(): Promise<string> {
    if (cachedBusinessId === null) {
      cachedBusinessId = await resolveBusinessId(db);
    }
    return cachedBusinessId;
  }

  const app = createApp({
    db,
    getBusinessId,
    corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  });

  app.listen(PORT, () => {
    console.log(`🍧 Nalu API escuchando en http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("No se pudo iniciar Nalu API:", err);
  process.exit(1);
});
