import type { Request, Response } from "express";
import type { Services } from "../services";
import { parsed } from "../middleware/validate";
import { ApiError } from "../utils/http-error";
import { ok } from "../utils/response";
import { param } from "../utils/request";
import type { MovementType } from "../domain/types";

export function createInventoryControllers(services: Services) {
  return {
    list: async (_req: Request, res: Response): Promise<void> => {
      const inventory = await services.inventory.getInventory();
      res.json(ok(inventory));
    },

    getByFlavor: async (req: Request, res: Response): Promise<void> => {
      const detail = await services.inventory.getFlavorInventory(param(req, "flavorId"));
      if (!detail) {
        throw ApiError.notFound("El sabor no existe.");
      }
      res.json(ok(detail));
    },

    registerMovement: async (_req: Request, res: Response): Promise<void> => {
      const input = parsed<{
        flavorId: string;
        movementType: MovementType;
        quantity: number;
        date: string;
        notes?: string;
      }>(res);
      const movement = await services.inventory.registerMovement(input);
      res.status(201).json(ok(movement));
    },
  };
}
