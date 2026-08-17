import type { Request, Response } from "express";
import type { Services } from "../services";
import { parsed, parsedQuery } from "../middleware/validate";
import { ApiError } from "../utils/http-error";
import { ok } from "../utils/response";
import { param } from "../utils/request";

export function createSaleControllers(services: Services) {
  return {
    list: async (_req: Request, res: Response): Promise<void> => {
      const { from, to } = parsedQuery<{ from?: string; to?: string }>(res);
      const sales = await services.sales.list(from, to);
      res.json(ok(sales));
    },

    create: async (_req: Request, res: Response): Promise<void> => {
      const input = parsed<{
        saleDate: string;
        location: string;
        notes?: string;
        items: { flavorId: string; quantity: number; unitPrice: number }[];
      }>(res);
      const sale = await services.sales.create(input);
      res.status(201).json(ok({ ...sale, profit: services.sales.estimateProfit(sale) }));
    },

    getById: async (req: Request, res: Response): Promise<void> => {
      const sale = await services.sales.getById(param(req, "id"));
      if (!sale) {
        throw ApiError.notFound("La venta no existe.");
      }
      res.json(ok({ ...sale, profit: services.sales.estimateProfit(sale) }));
    },

    update: async (req: Request, res: Response): Promise<void> => {
      const input = parsed<{
        saleDate?: string;
        location?: string;
        notes?: string | null;
        items?: { flavorId: string; quantity: number; unitPrice: number }[];
      }>(res);
      const sale = await services.sales.update(param(req, "id"), input);
      res.json(ok({ ...sale, profit: services.sales.estimateProfit(sale) }));
    },

    delete: async (req: Request, res: Response): Promise<void> => {
      const sale = await services.sales.delete(param(req, "id"));
      res.json(ok({ ...sale, profit: services.sales.estimateProfit(sale) }));
    },
  };
}
