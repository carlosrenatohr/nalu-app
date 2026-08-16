// ---------------------------------------------------------------------
// Formato de dinero y fechas en español (C$ para córdobas).
// ---------------------------------------------------------------------

/** Formatea un monto como moneda (C$ 780 o C$ 12.50). */
export function formatMoney(value: number, currency = "NIO"): string {
  const hasCents = Math.abs(value % 1) > 0.004;
  return new Intl.NumberFormat("es-NI", {
    style: "currency",
    currency,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(value);
}

/** Fecha larga en español: "sábado, 15 de agosto de 2026". */
export function formatDateLong(iso: string): string {
  return new Intl.DateTimeFormat("es-NI", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00`));
}

/** Fecha corta: "15 ago 2026". */
export function formatDateShort(iso: string): string {
  return new Intl.DateTimeFormat("es-NI", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00`));
}

/** "Hoy", "Ayer" o la fecha corta. */
export function formatRelativeDay(iso: string): string {
  const today = localToday();
  if (iso === today) return "Hoy";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (iso === toISODate(yesterday)) return "Ayer";
  return formatDateShort(iso);
}

/** Fecha local de hoy en YYYY-MM-DD. */
export function localToday(): string {
  return toISODate(new Date());
}

export function toISODate(d: Date): string {
  const offset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

/** Suma días a una fecha ISO y devuelve otra ISO. */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Primer día de la semana (lunes) de una fecha. */
export function startOfWeek(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const day = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - day);
  return toISODate(d);
}

/** Primer día del mes de una fecha. */
export function startOfMonth(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(1);
  return toISODate(d);
}
