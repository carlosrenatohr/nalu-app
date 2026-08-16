// ---------------------------------------------------------------------
// Error de API estructurado.
// El middleware central de errores lo convierte en:
//   { success: false, error: { code, message, details? } }
// ---------------------------------------------------------------------
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static badRequest(code: string, message: string, details?: unknown): ApiError {
    return new ApiError(400, code, message, details);
  }

  static notFound(message: string): ApiError {
    return new ApiError(404, "NOT_FOUND", message);
  }

  static unauthorized(message: string): ApiError {
    return new ApiError(401, "UNAUTHORIZED", message);
  }

  static conflict(code: string, message: string): ApiError {
    return new ApiError(409, code, message);
  }
}
