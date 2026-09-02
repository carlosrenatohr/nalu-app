import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

// ---------------------------------------------------------------------
// Adaptador Drizzle para Cloudflare D1 (producción / wrangler dev).
//
// SQLiteD1Session ya maneja transacciones con BEGIN/COMMIT/ROLLBACK
// vía this.run(), así que no necesitamos hackear el adapter.
// ---------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDrizzleD1(d1: D1Database): any {
  return drizzle(d1, { schema });
}
