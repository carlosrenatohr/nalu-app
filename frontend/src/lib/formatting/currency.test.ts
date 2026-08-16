// ---------------------------------------------------------------------
// Tests unitarios del formateo de dinero y fechas.
// Cubren el formato C$ (córdobas) y los helpers de fechas en español.
// ---------------------------------------------------------------------
import { describe, expect, it } from "vitest";
import {
  addDays,
  formatDateLong,
  formatDateShort,
  formatMoney,
  formatRelativeDay,
  localToday,
  startOfMonth,
  startOfWeek,
  toISODate,
} from "./currency";

describe("formatMoney", () => {
  it("formatea montos enteros sin decimales: 780 → C$780", () => {
    expect(formatMoney(780)).toBe("C$780");
  });

  it("formatea montos con centavos: 12.5 → C$12.50", () => {
    expect(formatMoney(12.5)).toBe("C$12.50");
  });

  it("redondea a 2 decimales cuando hace falta: 3.333 → C$3.33", () => {
    expect(formatMoney(3.333)).toBe("C$3.33");
  });

  it("maneja cero y negativos", () => {
    expect(formatMoney(0)).toBe("C$0");
    expect(formatMoney(-32)).toBe("-C$32");
  });
});

describe("Helpers de fechas", () => {
  it("formatea fecha larga en español", () => {
    // Se construye a partir de una fecha local para no depender del TZ.
    const iso = toISODate(new Date(2026, 7, 15)); // 15 de agosto de 2026
    expect(formatDateLong(iso)).toMatch(/agosto/);
  });

  it("formatea fecha corta con mes abreviado", () => {
    const iso = toISODate(new Date(2026, 7, 15));
    expect(formatDateShort(iso)).toMatch(/ago/);
  });

  it("dice 'Hoy' para la fecha actual y 'Ayer' para la anterior", () => {
    const today = localToday();
    expect(formatRelativeDay(today)).toBe("Hoy");
    expect(formatRelativeDay(addDays(today, -1))).toBe("Ayer");
  });

  it("suma días y respeta cambios de mes", () => {
    const iso = toISODate(new Date(2026, 0, 31)); // 31 de enero de 2026
    expect(addDays(iso, 1)).toBe("2026-02-01");
  });

  it("calcula el lunes como inicio de semana", () => {
    // Sábado 15 de agosto de 2026 → lunes 10 de agosto de 2026
    const saturday = toISODate(new Date(2026, 7, 15));
    expect(startOfWeek(saturday)).toBe("2026-08-10");
  });

  it("calcula el primer día del mes", () => {
    const iso = toISODate(new Date(2026, 7, 15));
    expect(startOfMonth(iso)).toBe("2026-08-01");
  });
});
