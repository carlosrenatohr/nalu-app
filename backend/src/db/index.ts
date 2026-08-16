import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { SqliteDbAdapter } from "./sqlite-adapter";
import { applyMigrations } from "./migrate";
import { seedDatabase } from "./seed";
import type { Db } from "./types";

export const DEFAULT_DB_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "data",
  "nalu.db",
);

export interface OpenDbResult {
  db: Db;
  conn: DatabaseSync;
}

/** Abre (o crea) la base local, aplicando las migraciones pendientes. */
export function openLocalDb(path: string = DEFAULT_DB_PATH): OpenDbResult {
  mkdirSync(dirname(path), { recursive: true });
  const conn = new DatabaseSync(path);
  conn.exec("PRAGMA foreign_keys = ON;");
  applyMigrations(conn);
  return { db: new SqliteDbAdapter(conn), conn };
}

/** Base en memoria para tests: migraciones y, opcionalmente, datos semilla. */
export function createMemoryDb(withSeed: boolean = true): OpenDbResult {
  const conn = new DatabaseSync(":memory:");
  conn.exec("PRAGMA foreign_keys = ON;");
  applyMigrations(conn);
  if (withSeed) {
    seedDatabase(conn);
  }
  return { db: new SqliteDbAdapter(conn), conn };
}
