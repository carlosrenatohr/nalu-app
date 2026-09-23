// ---------------------------------------------------------------------
// Tests de la lógica PURA de la recomendación IA (Jev / System One):
// contexto, preguntas, interpretación de la respuesta y validaciones.
// Sin red y sin base de datos.
// ---------------------------------------------------------------------
import { describe, expect, it } from "vitest";
import {
  MIN_CONFIDENCE,
  NONE_OPTION,
  buildQuestions,
  buildState,
  composeReason,
  interpretAnswers,
  mapProbabilities,
  mergeInventorySales,
  type RecommendationRow,
} from "../../src/domain/ai/recommendation";
import type { FlavorInventory } from "../../src/domain/types";

const businessId = "10000000-0000-4000-8000-000000000001";

function flavorInv(name: string, available: number, minStock: number): FlavorInventory {
  return {
    flavor: {
      id: `id-${name}`,
      businessId,
      name,
      slug: name.toLowerCase(),
      emoji: "🍦",
      color: null,
      costPrice: null,
      salePrice: null,
      minStock,
      active: true,
      createdAt: "",
      updatedAt: "",
    },
    available,
    lastCost: 28,
    purchased: 10,
    sold: 0,
    gifted: 0,
    personalUse: 0,
    lost: 0,
    adjusted: 0,
    returned: 0,
    value: 0,
    lowStock: available <= minStock,
  };
}

const oreo: RecommendationRow = {
  flavorId: "f-oreo",
  name: "Oreo",
  emoji: "🍪",
  available: 3,
  unitsSold: 12,
  lowStock: true,
};
const coco: RecommendationRow = {
  flavorId: "f-coco",
  name: "Coco",
  emoji: null,
  available: 8,
  unitsSold: 5,
  lowStock: false,
};
const rows: RecommendationRow[] = [oreo, coco];

describe("mergeInventorySales", () => {
  it("une inventario y ventas por id de sabor", () => {
    const merged = mergeInventorySales(
      [flavorInv("Oreo", 3, 5)],
      [{ flavorId: "id-Oreo", flavorName: "Oreo", units: 12 }],
      30,
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ flavorId: "id-Oreo", available: 3, unitsSold: 12 });
  });

  it("incluye sabores con ventas pero sin fila de inventario", () => {
    const merged = mergeInventorySales(
      [flavorInv("Coco", 8, 5)],
      [{ flavorId: "id-Fantasma", flavorName: "Fantasma", units: 4 }],
      30,
    );
    expect(merged).toHaveLength(2);
    const ghost = merged.find((r) => r.name === "Fantasma");
    expect(ghost).toMatchObject({ available: 0, unitsSold: 4, emoji: null, lowStock: true });
  });

  it("inventario sin ventas queda con rotación en cero", () => {
    const merged = mergeInventorySales([flavorInv("Coco", 8, 5)], [], 30);
    expect(merged[0]).toMatchObject({ unitsSold: 0 });
  });
});

describe("buildState / buildQuestions (contexto para Jev)", () => {
  it("describe datos reales en texto y prohíbe inventar", () => {
    const state = buildState(rows, 30);
    expect(state).toContain("Oreo: 3 disponibles, 12 vendidas");
    expect(state).toContain("Coco: 8 disponibles, 5 vendidas");
    expect(state).toContain("30 días");
    expect(state).toContain("no inventes");
  });

  it("arma dos preguntas Choice: sabor (con 'ninguno') y prioridad", () => {
    const questions = buildQuestions(rows, 30);
    expect(questions.flavor.type).toBe("choice");
    expect(Object.keys(questions.flavor.criteria).sort()).toEqual([
      "f-coco",
      "f-oreo",
      NONE_OPTION,
    ]);
    expect(questions.flavor.criteria[NONE_OPTION]).toContain("venta");
    expect(questions.flavor.instructions).toContain("inventario");
    expect(Object.keys(questions.priority.criteria).sort()).toEqual(["high", "low", "medium"]);
    expect(questions.priority.type).toBe("choice");
  });
});

