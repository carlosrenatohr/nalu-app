import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DEFAULT_DB_PATH, MIGRATIONS_DIR } from "./paths";

// ---------------------------------------------------------------------
// Aplicador de migraciones para desarrollo local (node:sqlite).
// Las MISMAS migraciones SQL se aplican en producción con:
//   wrangler d1 migrations apply <nombre-db> --remote
// ---------------------------------------------------------------------
export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort();
}

export function applyMigrations(db: DatabaseSync): string[] {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const applied = new Set(
    (db.prepare("SELECT name FROM _migrations").all() as { name: string }[]).map(
      (r) => r.name,
    ),
  );

  const appliedNow: string[] = [];
  for (const file of migrationFiles()) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    db.exec(sql);
    db.prepare("INSERT INTO _migrations (name) VALUES (?)").run(file);
    appliedNow.push(file);
  }
  return appliedNow;
}

function main(): void {
  mkdirSync(join(DEFAULT_DB_PATH, ".."), { recursive: true });
  const db = new DatabaseSync(DEFAULT_DB_PATH);
  db.exec("PRAGMA foreign_keys = ON;");
  const applied = applyMigrations(db);
  db.close();
  if (applied.length === 0) {
    console.log("✓ Base de datos al día, sin migraciones pendientes.");
  } else {
    console.log(`✓ Migraciones aplicadas:\n  - ${applied.join("\n  - ")}`);
  }
  console.log(`  Base: ${DEFAULT_DB_PATH}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main();
}
