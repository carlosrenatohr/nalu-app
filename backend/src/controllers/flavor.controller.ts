import type { Request, Response } from "express";
import type { Services } from "../services";
import { parsed } from "../middleware/validate";
import { ok } from "../utils/response";
import { param } from "../utils/request";

export function createFlavorControllers(services: Services) {
  return {
    list: async (_req: Request, res: Response): Promise<void> => {
      const flavors = await services.flavors.list();
      res.json(ok(flavors));
    },

    create: async (_req: Request, res: Response): Promise<void> => {
      const input = parsed<{
        name: string;
        emoji?: string;
        color?: string;
        costPrice?: number;
        salePrice?: number;
        minStock?: number;
      }>(res);
      const flavor = await services.flavors.create(input);
      res.status(201).json(ok(flavor));
    },

    update: async (req: Request, res: Response): Promise<void> => {
      const input = parsed<{
        name?: string;
        emoji?: string;
        color?: string;
        costPrice?: number;
        salePrice?: number;
        minStock?: number;
      }>(res);
      const flavor = await services.flavors.update(param(req, "id"), input);
      res.json(ok(flavor));
    },
  };
}
