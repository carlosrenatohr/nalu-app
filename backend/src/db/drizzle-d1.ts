import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

// ---------------------------------------------------------------------
// Adaptador Drizzle para Cloudflare D1 (producción / wrangler dev).
// ---------------------------------------------------------------------
export function createDrizzleD1(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type DrizzleD1 = ReturnType<typeof createDrizzleD1>;
