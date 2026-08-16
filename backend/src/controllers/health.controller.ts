import type { Request, Response } from "express";
import type { Services } from "../services";
import { ok } from "../utils/response";

export function createHealthController(services: Services) {
  return {
    check: async (_req: Request, res: Response): Promise<void> => {
      // Verifica que la base responda (D1 o SQLite local)
      await services.business.get();
      res.json(ok({ status: "ok", db: "ok" }));
    },
  };
}
