import type { Request } from "express";

/** Lee un parámetro de ruta como string (los tipos de Express 5 pueden ser string | string[]). */
export function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
