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
 * signo según el tipo de movimiento (salida = negativo). El ajuste manual
 * (`ADJUSTMENT`) es bidireccional: usa `direction` ("in" para aumentar,
 * "out" —por defecto— para disminuir) y exige un motivo.
 */
export const createMovementSchema = z
  .object({
    flavorId: uuidSchema,
    movementType: movementTypeSchema,
    quantity: positiveIntSchema,
    date: isoDateSchema.default(todayISO),
    notes: optionalText(300),
    direction: z.enum(["in", "out"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.movementType === "ADJUSTMENT" && !data.notes?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["notes"],
        message: "Registra el motivo del ajuste de stock.",
      });
    }
  });

export const createMovementSyncSchema = createMovementSchema.extend({
  id: uuidSchema,
});
