// ---------------------------------------------------------------------
// Tests del cliente Gateway (Jev vía Vercel AI Gateway) con el AI SDK
// simulado. Cubren: mapeo de la respuesta (confianza por pregunta en
// providerMetadata y uso en snake_case) y el mapeo de errores del
// gateway a los mismos códigos controlados del cliente Zen. La clave
// del gateway JAMÁS aparece en mensajes ni en la respuesta.
// ---------------------------------------------------------------------
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("ai", () => ({ experimental_evaluate: vi.fn() }));

import { experimental_evaluate } from "ai";
import {
  createGatewayClient,
  DEFAULT_GATEWAY_MODEL,
} from "../../src/services/ai/gateway-client";
import type { AiEvaluateRequest } from "../../src/services/ai/zen-client";

const evaluateMock = experimental_evaluate as unknown as Mock;

const API_KEY = "vck_test_123";

const request: AiEvaluateRequest = {
  state: "Oreo: 3 disponibles, 12 vendidas",
  questions: {
    flavor: { type: "choice", instructions: "¿Cuál?", criteria: { a: "A", b: "B" } },
    priority: { type: "choice", instructions: "¿Qué tan urgente?", criteria: { high: "Alta" } },
  },
};

function successResult() {
  return {
    answers: {
      flavor: { type: "choice", choice: "a", probabilities: { a: 0.7, b: 0.3 } },
      priority: { type: "choice", choice: "high", probabilities: { high: 0.8 } },
    },
    providerMetadata: {
      typesafe: { confidence: { flavor: 0.61, priority: 0.44 } },
    } as { typesafe?: { confidence?: Record<string, number> } },
    usage: { inputTokens: 500, outputTokens: 5 },
  };
}

function errorWithStatus(status: number): Error {
  const err = new Error(`HTTP ${status}`);
  (err as Error & { statusCode?: number }).statusCode = status;
  return err;
}

beforeEach(() => {
  evaluateMock.mockReset();
});

afterEach(() => {
  delete process.env.AI_GATEWAY_API_KEY;
});

describe("Cliente Gateway (Vercel AI Gateway)", () => {
  it("éxito: mapea answers (confianza por pregunta) y usage a snake_case", async () => {
    evaluateMock.mockResolvedValue(successResult());
    const client = createGatewayClient({ apiKey: API_KEY });

    const res = await client.evaluate(request);

    expect(res.model).toBe(DEFAULT_GATEWAY_MODEL);
    expect(res.answers.flavor).toEqual({
      type: "choice",
      choice: "a",
      confidence: 0.61,
      probabilities: { a: 0.7, b: 0.3 },
    });
    expect(res.usage).toEqual({ input_tokens: 500, output_tokens: 5 });
    expect(res.answers.priority?.confidence).toBe(0.44);

    // La clave viaja SOLO vía process.env: nunca en el payload.
    expect(process.env.AI_GATEWAY_API_KEY).toBe(API_KEY);
    const [options] = evaluateMock.mock.calls[0] as unknown as [
      {
        model: string;
        state: string;
        questions: unknown;
        maxRetries: number;
        providerOptions: unknown;
      },
    ];
    expect(options.model).toBe(DEFAULT_GATEWAY_MODEL);
    expect(options.state).toBe(request.state);
    expect(options.questions).toBe(request.questions);
    expect(options.maxRetries).toBe(0);
    expect(options.providerOptions).toEqual({ gateway: { zeroDataRetention: true } });
  });

  it("sin confidence del proveedor → usa la probabilidad elegida", async () => {
    const result = successResult();
    delete result.providerMetadata.typesafe;
    evaluateMock.mockResolvedValue(result);
    const client = createGatewayClient({ apiKey: API_KEY });

    const res = await client.evaluate(request);

    expect(res.answers.flavor?.confidence).toBe(0.7); // probabilities.a
    expect(res.answers.priority?.confidence).toBe(0.8);
  });

  it("sin clave → 503 sin siquiera llamar al SDK", async () => {
    const client = createGatewayClient({ apiKey: "" });
    await expect(client.evaluate(request)).rejects.toMatchObject({
      statusCode: 503,
      code: "AI_NOT_CONFIGURED",
    });
    expect(evaluateMock).not.toHaveBeenCalled();
  });

  it("429 → rate limit controlado (429)", async () => {
    evaluateMock.mockRejectedValue(errorWithStatus(429));
    const client = createGatewayClient({ apiKey: API_KEY });
    await expect(client.evaluate(request)).rejects.toMatchObject({
      statusCode: 429,
      code: "AI_RATE_LIMIT",
    });
  });

  it("401 → credenciales inválidas (503, mensaje seguro sin la clave)", async () => {
    evaluateMock.mockRejectedValue(errorWithStatus(401));
    const client = createGatewayClient({ apiKey: API_KEY });
    const err = await client.evaluate(request).catch((e: unknown) => e);
    expect(err).toMatchObject({ statusCode: 503, code: "AI_NOT_CONFIGURED" });
    expect((err as Error).message).not.toContain(API_KEY);
  });

  it("5xx del gateway → no disponible (502)", async () => {
    evaluateMock.mockRejectedValue(errorWithStatus(500));
    const client = createGatewayClient({ apiKey: API_KEY });
    await expect(client.evaluate(request)).rejects.toMatchObject({
      statusCode: 502,
      code: "AI_UNAVAILABLE",
    });
  });

  it("400 (solicitud inválida) → no disponible (502)", async () => {
    evaluateMock.mockRejectedValue(errorWithStatus(400));
    const client = createGatewayClient({ apiKey: API_KEY });
    await expect(client.evaluate(request)).rejects.toMatchObject({
      statusCode: 502,
      code: "AI_UNAVAILABLE",
    });
  });

  it("clave ausente en el entorno del SDK → no configurado (503)", async () => {
    evaluateMock.mockRejectedValue(new Error("AI_GATEWAY_API_KEY is missing"));
    const client = createGatewayClient({ apiKey: API_KEY });
    await expect(client.evaluate(request)).rejects.toMatchObject({
      statusCode: 503,
      code: "AI_NOT_CONFIGURED",
    });
  });

  it("timeout → 504 controlado", async () => {
    const timeoutErr = new Error("The operation timed out.");
    timeoutErr.name = "TimeoutError";
    evaluateMock.mockRejectedValue(timeoutErr);
    const client = createGatewayClient({ apiKey: API_KEY });
    await expect(client.evaluate(request)).rejects.toMatchObject({
      statusCode: 504,
      code: "AI_TIMEOUT",
    });
  });

  it("error de red del SDK → no disponible (502)", async () => {
    evaluateMock.mockRejectedValue(new Error("fetch failed"));
    const client = createGatewayClient({ apiKey: API_KEY });
    await expect(client.evaluate(request)).rejects.toMatchObject({
      statusCode: 502,
      code: "AI_UNAVAILABLE",
    });
  });

  it("respuesta sin probabilities → 502 respuesta inválida", async () => {
    const result = successResult();
    const flavor = result.answers.flavor as { probabilities?: Record<string, number> };
    flavor.probabilities = undefined;
    evaluateMock.mockResolvedValue(result);
    const client = createGatewayClient({ apiKey: API_KEY });
    await expect(client.evaluate(request)).rejects.toMatchObject({
      statusCode: 502,
      code: "AI_INVALID_RESPONSE",
    });
  });
});
