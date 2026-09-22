import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { DEFAULT_DB_PATH, resolveDbPath } from "./paths";

// ---------------------------------------------------------------------
// Verificación de integridad de la base local (node:sqlite):
//   - `PRAGMA integrity_check`   → corrupción estructural del archivo.
//   - `PRAGMA foreign_key_check` → registros huérfanos (claves rotas).
// Solo lectura: nunca modifica datos. Sale con código 1 si hay
// problemas, para poder usarlo en CI o scripts.
// ---------------------------------------------------------------------

export interface IntegrityResult {
  ok: boolean;
  problems: string[];
}

export function checkIntegrity(conn: DatabaseSync): IntegrityResult {
  const problems: string[] = [];

  // integrity_check devuelve "ok" o una fila por cada problema detectado.
  const structure = conn.prepare("PRAGMA integrity_check").all() as { integrity_check: string }[];
  for (const row of structure) {
    if (row.integrity_check !== "ok") problems.push(row.integrity_check);
  }

  // foreign_key_check: una fila por violación (vacío = sin problemas).
  const fks = conn.prepare("PRAGMA foreign_key_check").all() as Record<string, unknown>[];
  for (const row of fks) {
    problems.push(
      `clave foránea inválida en la tabla «${String(row.table)}» (rowid ${String(row.rowid)})`,
    );
  }

  return { ok: problems.length === 0, problems };
}

/** Abre el archivo indicado (por defecto la base local), verifica y cierra. */
export function checkIntegrityFile(path: string = DEFAULT_DB_PATH): IntegrityResult {
  const conn = new DatabaseSync(path, { readOnly: true });
  try {
    conn.exec("PRAGMA busy_timeout = 3000;");
    return checkIntegrity(conn);
  } finally {
    conn.close();
  }
}

function main(): void {
  const path = process.argv[2] ? resolveDbPath(process.argv[2]) : DEFAULT_DB_PATH;
  if (!existsSync(path)) {
    console.error(`✗ No existe la base local: ${path}`);
    console.error("  Créala con `pnpm db:migrate` (o `pnpm db:seed` con datos semilla).");
    process.exitCode = 1;
    return;
  }

  let result: IntegrityResult;
  try {
    result = checkIntegrityFile(path);
  } catch (error) {
    console.error(`✗ No se pudo abrir la base: ${error instanceof Error ? error.message : error}`);
    console.error("  Si el archivo está dañado, restaura un respaldo (pnpm db:backup:local).");
    process.exitCode = 1;
    return;
  }

  if (result.ok) {
    console.log(`✓ Integridad verificada sin problemas: ${path}`);
    return;
  }
  console.error(`✗ ${result.problems.length} problema(s) de integridad en ${path}:`);
  for (const problem of result.problems.slice(0, 20)) console.error(`  - ${problem}`);
  if (result.problems.length > 20) console.error(`  … y ${result.problems.length - 20} más.`);
  console.error("  Restaura un respaldo: pnpm db:backup:local (local) o pnpm db:backup (D1).");
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main();
}
