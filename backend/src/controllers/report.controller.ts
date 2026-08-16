import type { Request, Response } from "express";
import type { Services } from "../services";
import { parsedQuery } from "../middleware/validate";
import { ok } from "../utils/response";

/** Rango por defecto: últimos 30 días hasta hoy. */
function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const iso = (d: Date) => {
    const offset = d.getTimezoneOffset() * 60_000;
    return new Date(d.getTime() - offset).toISOString().slice(0, 10);
  };
  return { from: iso(from), to: iso(to) };
}

export function createReportControllers(services: Services) {
  return {
    sales: async (_req: Request, res: Response): Promise<void> => {
      const { from, to } = parsedQuery<{ from?: string; to?: string }>(res);
      const range = { from: from ?? defaultRange().from, to: to ?? defaultRange().to };
      const report = await services.reports.salesReport(range);
      res.json(ok(report));
    },

    purchases: async (_req: Request, res: Response): Promise<void> => {
      const { from, to } = parsedQuery<{ from?: string; to?: string }>(res);
      const range = { from: from ?? defaultRange().from, to: to ?? defaultRange().to };
      const report = await services.reports.purchasesReport(range);
      res.json(ok(report));
    },

    inventory: async (_req: Request, res: Response): Promise<void> => {
      const report = await services.reports.inventoryReport();
      res.json(ok(report));
    },
  };
}
