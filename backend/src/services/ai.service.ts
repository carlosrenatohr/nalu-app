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
import { createZenClient, type AiClient } from "./ai/zen-client";
import { ApiError } from "../utils/http-error";
import { addDays, todayISO } from "../utils/dates";

// ---------------------------------------------------------------------
// Recomendación IA de inventario (experimento Jev / System One).
//
// El service orquesta: datos reales → contexto → llamada al modelo →
// validación (Zod + semántica) → respuesta lista para la UI.
// El modelo solo DECIDE (choice + confianza); nunca escribe en la DB
// ni ejecuta acciones. La razón la compone Nalu con datos verificados.
// ---------------------------------------------------------------------

export const DEFAULT_AI_MODEL = "jev-1.13-free";
export const DEFAULT_AI_ENDPOINT = "https://opencode.ai/zen/v1/systemone";
export const DEFAULT_RECOMMENDATION_DAYS = 30;

/** Configuración/inyección del proveedor de IA (inyectable en tests). */
export interface AiOptions {
  client?: AiClient;
  apiKey?: string;
  model?: string;
  endpoint?: string;
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
  const model = deps.ai?.model ?? DEFAULT_AI_MODEL;
  const client: AiClient | null =
    deps.ai?.client ??
    (deps.ai?.apiKey
      ? createZenClient({
          apiKey: deps.ai.apiKey,
          model,
          endpoint: deps.ai.endpoint ?? DEFAULT_AI_ENDPOINT,
        })
      : null);

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
    console.log(`[ai] datos cargidos: ${rows.length} sabores, ${unitsSold} unidades vendidas`);

    if (!client) {
      throw new ApiError(
        503,
        "AI_NOT_CONFIGURED",
        "La recomendación con IA no está configurada en este servidor.",
      );
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
      throw new ApiError(
        502,
        "AI_INVALID_RESPONSE",
        "La respuesta del servicio de IA no es válida. Intenta nuevamente.",
      );
    }

    // Validación semántica: el modelo solo puede elegir opciones que
    // nosotros enviamos; nunca se ejecuta nada derivado de su respuesta.
    const result = interpretAnswers(rows, parsed.data.answers, days);
    if (!result.ok) {
      console.error(`[ai] respuesta del modelo inválida: ${result.error}`);
      throw new ApiError(
        502,
        "AI_INVALID_RESPONSE",
        "La respuesta del servicio de IA no es válida. Intenta nuevamente.",
      );
    }

    const rec = result.recommendation;
    console.log(
      `[ai] recomendación validada: flavor=${rec.flavor?.name ?? "ninguno"} priority=${rec.priority ?? "-"} confidence=${rec.confidence}`,
    );

    return { ...rec, range, model: parsed.data.model ?? model };
  }

  return { inventoryRecommendation };
}
