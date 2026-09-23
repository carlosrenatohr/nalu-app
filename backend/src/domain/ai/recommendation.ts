import type { FlavorInventory } from "../types";

// ---------------------------------------------------------------------
// Lógica PURA de la recomendación IA (Jev / System One).
//
// Jev NO es un LLM de texto: evalúa un `state` y devuelve decisiones
// tipadas (choice + probabilities + confidence). Por eso aquí:
//   - se construye el estado en texto plano (Jev solo acepta texto),
//   - se arman las preguntas Choice (sabor + prioridad),
//   - se interpreta la respuesta validada y se compone la razón
//     en español CON los datos reales (Jev no genera texto libre).
// Sin I/O: se testea de forma independiente en tests/domain.
// ---------------------------------------------------------------------

/** Confianza mínima para aceptar la recomendación del modelo. */
export const MIN_CONFIDENCE = 0.3;

/** Opción especial: el modelo decide que no hay datos suficientes. */
export const NONE_OPTION = "ninguno";

export type Priority = "high" | "medium" | "low";

/** Fila ya unificada: inventario actual + ventas de la ventana. */
export interface RecommendationRow {
  flavorId: string;
  name: string;
  emoji: string | null;
  available: number;
  unitsSold: number;
  lowStock: boolean;
}

/** Respuesta tipada de una pregunta Choice de System One. */
export interface ChoiceAnswer {
  choice: string;
  confidence: number;
  probabilities?: Record<string, number>;
}

export interface ChoiceQuestion {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
}

export interface SystemOneQuestions {
  flavor: ChoiceQuestion;
  priority: ChoiceQuestion;
}

export interface ProbabilityEntry {
  id: string;
  name: string;
  emoji: string;
  p: number;
}

export interface RecommendationCore {
  flavor: { id: string; name: string; emoji: string } | null;
  priority: Priority | null;
  reason: string;
  confidence: number;
  probabilities: ProbabilityEntry[];
  insufficientData: boolean;
}

export type InterpretResult =
  | { ok: true; recommendation: RecommendationCore }
  | { ok: false; error: "missing_answers" | "unknown_choice" | "invalid_priority" };

/** Singular/plural sencillo para textos naturales en español. */
function unidades(n: number): string {
  return n === 1 ? "1 unidad" : `${n} unidades`;
}

function paletas(n: number): string {
  return n === 1 ? "1 paleta" : `${n} paletas`;
}

/**
 * Une el inventario actual con las ventas de la ventana.
 * El inventario manda (es la fuente de verdad del stock); las ventas
 * aportan rotación. Un sabor con ventas pero sin fila de inventario
 * también entra (nombre desde la venta, emoji desconocido).
 */
