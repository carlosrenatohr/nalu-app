import type { ApiErrorBody } from "@/types";

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

  const res = await fetch(`${API_BASE}${path}${query}`, {
    method: options.method ?? "GET",
    headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const json = (await res.json().catch(() => null)) as
    | { success: true; data: T }
    | { success: false; error: ApiErrorBody }
    | null;

  if (!res.ok || !json || !json.success) {
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
