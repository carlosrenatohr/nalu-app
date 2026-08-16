import type { Request, Response } from "express";
import type { Services } from "../services";
import { parsed } from "../middleware/validate";
import { ok } from "../utils/response";
import { param } from "../utils/request";

export function createBusinessControllers(services: Services) {
  return {
    getSettings: async (_req: Request, res: Response): Promise<void> => {
      const business = await services.business.get();
      res.json(ok(business));
    },

    updateSettings: async (_req: Request, res: Response): Promise<void> => {
      const input = parsed<Record<string, unknown>>(res);
      const business = await services.business.update(input);
      res.json(ok(business));
    },

    listLocations: async (_req: Request, res: Response): Promise<void> => {
      const locations = await services.locations.list();
      res.json(ok(locations));
    },

    createLocation: async (_req: Request, res: Response): Promise<void> => {
      const input = parsed<{ name: string }>(res);
      const location = await services.locations.create(input);
      res.status(201).json(ok(location));
    },

    updateLocation: async (req: Request, res: Response): Promise<void> => {
      const input = parsed<{ name?: string; active?: boolean }>(res);
      const location = await services.locations.update(param(req, "id"), input);
      res.json(ok(location));
    },
  };
}
