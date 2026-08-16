import type { ApiErrorBody } from "@/types";
import { getToken, notifyUnauthorized } from "@/lib/offline/session";

// ---------------------------------------------------------------------
// Cliente API tipado. Los componentes NUNCA hardcodean URLs ni llaman
// a fetch directamente: usan los métodos de services/api.
// ---------------------------------------------------------------------

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: ApiErrorBody["details"],
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

const API_BASE = "/api";

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | undefined>;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const query = options.query
    ? `?${new URLSearchParams(
        Object.entries(options.query).filter(([, v]) => v !== undefined) as [string, string][],
      ).toString()}`
    : "";

  // La sesión se adjunta en cada petición (excepto login, que la crea).
  const token = getToken();
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (token && !path.startsWith("/auth/login")) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}${query}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const json = (await res.json().catch(() => null)) as
    | { success: true; data: T }
    | { success: false; error: ApiErrorBody }
    | null;

  if (!res.ok || !json || !json.success) {
    // Sesión expirada/inválida: cerramos sesión en toda la app.
    if (res.status === 401 && !path.startsWith("/auth/login")) {
      notifyUnauthorized();
    }
    const error = json && !json.success ? json.error : null;
    throw new ApiClientError(
      error?.code ?? "NETWORK_ERROR",
      error?.message ?? "No se pudo conectar con el servidor.",
      error?.details,
      res.status,
    );
  }
  return json.data;
}
