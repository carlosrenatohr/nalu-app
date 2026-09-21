import type { DrizzleDb } from "./drizzle-types";

// ---------------------------------------------------------------------
// Ejecución atómica de escrituras de Drizzle compatible con los dos
// adaptadores de BD:
//   - D1 (producción): usa db.batch, que es la transacción nativa de D1
//     (todo o nada). D1 NO soporta `BEGIN`/`COMMIT` por SQL.
//   - SQLite (local/tests): usa db.transaction con BEGIN/COMMIT reales.
// ---------------------------------------------------------------------
export async function runAtomic(db: DrizzleDb, builders: unknown[]): Promise<void> {
  const anyDb = db as unknown as {
    batch?: (q: unknown[]) => Promise<unknown>;
    transaction?: (fn: (tx: never) => Promise<unknown>) => Promise<unknown>;
  };

  if (typeof anyDb.batch === "function") {
    await anyDb.batch(builders);
    return;
  }

  await anyDb.transaction!(async (tx) => {
    for (const builder of builders) {
      await (tx as unknown as { run: (b: unknown) => Promise<unknown> }).run(builder);
    }
  });
}