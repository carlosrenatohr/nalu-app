import { existsSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

// Resolvemos contra el directorio de trabajo (backend/). Todos los comandos
// (dev, migrate, seed, e2e, start) se ejecutan con cwd = backend/, así que
// MIGRATIONS_DIR y DEFAULT_DB_PATH apuntan igual que antes con import.meta.url.
// No se usa en el worker de producción (src/worker.ts no importa paths).
const BACKEND_ROOT = process.cwd();

export const MIGRATIONS_DIR = join(BACKEND_ROOT, "migrations");

export const DEFAULT_DB_PATH = join(BACKEND_ROOT, "data", "nalu.db");

/** Raíz del monorepo (los comandos se invocan normalmente desde ahí). */
export const REPO_ROOT = resolve(BACKEND_ROOT, "..");

/**
 * Resuelve una ruta indicada por el usuario en un script CLI.
 * Las rutas relativas se prueban contra backend/ y contra la raíz del
 * repositorio (pnpm --filter ejecuta el script con cwd = backend/, así que
 * `pnpm db:integrity backups/x.db` debe resolverse desde la raíz).
 * Si no existe en ningún sitio, se devuelve relativa a la raíz del repo.
 */
export function resolveDbPath(raw: string): string {
  if (isAbsolute(raw)) return raw;
  const fromBackend = join(BACKEND_ROOT, raw);
  if (existsSync(fromBackend)) return fromBackend;
  // Si no existe en backend/ (o aún no existe: destino de un respaldo),
  // se resuelve contra la raíz del repo, donde se invoca `pnpm`.
  return join(REPO_ROOT, raw);
}
