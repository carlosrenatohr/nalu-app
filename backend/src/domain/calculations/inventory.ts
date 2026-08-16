import { roundMoney } from "./money";
import type { MovementType } from "../types";

// ---------------------------------------------------------------------
// Cálculos puros de inventario basados en el modelo de movimientos.
//
// Regla de negocio: el inventario disponible es SIEMPRE la suma de las
// cantidades firmadas de los movimientos. No existen conteos paralelos.
//   + = entrada (PURCHASE, RETURN, ADJUSTMENT positivo)
//   - = salida  (SALE, GIFT, PERSONAL_USE, LOSS, ADJUSTMENT negativo)
// ---------------------------------------------------------------------

export interface MovementLike {
  quantity: number;
}

/** Inventario disponible = suma de cantidades firmadas. */
export function calculateInventory(movements: MovementLike[]): number {
  return movements.reduce((acc, m) => acc + m.quantity, 0);
}

/** Tipo de movimiento que incrementa el inventario. */
export function isInbound(type: MovementType): boolean {
  return type === "PURCHASE" || type === "RETURN";
}

/** Tipo de movimiento que reduce el inventario. */
export function isOutbound(type: MovementType): boolean {
  return !isInbound(type);
}

/**
 * Costo promedio ponderado por sabor.
 * Solo considera compras (entradas con costo): suma(quantity × unitCost) / suma(quantity).
 * Este promedio es la base del costo histórico que se congela en cada venta.
 */
export function calculateAverageCost(
  purchases: { quantity: number; unitCost: number }[],
): number {
  const totalUnits = purchases.reduce((acc, p) => acc + p.quantity, 0);
  if (totalUnits <= 0) return 0;
  const totalCost = purchases.reduce((acc, p) => acc + p.quantity * p.unitCost, 0);
  return roundMoney(totalCost / totalUnits);
}

/** Valor estimado del inventario de un sabor. */
export function calculateInventoryValue(
  available: number,
  averageCost: number,
): number {
  return roundMoney(available * averageCost);
}

/** Indica si un sabor está por debajo del stock mínimo. */
export function isLowStock(available: number, minStock: number): boolean {
  return available <= minStock;
}
