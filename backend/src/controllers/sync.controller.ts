import type { Request, Response } from "express";
import type { Services } from "../services";
import { parsed } from "../middleware/validate";
import { ok } from "../utils/response";
import type { SyncOperation } from "../services/sync.service";

export function createSyncControllers(services: Services) {
  return {
    apply: async (_req: Request, res: Response): Promise<void> => {
      const { operations } = parsed<{ operations: SyncOperation[] }>(res);
      const results = await services.sync.applyOperations(operations);
      res.json(ok({ results }));
    },
  };
}
