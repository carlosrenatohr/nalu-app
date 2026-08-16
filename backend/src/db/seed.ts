import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { applyMigrations } from "./migrate";
import { DEFAULT_DB_PATH, MIGRATIONS_DIR } from "./paths";

/** Aplica el archivo seed.sql a una conexión (idempotente: INSERT OR IGNORE). */
export function seedDatabase(conn: DatabaseSync): void {
  const sql = readFileSync(join(MIGRATIONS_DIR, "seed.sql"), "utf8");
  conn.exec(sql);
}

function main(): void {
  const conn = new DatabaseSync(DEFAULT_DB_PATH);
  conn.exec("PRAGMA foreign_keys = ON;");
  applyMigrations(conn);
  seedDatabase(conn);
  conn.close();
  console.log("✓ Datos semilla cargados correctamente.");
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main();
}
