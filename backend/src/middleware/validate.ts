import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { ApiError } from "../utils/http-error";
import { zodErrorToSpanish, zodIssuesToDetails } from "../utils/zod";

// ---------------------------------------------------------------------
// Middleware de validación con Zod.
// Valida req.body y guarda el resultado en res.locals.parsed; el
// controlador usa SIEMPRE el dato validado, nunca req.body crudo.
// ---------------------------------------------------------------------
export function validate<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        zodErrorToSpanish(result.error),
        zodIssuesToDetails(result.error),
      );
    }
    res.locals.parsed = result.data;
    next();
  };
}

/** Obtiene el dato validado por el middleware `validate`. */
export function parsed<T>(res: Response): T {
  return res.locals.parsed as T;
}

/**
 * Middleware de validación de query params (p.ej. rangos de fecha).
 * Guarda el resultado en res.locals.parsedQuery.
 */
export function validateQuery<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        zodErrorToSpanish(result.error),
        zodIssuesToDetails(result.error),
      );
    }
    res.locals.parsedQuery = result.data;
    next();
  };
}

/** Obtiene los query params validados por `validateQuery`. */
export function parsedQuery<T>(res: Response): T {
  return res.locals.parsedQuery as T;
}
