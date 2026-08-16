// ---------------------------------------------------------------------
// Utilidades puras de dinero.
// Nalu almacena montos como REAL; todo cálculo que persista dinero se
// redondea a 2 decimales aquí para evitar errores de punto flotante.
// ---------------------------------------------------------------------

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Formatea un monto como moneda local (C$ 780 o C$ 12.50). */
export function formatMoney(value: number, currency = "NIO"): string {
  const hasCents = Math.abs(value % 1) > 0.004;
  return new Intl.NumberFormat("es-NI", {
    style: "currency",
    currency,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(value);
}
