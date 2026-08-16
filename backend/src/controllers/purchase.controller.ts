import type { Request, Response } from "express";
import type { Services } from "../services";
import { parsed, parsedQuery } from "../middleware/validate";
import { ApiError } from "../utils/http-error";
import { ok } from "../utils/response";
import { param } from "../utils/request";

export function createPurchaseControllers(services: Services) {
  return {
    list: async (_req: Request, res: Response): Promise<void> => {
      const { from, to } = parsedQuery<{ from?: string; to?: string }>(res);
      const purchases = await services.purchases.list(from, to);
      res.json(ok(purchases));
    },

    create: async (_req: Request, res: Response): Promise<void> => {
      const input = parsed<{
        purchaseDate: string;
        supplierId: string;
        notes?: string;
        items: { flavorId: string; quantity: number; unitCost: number }[];
      }>(res);
      const purchase = await services.purchases.create(input);
      res.status(201).json(ok(purchase));
    },

    getById: async (req: Request, res: Response): Promise<void> => {
      const purchase = await services.purchases.getById(param(req, "id"));
      if (!purchase) {
        throw ApiError.notFound("La compra no existe.");
      }
      res.json(ok(purchase));
    },
  };
}
