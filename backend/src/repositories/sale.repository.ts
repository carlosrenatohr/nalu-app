import type { BatchStatement, Db } from "../db/types";
import type { Sale, SaleItem } from "../domain/types";

const SALE_SELECT = `
  SELECT
    s.id, s.business_id AS businessId, s.sale_date AS saleDate,
    s.location, s.notes, s.total,
    s.created_at AS createdAt, s.updated_at AS updatedAt
  FROM sales s
`;

const SALE_ITEM_SELECT = `
  SELECT
    si.id, si.sale_id AS saleId, si.flavor_id AS flavorId,
    f.name AS flavorName, si.quantity, si.unit_price AS unitPrice,
    si.unit_cost_snapshot AS unitCostSnapshot, si.subtotal
  FROM sale_items si
  JOIN flavors f ON f.id = si.flavor_id
`;

export interface NewSaleItem {
  id: string;
  saleId: string;
  flavorId: string;
  quantity: number;
  unitPrice: number;
  unitCostSnapshot: number;
  subtotal: number;
}

export function createSaleRepository(db: Db) {
  return {
    /** Sentencias atómicas para crear una venta + sus ítems en un batch. */
    buildCreateStatements(
      sale: {
        id: string;
        businessId: string;
        saleDate: string;
        location: string | null;
        notes: string | null;
        total: number;
      },
      items: NewSaleItem[],
    ): BatchStatement[] {
      const now = new Date().toISOString();
      return [
        {
          sql: `INSERT INTO sales
            (id, business_id, sale_date, location, notes, total, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [
            sale.id,
            sale.businessId,
            sale.saleDate,
            sale.location,
            sale.notes,
            sale.total,
            now,
            now,
          ],
        },
        ...items.map((it) => ({
          sql: `INSERT INTO sale_items
            (id, sale_id, flavor_id, quantity, unit_price, unit_cost_snapshot, subtotal)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
          params: [
            it.id,
            it.saleId,
            it.flavorId,
            it.quantity,
            it.unitPrice,
            it.unitCostSnapshot,
            it.subtotal,
          ],
        })),
      ];
    },

    async list(
      businessId: string,
      from?: string,
      to?: string,
    ): Promise<Sale[]> {
      const where = ["s.business_id = ?"];
      const params: string[] = [businessId];
      if (from) {
        where.push("s.sale_date >= ?");
        params.push(from);
      }
      if (to) {
        where.push("s.sale_date <= ?");
        params.push(to);
      }
      const sales = await db.all<Sale>(
        `${SALE_SELECT} WHERE ${where.join(" AND ")} ORDER BY s.sale_date DESC, s.created_at DESC`,
        params,
      );
      return this.attachItems(businessId, sales);
    },

    async getById(businessId: string, id: string): Promise<Sale | null> {
      const sale = await db.first<Sale>(
        `${SALE_SELECT} WHERE s.business_id = ? AND s.id = ?`,
        [businessId, id],
      );
      if (!sale) return null;
      const items = await db.all<SaleItem>(
        `${SALE_ITEM_SELECT} WHERE si.sale_id = ? ORDER BY si.subtotal DESC`,
        [id],
      );
      return { ...sale, items };
    },

    async attachItems(businessId: string, sales: Sale[]): Promise<Sale[]> {
      if (sales.length === 0) return sales;
      const ids = sales.map((s) => s.id);
      const placeholders = ids.map(() => "?").join(", ");
      const items = await db.all<SaleItem>(
        `${SALE_ITEM_SELECT} WHERE si.sale_id IN (${placeholders})`,
        ids,
      );
      const bySale = new Map<string, SaleItem[]>();
      for (const item of items) {
        const list = bySale.get(item.saleId) ?? [];
        list.push(item);
        bySale.set(item.saleId, list);
      }
      return sales.map((s) => ({
        ...s,
        items: bySale.get(s.id) ?? [],
      }));
    },
  };
}
