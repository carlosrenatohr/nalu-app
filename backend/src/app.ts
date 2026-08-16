import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import type { DrizzleDb } from "./db/drizzle-types";
import { createApiRouter } from "./routes";
import { requestLogger } from "./middleware/logger";
import { notFoundHandler } from "./middleware/not-found";
import { errorHandler } from "./middleware/error-handler";

export interface AppDeps {
  db: DrizzleDb;
  /**
   * Resuelve (de forma perezosa y cacheable) el id del negocio.
   * En Workers NO se puede hacer I/O asíncrono en el scope global del
   * módulo, así que la primera consulta ocurre dentro de un request.
   */
  getBusinessId: () => Promise<string>;
  /** Origen permitido por CORS (solo desarrollo; en producción es same-origin). */
  corsOrigin?: string;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable("x-powered-by");

  // Seguridad: cabeceras básicas (helmet) y CORS controlado
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: deps.corsOrigin ?? false }));

  // Cuerpo JSON con límite razonable
  app.use(express.json({ limit: "1mb" }));

  app.use(requestLogger);

  // API REST
  app.use("/api", createApiRouter(deps));

  // Rutas no encontradas y errores centralizados
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
