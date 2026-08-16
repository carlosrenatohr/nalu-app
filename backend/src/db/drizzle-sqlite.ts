import type { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

// ---------------------------------------------------------------------
// Adaptador Drizzle para node:sqlite (desarrollo local / tests).
//
// drizzle-orm/better-sqlite3 espera la API de better-sqlite3, pero
// node:sqlite de Node 24 es compatible. Hacemos un wrapper mínimo
// que adapta la interfaz, incluyendo .raw() y transacciones.
// ---------------------------------------------------------------------

interface WrappedStatement {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): unknown;
  raw(): WrappedStatement;
}

function wrapNodeSqlite(conn: DatabaseSync) {
  function runBegin(behavior: string) {
    const b = behavior === "exclusive" ? "EXCLUSIVE" : behavior === "immediate" ? "IMMEDIATE" : "";
    conn.exec(`BEGIN ${b} TRANSACTION;`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function wrapStatement(stmt: ReturnType<DatabaseSync["prepare"]>): WrappedStatement {
    const wrapped: WrappedStatement = {
      all(...params: any[]) {
        return stmt.all(...params);
      },
      get(...params: any[]) {
        return stmt.get(...params);
      },
      run(...params: any[]) {
        return stmt.run(...params);
      },
      raw() {
        return {
          all(...params: any[]) {
            const rows = stmt.all(...params) as Record<string, unknown>[];
            return rows.map((row) => Object.values(row));
          },
          get(...params: any[]) {
            const row = stmt.get(...params) as Record<string, unknown> | undefined;
            return row ? Object.values(row) : undefined;
          },
          run(...params: any[]) {
            return stmt.run(...params);
          },
          raw() {
            return wrapped;
          },
        };
      },
    };
    return wrapped;
  }

  return {
    prepare(sql: string) {
      return wrapStatement(conn.prepare(sql));
    },
    exec(sql: string) {
      conn.exec(sql);
    },
    transaction<T>(fn: (tx: unknown) => T) {
      return {
        deferred(txFn: unknown): T {
          runBegin("deferred");
          try {
            const result = (fn as (tx: unknown) => T)(txFn);
            conn.exec("COMMIT;");
            return result;
          } catch (error) {
            conn.exec("ROLLBACK;");
            throw error;
          }
        },
        immediate(txFn: unknown): T {
          runBegin("immediate");
          try {
            const result = (fn as (tx: unknown) => T)(txFn);
            conn.exec("COMMIT;");
            return result;
          } catch (error) {
            conn.exec("ROLLBACK;");
            throw error;
          }
        },
        exclusive(txFn: unknown): T {
          runBegin("exclusive");
          try {
            const result = (fn as (tx: unknown) => T)(txFn);
            conn.exec("COMMIT;");
            return result;
          } catch (error) {
            conn.exec("ROLLBACK;");
            throw error;
          }
        },
      };
    },
  };
}

export function createDrizzleSqlite(conn: DatabaseSync) {
  const wrapped = wrapNodeSqlite(conn) as any;
  return drizzle(wrapped, { schema });
}

export type DrizzleSqlite = ReturnType<typeof createDrizzleSqlite>;
