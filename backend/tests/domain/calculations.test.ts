import { describe, expect, it } from "vitest";
import {
  calculateLineSubtotal,
  calculateSaleCost,
  calculateSaleProfit,
  calculateSaleTotal,
  calculateProfitMargin,
  calculateUnitsSold,
} from "../../src/domain/calculations/sales";
import {
  calculateAverageCost,
  calculateInventory,
  calculateInventoryValue,
  isInbound,
  isLowStock,
  isOutbound,
} from "../../src/domain/calculations/inventory";
import { roundMoney } from "../../src/domain/calculations/money";

describe("Cálculos de ventas", () => {
  it("calcula el total: C$60 × 13 = C$780", () => {
    const items = Array.from({ length: 1 }, () => ({
      quantity: 13,
      unitPrice: 60,
      unitCost: 28,
    }));
    expect(calculateSaleTotal(items)).toBe(780);
  });

  it("calcula el costo histórico: C$28 × 13 = C$364", () => {
    const items = [{ quantity: 13, unitPrice: 60, unitCost: 28 }];
    expect(calculateSaleCost(items)).toBe(364);
  });

  it("calcula la ganancia: C$780 − C$364 = C$416", () => {
    const items = [{ quantity: 13, unitPrice: 60, unitCost: 28 }];
    expect(calculateSaleProfit(items)).toBe(416);
  });

  it("calcula el subtotal de una línea: 4 × C$40 = C$160", () => {
    expect(calculateLineSubtotal({ quantity: 4, unitPrice: 40 })).toBe(160);
  });

  it("calcula el costo: C$28 × 4 = C$112", () => {
    const items = [{ quantity: 4, unitPrice: 40, unitCost: 28 }];
    expect(calculateSaleCost(items)).toBe(112);
  });

  it("calcula la ganancia: C$160 − C$112 = C$48", () => {
    const items = [{ quantity: 4, unitPrice: 40, unitCost: 28 }];
    expect(calculateSaleProfit(items)).toBe(48);
  });

  it("calcula el margen: 416 / 780 = 53.33%", () => {
    expect(calculateProfitMargin(416, 780)).toBe(53.33);
  });

  it("devuelve margen 0 cuando no hay ventas", () => {
    expect(calculateProfitMargin(0, 0)).toBe(0);
  });

  it("suma varias líneas con distintos precios", () => {
    const items = [
      { quantity: 2, unitPrice: 60, unitCost: 28 },
      { quantity: 3, unitPrice: 40, unitCost: 28 },
    ];
    expect(calculateSaleTotal(items)).toBe(240);
    expect(calculateUnitsSold(items)).toBe(5);
  });

  it("redondea correctamente a 2 decimales", () => {
    expect(roundMoney(10.005)).toBe(10.01);
    expect(roundMoney(10.004)).toBe(10.0);
  });
});

describe("Cálculos de inventario (modelo de movimientos)", () => {
  it("calcula el disponible: +30 PURCHASE −10 SALE −2 GIFT −1 PERSONAL_USE = 17", () => {
    const movements = [
      { quantity: 30 }, // PURCHASE
      { quantity: -10 }, // SALE
      { quantity: -2 }, // GIFT
      { quantity: -1 }, // PERSONAL_USE
    ];
    expect(calculateInventory(movements)).toBe(17);
  });

  it("distingue entradas de salidas", () => {
    expect(isInbound("PURCHASE")).toBe(true);
    expect(isInbound("RETURN")).toBe(true);
    expect(isInbound("SALE")).toBe(false);
    expect(isOutbound("GIFT")).toBe(true);
    expect(isOutbound("PERSONAL_USE")).toBe(true);
    expect(isOutbound("LOSS")).toBe(true);
    expect(isOutbound("PURCHASE")).toBe(false);
  });

  it("calcula el costo promedio ponderado", () => {
    const purchases = [
      { quantity: 10, unitCost: 28 },
      { quantity: 10, unitCost: 30 },
    ];
    expect(calculateAverageCost(purchases)).toBe(29);
  });

  it("devuelve 0 de costo promedio sin compras", () => {
    expect(calculateAverageCost([])).toBe(0);
  });

  it("calcula el valor estimado del inventario", () => {
    expect(calculateInventoryValue(12, 28)).toBe(336);
  });

  it("detecta stock bajo", () => {
    expect(isLowStock(12, 10)).toBe(false);
    expect(isLowStock(10, 10)).toBe(true);
    expect(isLowStock(4, 10)).toBe(true);
  });
});