describe("composeReason (la razón la compone Nalu con datos reales)", () => {
  it("baja rotación con poco stock destaca la escasez", () => {
    const reason = composeReason(oreo, 30);
    expect(reason).toContain("12 unidades vendidas");
    expect(reason).toContain("volando");
    expect(reason).toContain("3 paletas");
  });

  it("sin ventas explica que aún no vende", () => {
    const reason = composeReason({ ...coco, unitsSold: 0 }, 30);
    expect(reason).toContain("Todavía no vende");
    expect(reason).toContain("8 paletas");
  });

  it("agotado explica que se quedó sin stock", () => {
    const reason = composeReason({ ...oreo, available: 0, lowStock: true }, 7);
    expect(reason).toContain("Se agotó");
    expect(reason).toContain("7 días");
  });
});

describe("mapProbabilities", () => {
  it("ordena de mayor a menor e ignora claves desconocidas", () => {
    const entries = mapProbabilities(
      { "f-coco": 0.2, "f-oreo": 0.7, [NONE_OPTION]: 0.1, "clave-rara": 0.9 },
      rows,
    );
    expect(entries.map((e) => e.id)).toEqual(["f-oreo", "f-coco", NONE_OPTION]);
    expect(entries[0]?.emoji).toBe("🍪");
    expect(entries.find((e) => e.id === NONE_OPTION)?.name).toBe("Sin recomendación");
  });
});

describe("interpretAnswers (nunca confiar ciegamente en el modelo)", () => {
  const valid = {
    flavor: {
      choice: "f-oreo",
      confidence: 0.9,
      probabilities: { "f-oreo": 0.8, "f-coco": 0.2 },
    },
    priority: { choice: "high", confidence: 0.9, probabilities: { high: 0.9 } },
  };

  it("respuesta válida → recomendación lista para la UI", () => {
    const result = interpretAnswers(rows, valid, 30);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recommendation.flavor).toEqual({ id: "f-oreo", name: "Oreo", emoji: "🍪" });
    expect(result.recommendation.priority).toBe("high");
    expect(result.recommendation.insufficientData).toBe(false);
    expect(result.recommendation.reason.length).toBeGreaterThan(0);
    expect(result.recommendation.confidence).toBe(0.9);
  });

  it("opción 'ninguno' → datos insuficientes sin sabor", () => {
    const result = interpretAnswers(
      rows,
      { ...valid, flavor: { ...valid.flavor, choice: NONE_OPTION } },
      30,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recommendation.flavor).toBeNull();
    expect(result.recommendation.priority).toBeNull();
    expect(result.recommendation.insufficientData).toBe(true);
    expect(result.recommendation.reason).toContain("sabor claro");
  });

  it("'ninguno' sin ninguna venta explica que faltan ventas, no stock", () => {
    const result = interpretAnswers(
      rows.map((r) => ({ ...r, unitsSold: 0 })),
      { ...valid, flavor: { ...valid.flavor, choice: NONE_OPTION } },
      30,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recommendation.flavor).toBeNull();
    expect(result.recommendation.reason).toContain("no hay ventas registradas");
    expect(result.recommendation.reason).toContain("primera venta");
  });

  it("confianza por debajo del umbral → datos insuficientes", () => {
    const result = interpretAnswers(
      rows,
      { ...valid, flavor: { ...valid.flavor, confidence: MIN_CONFIDENCE - 0.01 } },
      30,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recommendation.insufficientData).toBe(true);
    expect(result.recommendation.flavor).toBeNull();
  });

  it("confianza exactamente en el umbral se acepta", () => {
    const result = interpretAnswers(
      rows,
      { ...valid, flavor: { ...valid.flavor, confidence: MIN_CONFIDENCE } },
      30,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recommendation.insufficientData).toBe(false);
  });

  it("sabor elegido que NO enviamos → respuesta inválida", () => {
    const result = interpretAnswers(
      rows,
      { ...valid, flavor: { ...valid.flavor, choice: "sabor-fantasma" } },
      30,
    );
    expect(result).toEqual({ ok: false, error: "unknown_choice" });
  });

  it("prioridad fuera del enum → respuesta inválida", () => {
    const result = interpretAnswers(
      rows,
      { ...valid, priority: { choice: "urgent", confidence: 0.9 } },
      30,
    );
    expect(result).toEqual({ ok: false, error: "invalid_priority" });
  });

  it("pregunta faltante → respuesta inválida", () => {
    const result = interpretAnswers(rows, { flavor: valid.flavor }, 30);
    expect(result).toEqual({ ok: false, error: "missing_answers" });
  });
});
