import type { NextFunction, Request, Response } from "express";
import type { AuthService } from "../services/auth.service";
import { ApiError } from "../utils/http-error";

// ---------------------------------------------------------------------
// Middleware de autenticación: exige `Authorization: Bearer <token>`.
// El token se valida contra la tabla de sesiones (hash). Las rutas
// públicas (health, login) se registran ANTES de este middleware.
// ---------------------------------------------------------------------

export function requireAuth(auth: AuthService) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      throw ApiError.unauthorized("Inicia sesión para continuar.");
    }
    const businessId = await auth.validateToken(token);
    if (!businessId) {
      throw ApiError.unauthorized("Tu sesión expiró. Inicia sesión de nuevo.");
    }
    next();
  };
}
