import type { NextFunction, Request, Response } from "express";

// ---------------------------------------------------------------------
// Registro de solicitudes (método, ruta, estado, duración).
// Suficiente para desarrollo y observabilidad básica sin dependencias.
// ---------------------------------------------------------------------
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`[api] ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
  });
  next();
}
