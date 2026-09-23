import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../../src/app";
import { createMemoryDb } from "../../src/db";
import { resolveBusinessId } from "../../src/config/bootstrap";
import type {
  AiClient,
  AiEvaluateRequest,
  AiEvaluateResponse,
} from "../../src/services/ai/zen-client";
import { ApiError } from "../../src/utils/http-error";

// ---------------------------------------------------------------------
// Tests de integración de POST /api/ai/inventory-recommendation.
// El proveedor IA se inyecta simulado (nunca se llama a la red).
// ---------------------------------------------------------------------

const MARACUMANGO = "20000000-0000-4000-8000-000000000005";
const COCO = "20000000-0000-4000-8000-000000000001";
const FLAVOR_IDS = [
  "20000000-0000-4000-8000-000000000001",
  "20000000-0000-4000-8000-000000000002",
  "20000000-0000-4000-8000-000000000003",
  "20000000-0000-4000-8000-000000000004",
  "20000000-0000-4000-8000-000000000005",
  "20000000-0000-4000-8000-000000000006",
];
const DEFAULT_PIN = "1234";

let app: Express;
let token = "";

/** Cliente IA simulado: captura las peticiones y responde lo que se le indique. */
function makeClient(response: Partial<AiEvaluateResponse> = {}) {
  const requests: AiEvaluateRequest[] = [];
  const base: AiEvaluateResponse = {
    model: "jev-1.13.0",
    answers: {
      flavor: {
        type: "choice",
        choice: MARACUMANGO,
        confidence: 0.9,
        probabilities: { [MARACUMANGO]: 0.7, [COCO]: 0.2, ninguno: 0.1 },
      },
      priority: {
        type: "choice",
        choice: "high",
        confidence: 0.9,
        probabilities: { high: 0.9, medium: 0.1, low: 0 },
      },
    },
    usage: { input_tokens: 120, output_tokens: 40 },
    ...response,
  };
  const client: AiClient = {
    evaluate: async (req) => {
      requests.push(req);
      return base;
    },
  };
  return { client, requests };
}

async function login(): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ pin: DEFAULT_PIN });
  expect(res.status).toBe(200);
  return res.body.data.token as string;
}

