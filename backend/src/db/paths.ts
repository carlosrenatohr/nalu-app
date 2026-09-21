import { join } from "node:path";

// Resolvemos contra el directorio de trabajo (backend/). Todos los comandos
// (dev, migrate, seed, e2e, start) se ejecutan con cwd = backend/, así que
// MIGRATIONS_DIR y DEFAULT_DB_PATH apuntan igual que antes con import.meta.url.
// No se usa en el worker de producción (src/worker.ts no importa paths).
const BACKEND_ROOT = process.cwd();

export const MIGRATIONS_DIR = join(BACKEND_ROOT, "migrations");

export const DEFAULT_DB_PATH = join(BACKEND_ROOT, "data", "nalu.db");
