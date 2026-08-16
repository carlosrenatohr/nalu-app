import type { BatchStatement, Db, RunResult, SqlValue } from "./types";

// ---------------------------------------------------------------------
// Tipos mínimos del binding D1.
// Se declaran localmente para no incluir @cloudflare/workers-types de
// forma global (sus tipos globales de fetch/Request chocan con
// @types/node). worker.ts, por su parte, usa los tipos generados por
// `wrangler types`.
// ---------------------------------------------------------------------
interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: { changes: number; last_row_id?: number | null };
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<D1Result<T>>;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<D1Result>;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}

// ---------------------------------------------------------------------
// Adaptador para Cloudflare D1 (producción / wrangler dev).
// D1 es asíncrono; cada método envuelve el binding nativo.
// ---------------------------------------------------------------------
export class D1DbAdapter implements Db {
  constructor(private readonly db: D1Database) {}

  async all<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    const { results } = await this.db.prepare(sql).bind(...params).all<T>();
    return results;
  }

  async first<T>(sql: string, params: SqlValue[] = []): Promise<T | null> {
    const row = await this.db.prepare(sql).bind(...params).first<T>();
    return row ?? null;
  }

  async run(sql: string, params: SqlValue[] = []): Promise<RunResult> {
    const result = await this.db.prepare(sql).bind(...params).run();
    return {
      changes: result.meta.changes,
      lastRowId: result.meta.last_row_id ?? null,
    };
  }

  async batch(statements: BatchStatement[]): Promise<void> {
    // D1 ejecuta el lote como una sola transacción: todo o nada.
    await this.db.batch(
      statements.map((s) => this.db.prepare(s.sql).bind(...s.params)),
    );
  }

  async close(): Promise<void> {
    // D1 no requiere cerrar la conexión.
  }
}
