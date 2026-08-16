import type { DatabaseSync } from "node:sqlite";
import type { BatchStatement, Db, RunResult, SqlValue } from "./types";

// ---------------------------------------------------------------------
// Adaptador para node:sqlite (SQLite nativo de Node 24+).
// Se usa en desarrollo local y en tests (in-memory). Es la MISMA
// interfaz que D1, por lo que repositorios y servicios son idénticos
// en ambos entornos.
// ---------------------------------------------------------------------
export class SqliteDbAdapter implements Db {
  private readonly conn: DatabaseSync;

  constructor(conn: DatabaseSync) {
    this.conn = conn;
    // Las claves foráneas deben activarse por conexión en SQLite.
    this.conn.exec("PRAGMA foreign_keys = ON;");
  }

  all<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    const rows = this.conn.prepare(sql).all(...params) as unknown as T[];
    return Promise.resolve(rows);
  }

  first<T>(sql: string, params: SqlValue[] = []): Promise<T | null> {
    const row = this.conn.prepare(sql).get(...params) as T | undefined;
    return Promise.resolve(row ?? null);
  }

  run(sql: string, params: SqlValue[] = []): Promise<RunResult> {
    const info = this.conn.prepare(sql).run(...params);
    return Promise.resolve({
      changes: Number(info.changes),
      lastRowId: info.lastInsertRowid,
    });
  }

  async batch(statements: BatchStatement[]): Promise<void> {
    this.conn.exec("BEGIN IMMEDIATE;");
    try {
      for (const st of statements) {
        this.conn.prepare(st.sql).run(...st.params);
      }
      this.conn.exec("COMMIT;");
    } catch (error) {
      this.conn.exec("ROLLBACK;");
      throw error;
    }
  }

  async close(): Promise<void> {
    this.conn.close();
  }
}
