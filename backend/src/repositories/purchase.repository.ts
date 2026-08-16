import type { BatchStatement, Db } from "../db/types";
import type { Purchase, PurchaseItem } from "../domain/types";

const PURCHASE_SELECT = `
  SELECT
    p.id, p.business_id AS businessId, p.supplier_id AS supplierId,
    sp.name AS supplierName, p.purchase_date AS purchaseDate,
    p.notes, p.total_cost AS totalCost,
    p.created_at AS createdAt, p.updated_at AS updatedAt
  FROM purchases p
  JOIN suppliers sp ON sp.id = p.supplier_id
`;

const PURCHASE_ITEM_SELECT = `
  SELECT
    pi.id, pi.purchase_id AS purchaseId, pi.flavor_id AS flavorId,
    f.name AS flavorName, pi.quantity, pi.unit_cost AS unitCost, pi.subtotal
  FROM purchase_items pi
  JOIN flavors f ON f.id = pi.flavor_id
`;

export interface NewPurchaseItem {
  id: string;
  purchaseId: string;
  flavorId: string;
  quantity: number;
  unitCost: number;
  subtotal: number;
}

export function createPurchaseRepository(db: Db) {
  return {
    buildCreateStatements(
      purchase: {
        id: string;
        businessId: string;
        supplierId: string;
        purchaseDate: string;
        notes: string | null;
        totalCost: number;
      },
      items: NewPurchaseItem[],
    ): BatchStatement[] {
      const now = new Date().toISOString();
      return [
        {
          sql: `INSERT INTO purchases
            (id, business_id, supplier_id, purchase_date, notes, total_cost, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [
            purchase.id,
            purchase.businessId,
            purchase.supplierId,
            purchase.purchaseDate,
            purchase.notes,
            purchase.totalCost,
            now,
            now,
          ],
        },
        ...items.map((it) => ({
          sql: `INSERT INTO purchase_items
            (id, purchase_id, flavor_id, quantity, unit_cost, subtotal)
            VALUES (?, ?, ?, ?, ?, ?)`,
          params: [
            it.id,
            it.purchaseId,
            it.flavorId,
            it.quantity,
            it.unitCost,
            it.subtotal,
          ],
        })),
      ];
    },

    async list(
      businessId: string,
      from?: string,
      to?: string,
    ): Promise<Purchase[]> {
      const where = ["p.business_id = ?"];
      const params: string[] = [businessId];
      if (from) {
        where.push("p.purchase_date >= ?");
        params.push(from);
      }
      if (to) {
        where.push("p.purchase_date <= ?");
        params.push(to);
      }
      const purchases = await db.all<Purchase>(
        `${PURCHASE_SELECT} WHERE ${where.join(" AND ")} ORDER BY p.purchase_date DESC, p.created_at DESC`,
        params,
      );
      return this.attachItems(businessId, purchases);
    },

    async getById(businessId: string, id: string): Promise<Purchase | null> {
      const purchase = await db.first<Purchase>(
        `${PURCHASE_SELECT} WHERE p.business_id = ? AND p.id = ?`,
        [businessId, id],
      );
      if (!purchase) return null;
      const items = await db.all<PurchaseItem>(
        `${PURCHASE_ITEM_SELECT} WHERE pi.purchase_id = ? ORDER BY pi.subtotal DESC`,
        [id],
      );
      return { ...purchase, items };
    },

    async attachItems(businessId: string, purchases: Purchase[]): Promise<Purchase[]> {
      if (purchases.length === 0) return purchases;
      const ids = purchases.map((p) => p.id);
      const placeholders = ids.map(() => "?").join(", ");
      const items = await db.all<PurchaseItem>(
        `${PURCHASE_ITEM_SELECT} WHERE pi.purchase_id IN (${placeholders})`,
        ids,
      );
      const byPurchase = new Map<string, PurchaseItem[]>();
      for (const item of items) {
        const list = byPurchase.get(item.purchaseId) ?? [];
        list.push(item);
        byPurchase.set(item.purchaseId, list);
      }
      return purchases.map((p) => ({
        ...p,
        items: byPurchase.get(p.id) ?? [],
      }));
    },
  };
}
