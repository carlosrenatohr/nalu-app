import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiError } from "../utils/http-error";
import { zodErrorToSpanish, zodIssuesToDetails } from "../utils/zod";

// ---------------------------------------------------------------------
// Contrato de error centralizado:
//   { success: false, error: { code, message, details? } }
// Ningún controlador duplica este manejo.
// ---------------------------------------------------------------------
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Errores controlados de la aplicación
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Validación con Zod (p.ej. query params que fallan en el router)
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: zodErrorToSpanish(err),
        details: zodIssuesToDetails(err),
      },
    });
    return;
  }

  // JSON malformado en el body
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({
      success: false,
      error: { code: "INVALID_JSON", message: "El cuerpo de la solicitud no es JSON válido." },
    });
    return;
  }

  // Violación de unicidad (p.ej. slug duplicado)
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("UNIQUE constraint failed")) {
    res.status(409).json({
      success: false,
      error: { code: "DUPLICATE", message: "Ya existe un registro con esos datos." },
    });
    return;
  }

  // Error inesperado: se registra pero nunca se exponen detalles internos
  console.error(`[error] ${req.method} ${req.path}`, err);
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "Ocurrió un error inesperado. Inténtalo de nuevo.",
    },
  });
}
