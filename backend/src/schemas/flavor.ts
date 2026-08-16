import { z } from "zod";
import { uuidSchema } from "./common";

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "El color debe estar en formato #RRGGBB.");

export const createFlavorSchema = z.object({
  name: z.string().trim().min(1, "Escribe el nombre del sabor.").max(60),
  emoji: z.string().trim().max(8).optional(),
  color: hexColorSchema.optional(),
  minStock: z.number().int().min(0).default(10),
});

export const updateFlavorSchema = createFlavorSchema.partial();

export const createFlavorSyncSchema = createFlavorSchema.extend({
  id: uuidSchema,
});
