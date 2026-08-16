import { randomUUID } from "node:crypto";

/**
 * Genera un UUID v4. Los IDs los genera la aplicación (no la base de
 * datos) para permitir lotes atómicos multi-tabla en D1 y la
 * sincronización offline con deduplicación por clave primaria.
 */
export function newId(): string {
  return randomUUID();
}
