import type { DrizzleDb } from "../db/drizzle-types";
import type { FlavorInventory } from "../domain/types";
import {
  buildQuestions,
  buildState,
  interpretAnswers,
  mergeInventorySales,
} from "../domain/ai/recommendation";
import { systemOneResponseSchema } from "../schemas/ai";
import { createReportRepository } from "../repositories/report.repository";
import { createGatewayClient, DEFAULT_GATEWAY_MODEL } from "./ai/gateway-client";
import { createZenClient, type AiClient } from "./ai/zen-client";
import { aiInvalidResponse, aiNotConfigured } from "./ai/errors";
import { addDays, todayISO } from "../utils/dates";

// ---------------------------------------------------------------------
// Recomendación IA de inventario (experimento Jev / System One).
//
// El service orquesta: datos reales → contexto → llamada al modelo →
// validación (Zod + semántica) → respuesta lista para la UI.
// El modelo solo DECIDE (choice + confianza); nunca escribe en la DB
// ni ejecuta acciones. La razón la compone Nalu con datos verificados.
//
// Proveedores (en orden de preferencia):
//   1. cliente inyectado (tests),
//   2. Vercel AI Gateway (clave vck_…) — el preferido en producción,
//      porque OpenCode Zen limita por origen las IPs de Workers,
//   3. OpenCode Zen (respaldo / desarrollo local).
// ---------------------------------------------------------------------

export const DEFAULT_AI_MODEL = "jev-1.13-free";
export const DEFAULT_AI_ENDPOINT = "https://opencode.ai/zen/v1/systemone";
export const DEFAULT_RECOMMENDATION_DAYS = 30;

/** Configuración/inyección del proveedor de IA (inyectable en tests). */
export interface AiOptions {
  client?: AiClient;
  /** Clave del Vercel AI Gateway (prefijo vck_). Preferida en producción. */
  gatewayKey?: string;
  /** Alias del modelo en el gateway (por defecto typesafe-ai/jev). */
  gatewayModel?: string;
  apiKey?: string;
  model?: string;
  endpoint?: string;
}

/**
 * Selecciona el proveedor: cliente inyectado > Gateway > Zen > ninguno.
 * Se exporta para testeares la precedencia sin pegarle a la red.
 */
export function createAiClient(ai?: AiOptions): AiClient | null {
  if (!ai) return null;
  if (ai.client) return ai.client;
  if (ai.gatewayKey) {
    return createGatewayClient({ apiKey: ai.gatewayKey, model: ai.gatewayModel });
  }
  if (ai.apiKey) {
    return createZenClient({
      apiKey: ai.apiKey,
      model: ai.model ?? DEFAULT_AI_MODEL,
      endpoint: ai.endpoint ?? DEFAULT_AI_ENDPOINT,
    });
  }
  return null;
}

/** Nombre del modelo efectivo (logs y respuesta), siguiendo la precedencia. */
export function resolveAiModel(ai?: AiOptions): string {
  if (!ai) return DEFAULT_AI_MODEL;
  if (ai.client) return ai.model ?? DEFAULT_AI_MODEL;
  if (ai.gatewayKey) return ai.gatewayModel ?? DEFAULT_GATEWAY_MODEL;
  return ai.model ?? DEFAULT_AI_MODEL;
}

export interface InventoryRecommendation {
  flavor: { id: string; name: string; emoji: string } | null;
  priority: "high" | "medium" | "low" | null;
  reason: string;
  confidence: number;
  probabilities: { id: string; name: string; emoji: string; p: number }[];
  insufficientData: boolean;
  range: { from: string; to: string; days: number };
  model: string;
}

export function createAiService(deps: {
  db: DrizzleDb;
  getBusinessId: () => Promise<string>;
  getInventory: () => Promise<FlavorInventory[]>;
  ai?: AiOptions;
}) {
  const reportRepo = createReportRepository(deps.db);
  const model = resolveAiModel(deps.ai);
  const client: AiClient | null = createAiClient(deps.ai);

  async function inventoryRecommendation(days: number): Promise<InventoryRecommendation> {
    console.log(`[ai] recomendación de inventario solicitada (días=${days})`);

    const to = todayISO();
    const from = addDays(to, -days);
    const range = { from, to, days };

    // Datos reales: inventario actual + ventas por sabor de la ventana.
    const inventory = await deps.getInventory();
    if (inventory.length === 0) {
      console.log("[ai] sin inventario: respuesta inmediata sin llamar al modelo");
      return {
        flavor: null,
        priority: null,
        reason: "Aún no hay inventario para analizar. Registra tu primera compra y vuelve. 🛒",
        confidence: 0,
        probabilities: [],
        insufficientData: true,
        range,
        model,
      };
    }

    const businessId = await deps.getBusinessId();
    const sales = await reportRepo.salesByFlavor(businessId, from, to);
    const rows = mergeInventorySales(inventory, sales, days);
    const unitsSold = rows.reduce((acc, r) => acc + r.unitsSold, 0);
    console.log(`[ai] datos cargados: ${rows.length} sabores, ${unitsSold} unidades vendidas`);

    if (!client) {
      throw aiNotConfigured();
    }

    const state = buildState(rows, days);
    const questions = buildQuestions(rows, days);
    console.log(`[ai] llamada al modelo (modelo=${model})`);

    const raw = await client.evaluate({ state, questions });
    if (raw.usage) {
      console.log(
        `[ai] respuesta del modelo: uso in=${raw.usage.input_tokens ?? "?"} out=${raw.usage.output_tokens ?? "?"}`,
      );
    }

    // Validación estricta de la forma de la respuesta.
    const parsed = systemOneResponseSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("[ai] respuesta del modelo con forma inválida:", parsed.error.issues);
      throw aiInvalidResponse();
    }

    // Validación semántica: el modelo solo puede elegir opciones que
    // nosotros enviamos; nunca se ejecuta nada derivado de su respuesta.
    const result = interpretAnswers(rows, parsed.data.answers, days);
    if (!result.ok) {
      console.error(`[ai] respuesta del modelo inválida: ${result.error}`);
      throw aiInvalidResponse();
    }

    const rec = result.recommendation;
    console.log(
      `[ai] recomendación validada: flavor=${rec.flavor?.name ?? "ninguno"} priority=${rec.priority ?? "-"} confidence=${rec.confidence}`,
    );

    return { ...rec, range, model: parsed.data.model ?? model };
  }

  return { inventoryRecommendation };
}
