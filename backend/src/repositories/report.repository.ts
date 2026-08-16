import { eq, and, sql, asc } from "drizzle-orm";
import type { DrizzleDb } from "../db/drizzle-types";
import { sales, saleItems, flavors } from "../db/schema";

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

export function createReportRepository(db: DrizzleDb) {
  return {
    async salesTotals(
      businessId: string,
      from: string,
      to: string,
    ): Promise<SalesTotals> {
      const rows: { total: unknown; units: unknown; cost: unknown }[] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${saleItems.subtotal}), 0)`.as("total"),
          units: sql<string>`COALESCE(SUM(${saleItems.quantity}), 0)`.as("units"),
          cost: sql<string>`COALESCE(SUM(${saleItems.quantity} * ${saleItems.unitCostSnapshot}), 0)`.as("cost"),
        })
        .from(sales)
        .innerJoin(saleItems, eq(saleItems.saleId, sales.id))
        .where(
          and(
            eq(sales.businessId, businessId),
            sql`${sales.saleDate} BETWEEN ${from} AND ${to}`,
          ),
        );
      const row = rows[0] ?? null;
      if (!row) return { total: 0, units: 0, cost: 0 };
      return { total: Number(row.total), units: Number(row.units), cost: Number(row.cost) };
    },

    async salesByFlavor(
      businessId: string,
      from: string,
      to: string,
    ): Promise<FlavorSalesRow[]> {
      const rows: { flavorId: string; flavorName: string; units: unknown; revenue: unknown; cost: unknown }[] = await db
        .select({
          flavorId: saleItems.flavorId,
          flavorName: flavors.name,
          units: sql<string>`SUM(${saleItems.quantity})`.as("units"),
          revenue: sql<string>`SUM(${saleItems.subtotal})`.as("revenue"),
          cost: sql<string>`SUM(${saleItems.quantity} * ${saleItems.unitCostSnapshot})`.as("cost"),
        })
        .from(saleItems)
        .innerJoin(sales, eq(sales.id, saleItems.saleId))
        .innerJoin(flavors, eq(flavors.id, saleItems.flavorId))
        .where(
          and(
            eq(sales.businessId, businessId),
            sql`${sales.saleDate} BETWEEN ${from} AND ${to}`,
          ),
        )
        .groupBy(saleItems.flavorId, flavors.name)
        .orderBy(sql`units DESC`);
      return rows.map((r) => ({
        flavorId: r.flavorId,
        flavorName: r.flavorName,
        units: Number(r.units),
        revenue: Number(r.revenue),
        cost: Number(r.cost),
      }));
    },

    async salesByLocation(
      businessId: string,
      from: string,
      to: string,
    ): Promise<LocationSalesRow[]> {
      const rows: { location: string | null; units: unknown; revenue: unknown }[] = await db
        .select({
          location: sales.location,
          units: sql<string>`SUM(${saleItems.quantity})`.as("units"),
          revenue: sql<string>`SUM(${saleItems.subtotal})`.as("revenue"),
        })
        .from(sales)
        .innerJoin(saleItems, eq(saleItems.saleId, sales.id))
        .where(
          and(
            eq(sales.businessId, businessId),
            sql`${sales.saleDate} BETWEEN ${from} AND ${to}`,
          ),
        )
        .groupBy(sales.location)
        .orderBy(sql`revenue DESC`);
      return rows.map((r) => ({
        location: r.location ?? "",
        units: Number(r.units),
        revenue: Number(r.revenue),
      }));
    },

    async salesByPrice(
      businessId: string,
      from: string,
      to: string,
    ): Promise<PriceSalesRow[]> {
      const rows: { unitPrice: number; units: unknown; revenue: unknown; cost: unknown }[] = await db
        .select({
          unitPrice: saleItems.unitPrice,
          units: sql<string>`SUM(${saleItems.quantity})`.as("units"),
          revenue: sql<string>`SUM(${saleItems.subtotal})`.as("revenue"),
          cost: sql<string>`SUM(${saleItems.quantity} * ${saleItems.unitCostSnapshot})`.as("cost"),
        })
        .from(saleItems)
        .innerJoin(sales, eq(sales.id, saleItems.saleId))
        .where(
          and(
            eq(sales.businessId, businessId),
            sql`${sales.saleDate} BETWEEN ${from} AND ${to}`,
          ),
        )
        .groupBy(saleItems.unitPrice)
        .orderBy(asc(saleItems.unitPrice));
      return rows.map((r) => ({
        unitPrice: r.unitPrice,
        units: Number(r.units),
        revenue: Number(r.revenue),
        cost: Number(r.cost),
      }));
    },
  };
}
