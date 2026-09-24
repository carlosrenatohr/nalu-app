import { beforeEach, describe, expect, it } from "vitest";
import {
  FONDOS,
  FRASES_MOTIVACIONALES,
  INDICE_FRASE_KEY,
  INDICE_FONDO_KEY,
  PLATAFORMA_URL,
  computeShares,
  currentRotation,
  generarQrSvg,
  nextRotation,
} from "./shareContent";

// ---------------------------------------------------------------------
// Contenido de la ficha: pool de frases, fondos rotativos, QR client-side
// y el cálculo de % sobre unidades vendidas del rango.
// ---------------------------------------------------------------------

describe("frases y fondos", () => {
  it("hay al menos 20 frases motivacionales, únicas y no vacías", () => {
    expect(FRASES_MOTIVACIONALES.length).toBeGreaterThanOrEqual(20);
    expect(new Set(FRASES_MOTIVACIONALES).size).toBe(FRASES_MOTIVACIONALES.length);
    for (const frase of FRASES_MOTIVACIONALES) expect(frase.trim().length).toBeGreaterThan(0);
  });

  it("hay al menos 8 fondos únicos con clases Tailwind literales", () => {
    expect(FONDOS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(FONDOS).size).toBe(FONDOS.length);
    for (const fondo of FONDOS) expect(fondo).toContain("gradient");
  });

  it("el QR apunta a la raíz de la plataforma", () => {
    expect(PLATAFORMA_URL).toBe("https://nalu-api.nativerse.workers.dev/");
  });
});

describe("rotación: frase y fondo distintos por generación", () => {
  beforeEach(() => localStorage.clear());

  it("cada generación avanza sin repetir hasta cerrar el ciclo", () => {
    const vistos: number[] = [];
    for (let i = 0; i < 8; i += 1) vistos.push(nextRotation(INDICE_FRASE_KEY, 8));
    expect(new Set(vistos).size).toBe(8); // ciclo completo, sin repetir
    expect(nextRotation(INDICE_FRASE_KEY, 8)).toBe(vistos[0]); // vuelve a empezar
  });

  it("persiste el índice y currentRotation lo lee", () => {
    nextRotation(INDICE_FONDO_KEY, 8);
    nextRotation(INDICE_FONDO_KEY, 8);
    expect(localStorage.getItem(INDICE_FONDO_KEY)).toBe("2");
    expect(currentRotation(INDICE_FONDO_KEY, 8)).toBe(2);
  });

  it("currentRotation arranca en 0 y recorta índices fuera de rango", () => {
    expect(currentRotation(INDICE_FRASE_KEY, 24)).toBe(0);
    localStorage.setItem(INDICE_FRASE_KEY, "999");
    expect(currentRotation(INDICE_FRASE_KEY, 24)).toBe(999 % 24);
  });

  it("pool vacío no rompe", () => {
    expect(nextRotation(INDICE_FRASE_KEY, 0)).toBe(0);
    expect(currentRotation(INDICE_FRASE_KEY, 0)).toBe(0);
  });
});

describe("computeShares", () => {
  const base = [
    { flavorId: "a", flavorName: "Fresa", units: 50 },
    { flavorId: "b", flavorName: "Mango", units: 30 },
    { flavorId: "c", flavorName: "Uva", units: 20 },
  ];

  it("calcula el % sobre las unidades vendidas del rango", () => {
    const s = computeShares(base, {});
    expect(s.totalUnits).toBe(100);
    expect(s.podium[0]).toMatchObject({ flavorName: "Fresa", pct: 50 });
    expect(s.podium[1]).toMatchObject({ flavorName: "Mango", pct: 30 });
    expect(s.podium[2]).toMatchObject({ flavorName: "Uva", pct: 20 });
    expect(s.restPct).toBe(0);
  });

  it("ordena por unidades aunque el backend cambie el orden", () => {
    const s = computeShares([...base].reverse(), {});
    expect(s.podium[0]?.flavorName).toBe("Fresa");
    expect(s.podium[1]?.flavorName).toBe("Mango");
    expect(s.podium[2]?.flavorName).toBe("Uva");
  });

  it("llena 4.º y 5.º y calcula el % del resto (más allá del top 5)", () => {
    const s = computeShares(
      [
        { flavorId: "1", flavorName: "S1", units: 40 },
        { flavorId: "2", flavorName: "S2", units: 20 },
        { flavorId: "3", flavorName: "S3", units: 10 },
        { flavorId: "4", flavorName: "S4", units: 10 },
        { flavorId: "5", flavorName: "S5", units: 10 },
        { flavorId: "6", flavorName: "S6", units: 10 },
      ],
      {},
    );
    expect(s.fourth).toMatchObject({ flavorName: "S4", pct: 10 });
    expect(s.fifth).toMatchObject({ flavorName: "S5", pct: 10 });
    expect(s.restPct).toBe(10); // S6 queda fuera del top 5
  });

  it("posiciones sin datos quedan en null (la ficha pone 😞)", () => {
    const s = computeShares(base.slice(0, 2), {});
    expect(s.podium[2]).toBeNull();
    expect(s.fourth).toBeNull();
    expect(s.fifth).toBeNull();
    expect(s.restPct).toBe(0);
  });

  it("sin ventas: todo vacío y 0 % sin divisiones por cero", () => {
    const vacio = computeShares([], {});
    expect(vacio.podium).toEqual([null, null, null]);
    expect(vacio.restPct).toBe(0);
    const cero = computeShares([{ flavorId: "x", flavorName: "X", units: 0 }], {});
    expect(cero.podium[0]?.pct).toBe(0);
    expect(cero.restPct).toBe(0);
    expect(Number.isNaN(cero.restPct)).toBe(false);
  });

  it("usa el emoji del catálogo y respeta null (fallback 🍦 en la ficha)", () => {
    const s = computeShares(base, { a: "🍓" });
    expect(s.podium[0]?.emoji).toBe("🍓");
    expect(s.podium[1]?.emoji).toBeNull();
  });
});

describe("generarQrSvg", () => {
  it("genera un SVG en el cliente (sin servicios externos)", async () => {
    const svg = await generarQrSvg();
    expect(svg).toContain("<svg");
  });
});
