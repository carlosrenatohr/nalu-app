import { eq, and, sql } from "drizzle-orm";
import type { DrizzleDb } from "../db/drizzle-types";
import { saleItems, sales, flavors } from "../db/schema";
import type { Sale, SaleItem } from "../domain/types";

export interface NewSaleItem {
  id: string;
  saleId: string;
  flavorId: string;
  quantity: number;
  unitPrice: number;
  unitCostSnapshot: number;
  subtotal: number;
}

export function createSaleRepository(db: DrizzleDb) {
  return {
    async list(
      businessId: string,
      from?: string,
      to?: string,
    ): Promise<Sale[]> {
      const conditions = [eq(sales.businessId, businessId)];
      if (from) conditions.push(sql`${sales.saleDate} >= ${from}`);
      if (to) conditions.push(sql`${sales.saleDate} <= ${to}`);

      const saleRows = await db
        .select({
          id: sales.id,
          businessId: sales.businessId,
          saleDate: sales.saleDate,
          location: sales.location,
          notes: sales.notes,
          total: sales.total,
          createdAt: sales.createdAt,
          updatedAt: sales.updatedAt,
        })
        .from(sales)
        .where(and(...conditions))
        .orderBy(sql`${sales.saleDate} DESC, ${sales.createdAt} DESC`);

      return this.attachItems(saleRows as unknown as Sale[]);
    },

    async getById(businessId: string, id: string): Promise<Sale | null> {
      const saleRow = await db
        .select({
          id: sales.id,
          businessId: sales.businessId,
          saleDate: sales.saleDate,
          location: sales.location,
          notes: sales.notes,
          total: sales.total,
          createdAt: sales.createdAt,
          updatedAt: sales.updatedAt,
        })
        .from(sales)
        .where(and(eq(sales.businessId, businessId), eq(sales.id, id)))
        .then((rows: Sale[]) => rows[0] ?? null);

      if (!saleRow) return null;

      const items = await db
        .select({
          id: saleItems.id,
          saleId: saleItems.saleId,
          flavorId: saleItems.flavorId,
          flavorName: flavors.name,
          quantity: saleItems.quantity,
          unitPrice: saleItems.unitPrice,
          unitCostSnapshot: saleItems.unitCostSnapshot,
          subtotal: saleItems.subtotal,
        })
        .from(saleItems)
        .innerJoin(flavors, eq(flavors.id, saleItems.flavorId))
        .where(eq(saleItems.saleId, id))
        .orderBy(sql`${saleItems.subtotal} DESC`);

      return { ...saleRow, items: items as SaleItem[] } as Sale;
    },

    async attachItems(salesList: Sale[]): Promise<Sale[]> {
      if (salesList.length === 0) return salesList;
      const ids = salesList.map((s) => s.id);
      const items = await db
        .select({
          id: saleItems.id,
          saleId: saleItems.saleId,
          flavorId: saleItems.flavorId,
          flavorName: flavors.name,
          quantity: saleItems.quantity,
          unitPrice: saleItems.unitPrice,
          unitCostSnapshot: saleItems.unitCostSnapshot,
          subtotal: saleItems.subtotal,
        })
        .from(saleItems)
        .innerJoin(flavors, eq(flavors.id, saleItems.flavorId))
        .where(sql`${saleItems.saleId} IN ${ids}`);

      const bySale = new Map<string, SaleItem[]>();
      for (const item of items) {
        const list = bySale.get(item.saleId) ?? [];
        list.push(item as SaleItem);
        bySale.set(item.saleId, list);
      }
      return salesList.map((s) => ({
        ...s,
        items: bySale.get(s.id) ?? [],
      }));
    },
  };
}
