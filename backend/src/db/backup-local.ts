import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DEFAULT_DB_PATH, resolveDbPath } from "./paths";

// ---------------------------------------------------------------------
// Respaldo LOCAL de la base de desarrollo (node:sqlite).
// Usa `VACUUM INTO`: SQLite toma una instantánea consistente aunque el
// servidor de desarrollo esté escribiendo (nunca copia el archivo a
// medias, como haría un `cp`). No sustituye a `pnpm db:backup`, que
// exporta D1 en producción.
// ---------------------------------------------------------------------

export function backupLocal(sourcePath: string, destPath: string): void {
  mkdirSync(dirname(destPath), { recursive: true });
  const conn = new DatabaseSync(sourcePath, { readOnly: true });
  try {
    conn.exec("PRAGMA busy_timeout = 3000;");
    // VACUUM INTO exige que el destino NO exista → nombre con timestamp.
    conn.prepare("VACUUM INTO ?").run(destPath);
  } finally {
    conn.close();
  }
}

/** `backups/nalu-local-YYYYMMDD-HHMMSS.db` junto al repositorio. */
function defaultDestPath(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  // backend/data/nalu.db → raíz del repo / backups
  return resolveDbPath(`backups/nalu-local-${stamp}.db`);
}

function main(): void {
  const source = process.argv[2] ? resolveDbPath(process.argv[2]) : DEFAULT_DB_PATH;
  if (!existsSync(source)) {
    console.error(`✗ No existe la base local: ${source}`);
    console.error("  Créala con `pnpm db:migrate` (o `pnpm db:seed` con datos semilla).");
    process.exitCode = 1;
    return;
  }

  const dest = process.argv[3] ? resolveDbPath(process.argv[3]) : defaultDestPath();
  try {
    backupLocal(source, dest);
  } catch (error) {
    console.error(`✗ No se pudo crear el respaldo: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
    return;
  }

  const kb = Math.max(1, Math.round(statSync(dest).size / 1024));
  console.log(`✓ Respaldo local creado: ${dest} (${kb} KB)`);
  console.log(`  Verifícalo con: pnpm db:integrity ${dest}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main();
}
