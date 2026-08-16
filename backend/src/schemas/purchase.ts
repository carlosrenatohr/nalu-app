import { z } from "zod";
import { todayISO } from "../utils/dates";
import { isoDateSchema, moneySchema, optionalText, positiveIntSchema, uuidSchema } from "./common";

export const purchaseItemSchema = z.object({
  flavorId: uuidSchema,
  quantity: positiveIntSchema,
  unitCost: moneySchema,
});

export const createPurchaseSchema = z.object({
  purchaseDate: isoDateSchema.default(todayISO),
  supplierId: uuidSchema,
  notes: optionalText(500),
  items: z.array(purchaseItemSchema).min(1, "Agrega al menos un sabor a la compra."),
});

export const createPurchaseSyncSchema = createPurchaseSchema.extend({
  id: uuidSchema,
});

export const purchaseListQuerySchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});
