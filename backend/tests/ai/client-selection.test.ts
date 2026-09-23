// ---------------------------------------------------------------------
// Selección del proveedor de IA (ai.service): cliente inyectado >
// Vercel AI Gateway > OpenCode Zen > ninguno. Sin red: observamos la
// precedencia por los efectos de cada fábrica (el cliente gateway
// siembra su clave en process.env) y por el modelo efectivo.
// ---------------------------------------------------------------------
import { afterEach, describe, expect, it } from "vitest";
import { createAiClient, resolveAiModel } from "../../src/services/ai.service";
import type { AiClient } from "../../src/services/ai/zen-client";

afterEach(() => {
  delete process.env.AI_GATEWAY_API_KEY;
});

describe("Selección del proveedor de IA", () => {
  it("sin configuración → null (el service responde AI_NOT_CONFIGURED)", () => {
    expect(createAiClient(undefined)).toBeNull();
    expect(createAiClient({})).toBeNull();
  });

  it("solo Zen → cliente Zen con el modelo Zen", () => {
    const client = createAiClient({ apiKey: "zen_key", model: "jev-1.13-free" });
    expect(client).not.toBeNull();
    expect(process.env.AI_GATEWAY_API_KEY).toBeUndefined();
    expect(resolveAiModel({ apiKey: "zen_key", model: "jev-1.13-free" })).toBe("jev-1.13-free");
    // Sin modelo explícito cae al default de Zen.
    expect(resolveAiModel({ apiKey: "zen_key" })).toBe("jev-1.13-free");
  });

  it("gateway + Zen → gana el gateway (incluso con ZEN_MODEL presente)", () => {
    const options = { gatewayKey: "vck_abc", apiKey: "zen_key", model: "jev-1.13-free" };
    const client = createAiClient(options);
    expect(client).not.toBeNull();
    // El cliente gateway siembra su clave en process.env al crearse.
    expect(process.env.AI_GATEWAY_API_KEY).toBe("vck_abc");
    // El modelo efectivo es el alias del gateway, no el de Zen.
    expect(resolveAiModel(options)).toBe("typesafe-ai/jev");
    expect(resolveAiModel({ ...options, gatewayModel: "typesafe-ai/jev-latest" })).toBe(
      "typesafe-ai/jev-latest",
    );
  });

  it("cliente inyectado (tests) gana sobre cualquier proveedor", () => {
    const injected: AiClient = { evaluate: async () => ({ answers: {} }) };
    const options = { client: injected, gatewayKey: "vck_abc", apiKey: "zen_key" };
    expect(createAiClient(options)).toBe(injected);
    // Con cliente inyectado el modelo sigue siendo el default (los tests
    // existentes dependen de este comportamiento).
    expect(resolveAiModel(options)).toBe("jev-1.13-free");
  });
});
