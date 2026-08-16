// ---------------------------------------------------------------------
// Utilidades puras de dinero.
// Nalu almacena montos como REAL; todo cálculo que persista dinero se
// redondea a 2 decimales aquí para evitar errores de punto flotante.
// ---------------------------------------------------------------------

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
