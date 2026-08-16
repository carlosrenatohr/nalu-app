// ---------------------------------------------------------------------
// Tipo unificado para la instancia de Drizzle.
// En la práctica, D1 y better-sqlite3 comparten la misma API de queries.
// Usamos un tipo amplio para evitar problemas de sobrecarga entre drivers.
// ---------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DrizzleDb = any;
