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

/** Columnas comunes al listar ventas (una sola fuente de verdad). */
const SALE_COLUMNS = {
  id: sales.id,
  businessId: sales.businessId,
  saleDate: sales.saleDate,
  location: sales.location,
  notes: sales.notes,
  total: sales.total,
  paymentType: sales.paymentType,
  createdAt: sales.createdAt,
  updatedAt: sales.updatedAt,
};

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
        .select(SALE_COLUMNS)
        .from(sales)
        .where(and(...conditions))
        .orderBy(sql`${sales.saleDate} DESC, ${sales.createdAt} DESC`);

      return this.attachItems(saleRows as unknown as Sale[]);
    },

    /**
     * Versión paginada de list: devuelve la página pedida y el total de
     * coincidencias para que el cliente sepa si quedan más ("Cargar más").
     * Mismo orden que list (fecha de venta y creación descendentes).
     */
    async listPaged(
      businessId: string,
      from: string | undefined,
      to: string | undefined,
      page: number,
      limit: number,
    ): Promise<{ items: Sale[]; total: number }> {
      const conditions = [eq(sales.businessId, businessId)];
      if (from) conditions.push(sql`${sales.saleDate} >= ${from}`);
      if (to) conditions.push(sql`${sales.saleDate} <= ${to}`);
      const where = and(...conditions);

      const countRows = await db
        .select({ total: sql<number>`count(*)` })
        .from(sales)
        .where(where);
      const total = Number(countRows[0]?.total ?? 0);

      const saleRows = await db
        .select(SALE_COLUMNS)
        .from(sales)
        .where(where)
        .orderBy(sql`${sales.saleDate} DESC, ${sales.createdAt} DESC`)
        .limit(limit)
        .offset((page - 1) * limit);

      return { items: await this.attachItems(saleRows as unknown as Sale[]), total };
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
          paymentType: sales.paymentType,
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

    async deleteStatements(businessId: string, id: string): Promise<unknown[]> {
      // Eliminar movimientos de inventario asociados a esta venta
      const delMovements = db
        .delete(inventoryMovements)
        .where(
          and(
            eq(inventoryMovements.businessId, businessId),
            eq(inventoryMovements.referenceId, id),
          ),
        );

      // Eliminar items (ON DELETE CASCADE se encarga, pero lo hacemos explícito)
      const delItems = db.delete(saleItems).where(eq(saleItems.saleId, id));

      // Eliminar la venta
      const delSale = db
        .delete(sales)
        .where(and(eq(sales.businessId, businessId), eq(sales.id, id)));

      return [delMovements, delItems, delSale];
    },

    updateStatements(
      businessId: string,
      id: string,
      input: {
        saleDate?: string;
        location?: string;
        notes?: string | null;
        total?: number;
        paymentType?: string;
      },
    ): unknown {
      const updateData: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      if (input.saleDate !== undefined) updateData.saleDate = input.saleDate;
      if (input.location !== undefined) updateData.location = input.location;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.total !== undefined) updateData.total = input.total;
      if (input.paymentType !== undefined) updateData.paymentType = input.paymentType;

      return db
        .update(sales)
        .set(updateData)
        .where(and(eq(sales.businessId, businessId), eq(sales.id, id)));
    },

    async deleteItemsStatements(businessId: string, saleId: string): Promise<unknown[]> {
      // Eliminar movimientos de inventario de esta venta
      const delMovements = db
        .delete(inventoryMovements)
        .where(
          and(
            eq(inventoryMovements.businessId, businessId),
            eq(inventoryMovements.referenceId, saleId),
          ),
        );

      // Eliminar items de la venta
      const delItems = db.delete(saleItems).where(eq(saleItems.saleId, saleId));

      return [delMovements, delItems];
    },

    async insertItemsStatements(businessId: string, saleId: string, items: NewSaleItem[]): Promise<unknown[]> {
      void businessId;
      void saleId;
      if (items.length === 0) return [];
      return [
        db.insert(saleItems).values(
          items.map((it) => ({
            id: it.id,
            saleId: it.saleId,
            flavorId: it.flavorId,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            unitCostSnapshot: it.unitCostSnapshot,
            subtotal: it.subtotal,
          })),
        ),
      ];
    },

    async insertMovementsStatements(
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
    ): Promise<unknown[]> {
      if (movements.length === 0) return [];
      return [
        db.insert(inventoryMovements).values(
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
        ),
      ];
    },
  };
}
