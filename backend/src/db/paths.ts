import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BACKEND_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const MIGRATIONS_DIR = join(BACKEND_ROOT, "migrations");

export const DEFAULT_DB_PATH = join(BACKEND_ROOT, "data", "nalu.db");
