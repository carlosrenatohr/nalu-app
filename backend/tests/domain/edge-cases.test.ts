// ---------------------------------------------------------------------
// Tests de casos límite para los cálculos puros del dominio.
// Complementan calculations.test.ts con precisión de punto flotante,
// costos faltantes y promedios ponderados con cantidades desiguales.
// ---------------------------------------------------------------------
import { describe, expect, it } from "vitest";
import {
  calculateSaleCost,
  calculateSaleProfit,
  calculateSaleTotal,
} from "../../src/domain/calculations/sales";
import {
  calculateAverageCost,
  calculateInventoryValue,
} from "../../src/domain/calculations/inventory";
import { roundMoney } from "../../src/domain/calculations/money";

describe("Precisión de punto flotante", () => {
  it("no acumula errores de coma flotante en totales con decimales", () => {
    // 0.1 + 0.2 = 0.30000000000000004 en binario; el redondeo lo corrige.
    const items = [
      { quantity: 1, unitPrice: 0.1 },
      { quantity: 1, unitPrice: 0.2 },
    ];
    expect(calculateSaleTotal(items)).toBe(0.3);
  });

  it("redondea montos negativos de forma consistente", () => {
    expect(roundMoney(-10.005)).toBe(-10.01);
  });
});

describe("Costos faltantes (estimaciones de UI)", () => {
  it("trata el costo ausente como 0 en el costo total", () => {
    const items = [
      { quantity: 3, unitPrice: 60 }, // sin unitCost → costo 0
      { quantity: 2, unitPrice: 60, unitCost: 28 },
    ];
    expect(calculateSaleCost(items)).toBe(56);
  });

  it("la ganancia sin costo histórico refleja solo el precio de venta", () => {
    const items = [{ quantity: 2, unitPrice: 60 }];
    expect(calculateSaleProfit(items)).toBe(120);
  });
});

describe("Promedio ponderado con cantidades desiguales", () => {
  it("pesa por cantidad: 10×28 + 5×32 = 29.33", () => {
    const purchases = [
      { quantity: 10, unitCost: 28 },
      { quantity: 5, unitCost: 32 },
    ];
    expect(calculateAverageCost(purchases)).toBe(29.33);
  });

  it("ignora compras de cantidad 0 (evita división por cero)", () => {
    const purchases = [{ quantity: 0, unitCost: 28 }];
    expect(calculateAverageCost(purchases)).toBe(0);
  });
});

describe("Valor de inventario", () => {
  it("redondea valores con decimales", () => {
    // 10 disponibles × 29.33 = 293.30
    expect(calculateInventoryValue(10, 29.33)).toBe(293.3);
  });

  it("vale 0 sin inventario disponible", () => {
    expect(calculateInventoryValue(0, 28)).toBe(0);
  });
});
