import { eq, and, sql } from "drizzle-orm";
import type { DrizzleDb } from "../db/drizzle-types";
import { saleItems, sales, flavors, inventoryMovements } from "../db/schema";
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

    async delete(businessId: string, id: string): Promise<Sale | null> {
      const sale = await this.getById(businessId, id);
      if (!sale) return null;

      // Eliminar movimientos de inventario associados a esta venta
      await db
        .delete(inventoryMovements)
        .where(
          and(
            eq(inventoryMovements.businessId, businessId),
            eq(inventoryMovements.referenceId, id),
          ),
        );

      // Eliminar items (ON DELETE CASCADE se encarga, pero lo hacemos explícito)
      await db.delete(saleItems).where(eq(saleItems.saleId, id));

      // Eliminar la venta
      await db
        .delete(sales)
        .where(and(eq(sales.businessId, businessId), eq(sales.id, id)));

      return sale;
    },

    async update(
      businessId: string,
      id: string,
      input: {
        saleDate?: string;
        location?: string;
        notes?: string | null;
        total?: number;
      },
    ): Promise<Sale | null> {
      const updateData: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      if (input.saleDate !== undefined) updateData.saleDate = input.saleDate;
      if (input.location !== undefined) updateData.location = input.location;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.total !== undefined) updateData.total = input.total;

      await db
        .update(sales)
        .set(updateData)
        .where(and(eq(sales.businessId, businessId), eq(sales.id, id)));

      return this.getById(businessId, id);
    },

    async deleteItems(businessId: string, saleId: string): Promise<void> {
      // Eliminar movimientos de inventario de esta venta
      await db
        .delete(inventoryMovements)
        .where(
          and(
            eq(inventoryMovements.businessId, businessId),
            eq(inventoryMovements.referenceId, saleId),
          ),
        );

      // Eliminar items de la venta
      await db.delete(saleItems).where(eq(saleItems.saleId, saleId));
    },

    async insertItems(businessId: string, saleId: string, items: NewSaleItem[]): Promise<void> {
      if (items.length === 0) return;
      await db.insert(saleItems).values(
        items.map((it) => ({
          id: it.id,
          saleId: it.saleId,
          flavorId: it.flavorId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          unitCostSnapshot: it.unitCostSnapshot,
          subtotal: it.subtotal,
        })),
      );
    },

    async insertMovements(
      businessId: string,
      movements: {
        id: string;
        flavorId: string;
        movementType: string;
        quantity: number;
        unitCost: number | null;
        referenceId: string | null;
        date: string;
        notes: string | null;
      }[],
    ): Promise<void> {
      if (movements.length === 0) return;
      await db.insert(inventoryMovements).values(
        movements.map((m) => ({
          id: m.id,
          businessId,
          flavorId: m.flavorId,
          movementType: m.movementType,
          quantity: m.quantity,
          unitCost: m.unitCost,
          referenceId: m.referenceId,
          date: m.date,
          notes: m.notes,
          createdAt: new Date().toISOString(),
        })),
      );
    },
  };
}
