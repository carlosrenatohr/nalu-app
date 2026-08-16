import type { Request, Response } from "express";
import type { Services } from "../services";
import { parsed } from "../middleware/validate";
import { ok } from "../utils/response";
import { ApiError } from "../utils/http-error";

// ---------------------------------------------------------------------
// Capa fina: solo traduce HTTP ⇄ servicios. La lógica vive en
// services/auth.service.ts.
// ---------------------------------------------------------------------

function bearerToken(req: Request): string {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw ApiError.unauthorized("Inicia sesión para continuar.");
  }
  return header.slice(7);
}

export function createAuthControllers(services: Services) {
  return {
    login: async (req: Request, res: Response): Promise<void> => {
      const { pin } = parsed<{ pin: string }>(res);
      const result = await services.auth.login(pin);
      res.json(ok(result));
    },

    logout: async (req: Request, res: Response): Promise<void> => {
      await services.auth.logout(bearerToken(req));
      res.json(ok({ loggedOut: true }));
    },

    me: async (req: Request, res: Response): Promise<void> => {
      const business = await services.auth.me(bearerToken(req));
      if (!business) {
        throw ApiError.unauthorized("Tu sesión expiró. Inicia sesión de nuevo.");
      }
      res.json(ok(business));
    },

    changePin: async (req: Request, res: Response): Promise<void> => {
      const { currentPin, newPin } = parsed<{ currentPin: string; newPin: string }>(res);
      await services.auth.changePin(currentPin, newPin);
      res.json(ok({ changed: true }));
    },
  };
}
