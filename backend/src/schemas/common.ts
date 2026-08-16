import { z } from "zod";
import { isValidISODate } from "../utils/dates";

export const uuidSchema = z.uuid("El identificador no es válido.");

export const isoDateSchema = z
  .string()
  .refine(isValidISODate, { message: "La fecha debe tener formato AAAA-MM-DD." });

export const optionalText = (max: number) =>
  z.string().trim().max(max, `El texto no puede superar ${max} caracteres.`).optional();

/** Monto de dinero: no puede ser negativo. */
export const moneySchema = z.number("El monto debe ser un número.").min(0, "El monto no puede ser negativo.");

/** Cantidad de paletas: entera y mayor que 0. */
export const positiveIntSchema = z
  .number("La cantidad debe ser un número.")
  .int("La cantidad debe ser un número entero.")
  .positive("La cantidad debe ser mayor que 0.");
