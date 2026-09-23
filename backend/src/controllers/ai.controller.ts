import type { Request, Response } from "express";
import type { Services } from "../services";
import { parsedQuery } from "../middleware/validate";
import { ok } from "../utils/response";
import { DEFAULT_RECOMMENDATION_DAYS } from "../services/ai.service";
import type { AiRecommendationQuery } from "../schemas/ai";

// ---------------------------------------------------------------------
// Controller IA: solo HTTP (leer query validada, delegar, responder).
// ---------------------------------------------------------------------
export function createAiControllers(services: Services) {
  return {
    inventoryRecommendation: async (_req: Request, res: Response): Promise<void> => {
      const { days } = parsedQuery<AiRecommendationQuery>(res);
      const recommendation = await services.ai.inventoryRecommendation(
        days ?? DEFAULT_RECOMMENDATION_DAYS,
      );
      res.json(ok(recommendation));
    },
  };
}
