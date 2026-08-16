import type { Db } from "../db/types";

export interface SalesTotals {
  total: number;
  units: number;
  cost: number;
}

export interface FlavorSalesRow {
  flavorId: string;
  flavorName: string;
  units: number;
  revenue: number;
  cost: number;
}

export interface LocationSalesRow {
  location: string;
  units: number;
  revenue: number;
}

export interface PriceSalesRow {
  unitPrice: number;
  units: number;
  revenue: number;
  cost: number;
}

export function createReportRepository(db: Db) {
  return {
    async salesTotals(
      businessId: string,
      from: string,
      to: string,
    ): Promise<SalesTotals> {
      const row = await db.first<SalesTotals>(
        `SELECT
           COALESCE(SUM(si.subtotal), 0) AS total,
           COALESCE(SUM(si.quantity), 0) AS units,
           COALESCE(SUM(si.quantity * si.unit_cost_snapshot), 0) AS cost
         FROM sales s
         JOIN sale_items si ON si.sale_id = s.id
         WHERE s.business_id = ? AND s.sale_date BETWEEN ? AND ?`,
        [businessId, from, to],
      );
      return row ?? { total: 0, units: 0, cost: 0 };
    },

    async salesByFlavor(
      businessId: string,
      from: string,
      to: string,
    ): Promise<FlavorSalesRow[]> {
      return db.all<FlavorSalesRow>(
        `SELECT
           si.flavor_id AS flavorId,
           f.name AS flavorName,
           SUM(si.quantity) AS units,
           SUM(si.subtotal) AS revenue,
           SUM(si.quantity * si.unit_cost_snapshot) AS cost
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         JOIN flavors f ON f.id = si.flavor_id
         WHERE s.business_id = ? AND s.sale_date BETWEEN ? AND ?
         GROUP BY si.flavor_id
         ORDER BY units DESC`,
        [businessId, from, to],
      );
    },

    async salesByLocation(
      businessId: string,
      from: string,
      to: string,
    ): Promise<LocationSalesRow[]> {
      return db.all<LocationSalesRow>(
        `SELECT
           s.location AS location,
           SUM(si.quantity) AS units,
           SUM(si.subtotal) AS revenue
         FROM sales s
         JOIN sale_items si ON si.sale_id = s.id
         WHERE s.business_id = ? AND s.sale_date BETWEEN ? AND ?
         GROUP BY s.location
         ORDER BY revenue DESC`,
        [businessId, from, to],
      );
    },

    async salesByPrice(
      businessId: string,
      from: string,
      to: string,
    ): Promise<PriceSalesRow[]> {
      return db.all<PriceSalesRow>(
        `SELECT
           si.unit_price AS unitPrice,
           SUM(si.quantity) AS units,
           SUM(si.subtotal) AS revenue,
           SUM(si.quantity * si.unit_cost_snapshot) AS cost
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         WHERE s.business_id = ? AND s.sale_date BETWEEN ? AND ?
         GROUP BY si.unit_price
         ORDER BY unitPrice ASC`,
        [businessId, from, to],
      );
    },
  };
}