export function mergeInventorySales(
  inventory: FlavorInventory[],
  sales: { flavorId: string; flavorName: string; units: number }[],
  days: number,
): RecommendationRow[] {
  void days; // la ventana ya se aplicó al consultar las ventas
  const byId = new Map<string, RecommendationRow>();

  for (const item of inventory) {
    byId.set(item.flavor.id, {
      flavorId: item.flavor.id,
      name: item.flavor.name,
      emoji: item.flavor.emoji ?? null,
      available: item.available,
      unitsSold: 0,
      lowStock: item.lowStock,
    });
  }

  for (const sale of sales) {
    const existing = byId.get(sale.flavorId);
    if (existing) {
      existing.unitsSold += sale.units;
    } else {
      byId.set(sale.flavorId, {
        flavorId: sale.flavorId,
        name: sale.flavorName,
        emoji: null,
        available: 0,
        unitsSold: sale.units,
        lowStock: true,
      });
    }
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Texto plano con los datos reales (Jev solo acepta texto). */
export function buildState(rows: RecommendationRow[], days: number): string {
  const lines = [
    "Nalu es una app de venta de paletas artesanales.",
    `Datos reales por sabor, ventana de últimos ${days} días [disponible ahora, vendidas en la ventana]:`,
    ...rows.map(
      (r) => `- ${r.name}: ${r.available} disponibles, ${r.unitsSold} vendidas`,
    ),
    "Usa SOLO estos datos: no inventes ventas, inventario ni sabores.",
  ];
  return lines.join("\n");
}

/** Dos preguntas Choice en una sola llamada (se evalúan en paralelo). */
export function buildQuestions(rows: RecommendationRow[], days: number): SystemOneQuestions {
  const criteria: Record<string, string> = {};
  for (const r of rows) {
    criteria[r.flavorId] = `${r.name}: ${r.available} disponibles, ${r.unitsSold} vendidas en los últimos ${days} días`;
  }
  criteria[NONE_OPTION] =
    "Ninguno: los datos no son suficientes para recomendar un sabor con confianza";

  return {
    flavor: {
      type: "choice",
      instructions:
        "¿Qué sabor debería priorizarse para la venta? Considera JUNTO la rotación de ventas recientes y el inventario disponible. " +
        "Si no hay ventas o los datos no alcanzan para recomendar con confianza, elige 'ninguno'.",
      criteria,
    },
    priority: {
      type: "choice",
      instructions:
        "¿Qué tan urgente es priorizar el sabor elegido para la venta?",
      criteria: {
        high: "Alta: rota rápido y conviene asegurar stock o empujar su venta ya",
        medium: "Media: merece atención esta semana pero no es urgente",
        low: "Baja: sin señales fuertes de rotación o escasez",
      },
    },
  };
}

/** Explicación determinista con datos reales (Jev no genera texto). */
export function composeReason(row: RecommendationRow, days: number): string {
  if (row.available === 0) {
    return `Se agotó 🧊: cero disponibles, aunque se vendieron ${unidades(row.unitsSold)} en los últimos ${days} días.`;
  }
  if (row.unitsSold === 0) {
    return `Todavía no vende en los últimos ${days} días, pero quedan ${paletas(row.available)} disponibles para impulsarla.`;
  }
  if (row.lowStock) {
    return `Se va volando 🏃: ${unidades(row.unitsSold)} vendidas en los últimos ${days} días y solo quedan ${paletas(row.available)}.`;
  }
  return `${unidades(row.unitsSold)} vendidas en los últimos ${days} días y quedan ${paletas(row.available)} disponibles.`;
}

/** Mapea las probabilidades del sabor a entradas legibles (más la opción "ninguno"). */
export function mapProbabilities(
  probabilities: Record<string, number> | undefined,
  rows: RecommendationRow[],
): ProbabilityEntry[] {
  if (!probabilities) return [];
  const byId = new Map(rows.map((r) => [r.flavorId, r]));
  const entries: ProbabilityEntry[] = [];
  for (const [key, p] of Object.entries(probabilities)) {
    const row = byId.get(key);
    if (row) {
      entries.push({ id: row.flavorId, name: row.name, emoji: row.emoji ?? "🍦", p });
    } else if (key === NONE_OPTION) {
      entries.push({ id: NONE_OPTION, name: "Sin recomendación", emoji: "🤔", p });
    }
    // claves desconocidas se ignoran (no confiar en la respuesta del modelo)
  }
  return entries.sort((a, b) => b.p - a.p);
}

function insufficient(
  reason: string,
  confidence: number,
  probabilities: ProbabilityEntry[],
): InterpretResult {
  return {
    ok: true,
    recommendation: {
      flavor: null,
      priority: null,
      reason,
      confidence,
      probabilities,
      insufficientData: true,
    },
  };
}

/**
 * Interpreta la respuesta ya validada del modelo.
 * Nunca confía ciegamente: el sabor elegido debe existir en los datos
 * enviados y la prioridad en el enum; si no, se señala como inválida
 * para que la capa de servicio responda con un error controlado.
 */
export function interpretAnswers(
  rows: RecommendationRow[],
  answers: { flavor?: ChoiceAnswer; priority?: ChoiceAnswer },
  days: number,
): InterpretResult {
  const flavorAnswer = answers.flavor;
  const priorityAnswer = answers.priority;
  if (!flavorAnswer || !priorityAnswer) {
    return { ok: false, error: "missing_answers" };
  }

  const confidence = flavorAnswer.confidence;
  const probabilities = mapProbabilities(flavorAnswer.probabilities, rows);

  if (flavorAnswer.choice === NONE_OPTION) {
    return insufficient(
      "Jev no vio datos suficientes para recomendar un sabor con confianza.",
      confidence,
      probabilities,
    );
  }
  if (confidence < MIN_CONFIDENCE) {
    const pct = Math.round(confidence * 100);
    return insufficient(
      `Jev dudó entre varios sabores (confianza ${pct}%), así que mejor usa tu instinto de paletas. 🍦`,
      confidence,
      probabilities,
    );
  }

  const row = rows.find((r) => r.flavorId === flavorAnswer.choice);
  if (!row) return { ok: false, error: "unknown_choice" };

  const priority = priorityAnswer.choice;
  if (priority !== "high" && priority !== "medium" && priority !== "low") {
    return { ok: false, error: "invalid_priority" };
  }

  return {
    ok: true,
    recommendation: {
      flavor: { id: row.flavorId, name: row.name, emoji: row.emoji ?? "🍦" },
      priority,
      reason: composeReason(row, days),
      confidence,
      probabilities,
      insufficientData: false,
    },
  };
}
