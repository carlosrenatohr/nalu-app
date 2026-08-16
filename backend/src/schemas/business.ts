import { z } from "zod";
import { hexColorSchema } from "./flavor";
import { moneySchema } from "./common";

export const updateBusinessSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  currency: z.string().trim().min(3).max(10).optional(),
  defaultPurchaseCost: moneySchema.optional(),
  defaultHomePrice: moneySchema.optional(),
  primaryColor: hexColorSchema.optional(),
  secondaryColor: hexColorSchema.optional(),
  contact: z.string().trim().max(200).nullable().optional(),
  reportFooter: z.string().trim().max(200).nullable().optional(),
});

export const createLocationSchema = z.object({
  name: z.string().trim().min(1, "Escribe el nombre de la ubicación.").max(40),
});

export const updateLocationSchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  active: z.boolean().optional(),
});
