// ---------------------------------------------------------------------
// Tests del cliente Zen (System One / Jev) con fetch simulado.
// Cubren el mapeo de errores del proveedor a errores controlados de la
// API: sin API key, credenciales inválidas, rate limit, proveedor caído,
// timeout y respuesta no-JSON. La API key nunca aparece en mensajes.
// ---------------------------------------------------------------------
import { afterEach, describe, expect, it, vi } from "vitest";
import { createZenClient, type AiEvaluateRequest } from "../../src/services/ai/zen-client";
import { ApiError } from "../../src/utils/http-error";

const API_KEY = "sk-zen-super-secreta-123";

const options = {
  apiKey: API_KEY,
  model: "jev-1.13-free",
  endpoint: "https://opencode.ai/zen/v1/systemone",
  timeoutMs: 1000,
};

const request: AiEvaluateRequest = {
  state: "Oreo: 3 disponibles, 12 vendidas",
  questions: {
    flavor: { type: "choice", instructions: "¿Cuál?", criteria: { a: "A", b: "B" } },
    priority: { type: "choice", instructions: "¿Qué tan urgente?", criteria: { high: "Alta" } },
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Cliente Zen", () => {
  it("éxito: devuelve la respuesta JSON del proveedor", async () => {
    const body = { model: "jev-1.13.0", answers: { flavor: { type: "choice", choice: "a" } } };
    const fetchMock = vi.fn(async () => jsonResponse(body));
    vi.stubGlobal("fetch", fetchMock);

    const client = createZenClient(options);
    const result = await client.evaluate(request);
    expect(result).toEqual(body);

    // La API key viaja SOLO en el header Authorization.
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${API_KEY}`);
    expect(String(init.body)).toContain("jev-1.13-free");
  });

  it("sin API key → 503 sin siquiera llamar a la red", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = createZenClient({ ...options, apiKey: "" });
    await expect(client.evaluate(request)).rejects.toMatchObject({
      statusCode: 503,
      code: "AI_NOT_CONFIGURED",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("401 → credenciales inválidas (503, mensaje seguro)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 401)));
    const client = createZenClient(options);
    const err = await client.evaluate(request).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("AI_NOT_CONFIGURED");
    expect((err as ApiError).message).not.toContain(API_KEY);
  });

  it("429 → rate limit controlado (429)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 429)));
    const client = createZenClient(options);
    await expect(client.evaluate(request)).rejects.toMatchObject({
      statusCode: 429,
      code: "AI_RATE_LIMIT",
    });
  });

  it("5xx del proveedor → no disponible (502)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 500)));
    const client = createZenClient(options);
    await expect(client.evaluate(request)).rejects.toMatchObject({
      statusCode: 502,
      code: "AI_UNAVAILABLE",
    });
  });

  it("error de red → no disponible (502)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("ECONNRESET"))));
    const client = createZenClient(options);
    await expect(client.evaluate(request)).rejects.toMatchObject({
      statusCode: 502,
      code: "AI_UNAVAILABLE",
    });
  });

  it("timeout → 504 controlado", async () => {
    const timeoutErr = new Error("The operation timed out.");
    timeoutErr.name = "TimeoutError";
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(timeoutErr)));
    const client = createZenClient(options);
    await expect(client.evaluate(request)).rejects.toMatchObject({
      statusCode: 504,
      code: "AI_TIMEOUT",
    });
  });

  it("respuesta no-JSON → 502 respuesta inválida", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => Promise.reject(new SyntaxError("Unexpected token <")),
      })),
    );
    const client = createZenClient(options);
    await expect(client.evaluate(request)).rejects.toMatchObject({
      statusCode: 502,
      code: "AI_INVALID_RESPONSE",
    });
  });
});
