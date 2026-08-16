import { rmSync } from "node:fs";
import { DEFAULT_DB_PATH } from "./index";

// ---------------------------------------------------------------------
// Elimina la base de datos local de desarrollo (node:sqlite).
// En producción NUNCA se altera el esquema manualmente: se usan
// migraciones con `wrangler d1 migrations apply`.
// ---------------------------------------------------------------------
function main(): void {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    rmSync(`${DEFAULT_DB_PATH}${suffix}`, { force: true });
  }
  console.log(`✓ Base local eliminada: ${DEFAULT_DB_PATH}`);
}

main();
