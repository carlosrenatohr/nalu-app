import { z } from "zod";
import { optionalText, uuidSchema } from "./common";

export const createSupplierSchema = z.object({
  name: z.string().trim().min(1, "Escribe el nombre del proveedor.").max(80),
  contact: optionalText(120),
  notes: optionalText(300),
});

export const updateSupplierSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  contact: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(300).nullable().optional(),
  active: z.boolean().optional(),
});

export const createSupplierSyncSchema = createSupplierSchema.extend({
  id: uuidSchema,
});