function api(verb: "post", url: string) {
  const req = request(app)[verb](url);
  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

/** App con el cliente IA inyectado (o sin configuración, para el 503). */
async function setupApp(ai?: { client: AiClient } | Record<string, never>) {
  const { db, conn } = createMemoryDb(true);
  const businessId = await resolveBusinessId(db);
  app = createApp({ db, getBusinessId: async () => businessId, ...(ai ? { ai } : {}) });
  token = await login();
  return conn;
}

beforeEach(async () => {
  await setupApp();
});

describe("POST /api/ai/inventory-recommendation", () => {
  it("éxito: devuelve la estructura exacta que renderiza la UI", async () => {
    const { client, requests } = makeClient();
    await setupApp({ client });

    const res = await api("post", "/api/ai/inventory-recommendation");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.flavor).toEqual({ id: MARACUMANGO, name: "Maracumango", emoji: expect.any(String) });
    expect(data.priority).toBe("high");
    expect(typeof data.reason).toBe("string");
    expect(data.reason.length).toBeGreaterThan(0);
    expect(data.confidence).toBe(0.9);
    expect(data.insufficientData).toBe(false);
    expect(data.range.days).toBe(30);
    expect(data.range.from <= data.range.to).toBe(true);
    expect(data.model).toBe("jev-1.13.0");
    // Probabilidades ordenadas de mayor a menor (la demo de Jev).
    expect(data.probabilities[0].id).toBe(MARACUMANGO);
    expect(data.probabilities.map((p: { p: number }) => p.p)).toEqual([0.7, 0.2, 0.1]);

    // El modelo recibió datos REALES de la semilla (no valores hardcodeados).
    expect(requests).toHaveLength(1);
    const sent = requests[0] ?? null;
    expect(sent).not.toBeNull();
    if (!sent) return;
    expect(sent.state).toContain("Maracumango:");
    expect(sent.state).toContain("vendidas");
    expect(sent.state).toContain("30 días");
    expect(sent.questions.flavor.type).toBe("choice");
    expect(Object.keys(sent.questions.flavor.criteria)).toHaveLength(FLAVOR_IDS.length + 1);
    expect(sent.questions.flavor.criteria).toHaveProperty("ninguno");
    expect(Object.keys(sent.questions.priority.criteria).sort()).toEqual([
      "high",
      "low",
      "medium",
    ]);
  });

  it("permite cambiar la ventana de días (la demo se puede jugar)", async () => {
    const { client, requests } = makeClient();
    await setupApp({ client });

    const res = await api("post", "/api/ai/inventory-recommendation?days=7");
    expect(res.status).toBe(200);
    expect(res.body.data.range.days).toBe(7);
    const sent = requests[0] ?? null;
    expect(sent).not.toBeNull();
    if (sent) expect(sent.state).toContain("7 días");
  });

  it("rechaza days inválidos con el contrato de error en español", async () => {
    const zero = await api("post", "/api/ai/inventory-recommendation?days=0");
    expect(zero.status).toBe(400);
    expect(zero.body.error.code).toBe("VALIDATION_ERROR");

    const text = await api("post", "/api/ai/inventory-recommendation?days=abc");
    expect(text.status).toBe(400);
  });

  it("respuesta del modelo con forma inválida → 502 controlado", async () => {
    const { client } = makeClient({ answers: {} as never });
    await setupApp({ client });

    const res = await api("post", "/api/ai/inventory-recommendation");
    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("AI_INVALID_RESPONSE");
    expect(typeof res.body.error.message).toBe("string");
    expect(JSON.stringify(res.body)).not.toContain("stack");
  });

  it("el modelo elige un sabor que NO le enviamos → 502 controlado", async () => {
    const { client } = makeClient({
      answers: {
        flavor: {
          type: "choice",
          choice: "sabor-fantasma",
          confidence: 0.99,
          probabilities: {},
        },
        priority: { type: "choice", choice: "high", confidence: 0.9, probabilities: {} },
      },
    });
    await setupApp({ client });

    const res = await api("post", "/api/ai/inventory-recommendation");
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("AI_INVALID_RESPONSE");
  });

  it("confianza baja → recomendación marcada como datos insuficientes", async () => {
    const { client } = makeClient({
      answers: {
        flavor: {
          type: "choice",
          choice: MARACUMANGO,
          confidence: 0.1,
          probabilities: { [MARACUMANGO]: 0.4, [COCO]: 0.35, ninguno: 0.25 },
        },
        priority: { type: "choice", choice: "high", confidence: 0.2, probabilities: {} },
      },
    });
    await setupApp({ client });

    const res = await api("post", "/api/ai/inventory-recommendation");
    expect(res.status).toBe(200);
    expect(res.body.data.flavor).toBeNull();
    expect(res.body.data.priority).toBeNull();
    expect(res.body.data.insufficientData).toBe(true);
    expect(res.body.data.reason).toContain("confianza");
    // Las probabilidades de la demo siguen llegando a la UI.
    expect(res.body.data.probabilities.length).toBeGreaterThan(0);
  });

  it("si Jev responde 'ninguno' → datos insuficientes", async () => {
    const { client } = makeClient({
      answers: {
        flavor: {
          type: "choice",
          choice: "ninguno",
          confidence: 0.95,
          probabilities: { ninguno: 0.95 },
        },
        priority: { type: "choice", choice: "low", confidence: 0.9, probabilities: {} },
      },
    });
    await setupApp({ client });

    const res = await api("post", "/api/ai/inventory-recommendation");
    expect(res.status).toBe(200);
    expect(res.body.data.flavor).toBeNull();
    expect(res.body.data.insufficientData).toBe(true);
  });

  it("proveedor caído → 502 con mensaje seguro en español", async () => {
    const client: AiClient = {
      evaluate: async () => {
        throw new ApiError(502, "AI_UNAVAILABLE", "El servicio de IA no está disponible en este momento. Intenta más tarde.");
      },
    };
    await setupApp({ client });

    const res = await api("post", "/api/ai/inventory-recommendation");
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("AI_UNAVAILABLE");
    expect(res.body.error.message).not.toContain("http");
  });

  it("sin API key configurada → 503 AI_NOT_CONFIGURED (la app no rompe)", async () => {
    await setupApp(); // createApp sin opciones de IA

    const res = await api("post", "/api/ai/inventory-recommendation");
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("AI_NOT_CONFIGURED");
    expect(res.body.error.message.length).toBeGreaterThan(0);
  });

  it("sin sabores registrados → respuesta amigable SIN llamar al modelo", async () => {
    const { client, requests } = makeClient();
    const conn = await setupApp({ client });
    conn.exec(
      "DELETE FROM sale_items; DELETE FROM purchase_items; DELETE FROM inventory_movements; DELETE FROM flavors;",
    );

    const res = await api("post", "/api/ai/inventory-recommendation");
    expect(res.status).toBe(200);
    expect(res.body.data.flavor).toBeNull();
    expect(res.body.data.insufficientData).toBe(true);
    expect(res.body.data.reason).toContain("compra");
    expect(requests).toHaveLength(0);
  });

  it("sin ventas → el modelo ve rotación cero (no se inventan datos)", async () => {
    const { client, requests } = makeClient();
    const conn = await setupApp({ client });
    conn.exec("DELETE FROM sale_items; DELETE FROM sales;");

    const res = await api("post", "/api/ai/inventory-recommendation");
    expect(res.status).toBe(200);
    expect(requests).toHaveLength(1);
    const sent = requests[0] ?? null;
    expect(sent).not.toBeNull();
    if (!sent) return;
    expect(sent.state).toContain("0 vendidas");
    // El inventario real sigue presente.
    expect(sent.state).toContain("Maracumango:");
  });

  it("requiere sesión (igual que el resto de la API)", async () => {
    const res = await request(app).post("/api/ai/inventory-recommendation");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });
});
