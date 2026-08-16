import { z } from "zod";
import { todayISO } from "../utils/dates";
import { isoDateSchema, optionalText, positiveIntSchema, uuidSchema } from "./common";

export const movementTypeSchema = z.enum([
  "PURCHASE",
  "SALE",
  "GIFT",
  "PERSONAL_USE",
  "LOSS",
  "ADJUSTMENT",
  "RETURN",
]);

/**
 * La cantidad SIEMPRE llega positiva en la API; el servicio aplica el
 * signo según el tipo de movimiento (salida = negativo).
 */
export const createMovementSchema = z.object({
  flavorId: uuidSchema,
  movementType: movementTypeSchema,
  quantity: positiveIntSchema,
  date: isoDateSchema.default(todayISO),
  notes: optionalText(300),
});

export const createMovementSyncSchema = createMovementSchema.extend({
  id: uuidSchema,
});
