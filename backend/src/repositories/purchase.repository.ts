import { eq, and, sql } from "drizzle-orm";
import type { DrizzleDb } from "../db/drizzle-types";
import { purchaseItems, purchases, suppliers, flavors } from "../db/schema";
import type { Purchase, PurchaseItem } from "../domain/types";

export interface NewPurchaseItem {
  id: string;
  purchaseId: string;
  flavorId: string;
  quantity: number;
  unitCost: number;
  subtotal: number;
}

export function createPurchaseRepository(db: DrizzleDb) {
  return {
    async list(
      businessId: string,
      from?: string,
      to?: string,
    ): Promise<Purchase[]> {
      const conditions = [eq(purchases.businessId, businessId)];
      if (from) conditions.push(sql`${purchases.purchaseDate} >= ${from}`);
      if (to) conditions.push(sql`${purchases.purchaseDate} <= ${to}`);

      const purchaseRows = await db
        .select({
          id: purchases.id,
          businessId: purchases.businessId,
          supplierId: purchases.supplierId,
          supplierName: suppliers.name,
          purchaseDate: purchases.purchaseDate,
          notes: purchases.notes,
          totalCost: purchases.totalCost,
          createdAt: purchases.createdAt,
          updatedAt: purchases.updatedAt,
        })
        .from(purchases)
        .innerJoin(suppliers, eq(suppliers.id, purchases.supplierId))
        .where(and(...conditions))
        .orderBy(sql`${purchases.purchaseDate} DESC, ${purchases.createdAt} DESC`);

      return this.attachItems(purchaseRows as unknown as Purchase[]);
    },

    async getById(businessId: string, id: string): Promise<Purchase | null> {
      const purchaseRow = await db
        .select({
          id: purchases.id,
          businessId: purchases.businessId,
          supplierId: purchases.supplierId,
          supplierName: suppliers.name,
          purchaseDate: purchases.purchaseDate,
          notes: purchases.notes,
          totalCost: purchases.totalCost,
          createdAt: purchases.createdAt,
          updatedAt: purchases.updatedAt,
        })
        .from(purchases)
        .innerJoin(suppliers, eq(suppliers.id, purchases.supplierId))
        .where(and(eq(purchases.businessId, businessId), eq(purchases.id, id)))
        .then((rows: Purchase[]) => rows[0] ?? null);

      if (!purchaseRow) return null;

      const items = await db
        .select({
          id: purchaseItems.id,
          purchaseId: purchaseItems.purchaseId,
          flavorId: purchaseItems.flavorId,
          flavorName: flavors.name,
          quantity: purchaseItems.quantity,
          unitCost: purchaseItems.unitCost,
          subtotal: purchaseItems.subtotal,
        })
        .from(purchaseItems)
        .innerJoin(flavors, eq(flavors.id, purchaseItems.flavorId))
        .where(eq(purchaseItems.purchaseId, id))
        .orderBy(sql`${purchaseItems.subtotal} DESC`);

      return { ...purchaseRow, items: items as PurchaseItem[] } as Purchase;
    },

    async attachItems(purchasesList: Purchase[]): Promise<Purchase[]> {
      if (purchasesList.length === 0) return purchasesList;
      const ids = purchasesList.map((p) => p.id);
      const items = await db
        .select({
          id: purchaseItems.id,
          purchaseId: purchaseItems.purchaseId,
          flavorId: purchaseItems.flavorId,
          flavorName: flavors.name,
          quantity: purchaseItems.quantity,
          unitCost: purchaseItems.unitCost,
          subtotal: purchaseItems.subtotal,
        })
        .from(purchaseItems)
        .innerJoin(flavors, eq(flavors.id, purchaseItems.flavorId))
        .where(sql`${purchaseItems.purchaseId} IN ${ids}`);

      const byPurchase = new Map<string, PurchaseItem[]>();
      for (const item of items) {
        const list = byPurchase.get(item.purchaseId) ?? [];
        list.push(item as PurchaseItem);
        byPurchase.set(item.purchaseId, list);
      }
      return purchasesList.map((p) => ({
        ...p,
        items: byPurchase.get(p.id) ?? [],
      }));
    },
  };
}
