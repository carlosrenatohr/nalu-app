// ---------------------------------------------------------------------
// Interfaz de base de datos compartida.
//
// Nalu corre sobre Cloudflare D1 en producción y sobre node:sqlite
// (SQLite nativo de Node) en desarrollo local y tests. Esta interfaz
// permite que repositorios y servicios escriban UNA sola vez contra una
// API mínima y común a ambos motores:
//
//   all()    → varias filas
//   first()  → una fila o null
//   run()    → ejecución sin filas (INSERT/UPDATE/DELETE)
//   batch()  → conjunto de sentencias atómicas (transacción)
//
// Decisión: los repositorios siempre trabajan con sentencias preparadas
// y parámetros posicionales (?) para evitar inyección SQL.
// ---------------------------------------------------------------------

export type SqlValue = string | number | null;

export interface BatchStatement {
  sql: string;
  params: SqlValue[];
}

export interface RunResult {
  changes: number;
  lastRowId: string | number | bigint | null;
}

export interface Db {
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  first<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  run(sql: string, params?: SqlValue[]): Promise<RunResult>;
  /** Ejecuta varias sentencias de forma atómica (todo o nada). */
  batch(statements: BatchStatement[]): Promise<void>;
  close(): Promise<void>;
}
