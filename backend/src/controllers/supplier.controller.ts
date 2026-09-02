import type { Request, Response } from "express";
import type { Services } from "../services";
import { parsed } from "../middleware/validate";
import { ok } from "../utils/response";
import { param } from "../utils/request";

export function createSupplierControllers(services: Services) {
  return {
    list: async (req: Request, res: Response): Promise<void> => {
      const includeInactive = req.query.includeInactive === "true";
      const suppliers = await services.suppliers.list(includeInactive);
      res.json(ok(suppliers));
    },

    create: async (_req: Request, res: Response): Promise<void> => {
      const input = parsed<{ name: string; contact?: string; notes?: string }>(res);
      const supplier = await services.suppliers.create(input);
      res.status(201).json(ok(supplier));
    },

    update: async (req: Request, res: Response): Promise<void> => {
      const input = parsed<{
        name?: string;
        contact?: string | null;
        notes?: string | null;
        active?: boolean;
      }>(res);
      const supplier = await services.suppliers.update(param(req, "id"), input);
      res.json(ok(supplier));
    },
  };
}
