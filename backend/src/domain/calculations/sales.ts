import { roundMoney } from "./money";

// ---------------------------------------------------------------------
// Cálculos puros de ventas. No dependen de la base de datos ni de HTTP:
// reciben líneas y devuelven números, lo que las hace fáciles de probar.
//
// Regla de negocio clave: la ganancia de una venta se calcula SIEMPRE
// con el costo histórico (unitCost) congelado al momento de vender,
// nunca con el costo actual del proveedor.
// ---------------------------------------------------------------------

export interface SaleLine {
  quantity: number;
  unitPrice: number;
  /** Costo histórico unitario (opcional para totales/costo). */
  unitCost?: number;
}

/** Subtotal de una línea: cantidad × precio unitario. */
export function calculateLineSubtotal(line: SaleLine): number {
  return roundMoney(line.quantity * line.unitPrice);
}

/** Total de la venta: suma de subtotales. */
export function calculateSaleTotal(items: SaleLine[]): number {
  return roundMoney(items.reduce((acc, l) => acc + calculateLineSubtotal(l), 0));
}

/** Costo total: suma de cantidad × costo (histórico o unitario). */
export function calculateSaleCost(
  items: { quantity: number; unitCost?: number }[],
): number {
  return roundMoney(
    items.reduce(
      (acc, l) => acc + l.quantity * (l.unitCost ?? 0),
      0,
    ),
  );
}

/** Ganancia de la venta: total − costo histórico. */
export function calculateSaleProfit(items: SaleLine[]): number {
  return roundMoney(calculateSaleTotal(items) - calculateSaleCost(items));
}

/** Margen porcentual sobre el total de la venta (0 si no hay ventas). */
export function calculateProfitMargin(profit: number, total: number): number {
  if (total <= 0) return 0;
  return roundMoney((profit / total) * 100);
}

/** Cantidad total de paletas vendidas. */
export function calculateUnitsSold(items: SaleLine[]): number {
  return items.reduce((acc, l) => acc + l.quantity, 0);
}
