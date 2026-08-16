import { z } from "zod";
import { todayISO } from "../utils/dates";
import { isoDateSchema, moneySchema, optionalText, positiveIntSchema, uuidSchema } from "./common";

export const saleItemSchema = z.object({
  flavorId: uuidSchema,
  quantity: positiveIntSchema,
  unitPrice: moneySchema,
});

export const createSaleSchema = z.object({
  saleDate: isoDateSchema.default(todayISO),
  location: z.string().trim().min(1, "Elige una ubicación.").max(60),
  notes: optionalText(500),
  items: z.array(saleItemSchema).min(1, "Agrega al menos un sabor a la venta."),
});

/** Para sincronización offline: el cliente genera el id de la venta. */
export const createSaleSyncSchema = createSaleSchema.extend({
  id: uuidSchema,
});

export const saleListQuerySchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});
