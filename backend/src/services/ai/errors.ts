import { ApiError } from "../../utils/http-error";

// ---------------------------------------------------------------------
// Errores controlados compartidos por los proveedores de IA (OpenCode
// Zen y Vercel AI Gateway). Centralizamos código + mensaje en español
// para que la UI vea el MISMO contrato sin importar el proveedor.
// ---------------------------------------------------------------------

export function aiNotConfigured(authProblem = false): ApiError {
  return new ApiError(
    503,
    "AI_NOT_CONFIGURED",
    authProblem
      ? "La recomendación con IA no está configurada correctamente en este servidor."
      : "La recomendación con IA no está configurada en este servidor.",
  );
}

export function aiRateLimit(): ApiError {
  return new ApiError(
    429,
    "AI_RATE_LIMIT",
    "El servicio de IA recibió demasiadas solicitudes. Intenta en unos minutos.",
  );
}

export function aiTimeout(): ApiError {
  return new ApiError(
    504,
    "AI_TIMEOUT",
    "El servicio de IA tardó demasiado en responder. Intenta nuevamente.",
  );
}

export function aiUnavailable(): ApiError {
  return new ApiError(
    502,
    "AI_UNAVAILABLE",
    "El servicio de IA no está disponible en este momento. Intenta más tarde.",
  );
}

export function aiInvalidResponse(): ApiError {
  return new ApiError(
    502,
    "AI_INVALID_RESPONSE",
    "La respuesta del servicio de IA no es válida. Intenta nuevamente.",
  );
}
