import { eq, and, asc, inArray } from "drizzle-orm";
import type { DrizzleDb } from "../db/drizzle-types";
import { flavors, inventoryMovements, saleItems, sales, purchaseItems, purchases } from "../db/schema";
import type { Flavor } from "../domain/types";

interface FlavorRow {
  id: string;
  businessId: string;
  name: string;
  slug: string;
  emoji: string | null;
  color: string | null;
  costPrice: number | null;
  salePrice: number | null;
  minStock: number;
  active: number;
  createdAt: string;
  updatedAt: string;
}

function mapFlavor(row: FlavorRow): Flavor {
  return { ...row, active: row.active === 1 };
}

export interface NewFlavor {
  id: string;
  businessId: string;
  name: string;
  slug: string;
  emoji: string | null;
  color: string | null;
  costPrice: number | null;
  salePrice: number | null;
  minStock: number;
}

export function createFlavorRepository(db: DrizzleDb) {
  return {
    async create(flavor: NewFlavor): Promise<Flavor> {
      const now = new Date().toISOString();
      await db.insert(flavors).values({
        id: flavor.id,
        businessId: flavor.businessId,
        name: flavor.name,
        slug: flavor.slug,
        emoji: flavor.emoji,
        color: flavor.color,
        costPrice: flavor.costPrice,
        salePrice: flavor.salePrice,
        minStock: flavor.minStock,
        createdAt: now,
        updatedAt: now,
      });
      return mapFlavor({
        ...flavor,
        active: 1,
        createdAt: now,
        updatedAt: now,
      });
    },

    async list(businessId: string, includeInactive = false): Promise<Flavor[]> {
      const conditions = [eq(flavors.businessId, businessId)];
      if (!includeInactive) {
        conditions.push(eq(flavors.active, 1));
      }
      const rows: FlavorRow[] = await db
        .select()
        .from(flavors)
        .where(and(...conditions))
        .orderBy(asc(flavors.name));
      return rows.map(mapFlavor);
    },

    async getById(businessId: string, id: string): Promise<Flavor | null> {
      const rows: FlavorRow[] = await db
        .select()
        .from(flavors)
        .where(and(eq(flavors.businessId, businessId), eq(flavors.id, id)));
      const row = rows[0] ?? null;
      return row ? mapFlavor(row) : null;
    },

    /** Valida que todos los ids existan; devuelve los sabores encontrados. */
    async getByIds(businessId: string, ids: string[]): Promise<Flavor[]> {
      if (ids.length === 0) return [];
      const rows: FlavorRow[] = await db
        .select()
        .from(flavors)
        .where(
          and(eq(flavors.businessId, businessId), inArray(flavors.id, ids)),
        );
      return rows.map(mapFlavor);
    },

    async update(
      businessId: string,
      id: string,
      input: Partial<Pick<Flavor, "name" | "slug" | "emoji" | "color" | "costPrice" | "salePrice" | "minStock" | "active">>,
    ): Promise<Flavor | null> {
      const updateData: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      if (input.name !== undefined) updateData.name = input.name;
      if (input.slug !== undefined) updateData.slug = input.slug;
      if (input.emoji !== undefined) updateData.emoji = input.emoji;
      if (input.color !== undefined) updateData.color = input.color;
      if (input.costPrice !== undefined) updateData.costPrice = input.costPrice;
      if (input.salePrice !== undefined) updateData.salePrice = input.salePrice;
      if (input.minStock !== undefined) updateData.minStock = input.minStock;
      if (input.active !== undefined) updateData.active = input.active ? 1 : 0;

      await db
        .update(flavors)
        .set(updateData)
        .where(and(eq(flavors.businessId, businessId), eq(flavors.id, id)));

      return this.getById(businessId, id);
    },

    /**
     * Indica si el sabor tiene referencias históricas (movimientos de
     * inventario, ítems de ventas o de compras). Si las tiene, no puede
     * borrarse físicamente sin romper el historial → se archiva.
     */
    async hasReferences(businessId: string, id: string): Promise<boolean> {
      const [mov, sale, purchase] = await Promise.all([
        db
          .select({ id: inventoryMovements.id })
          .from(inventoryMovements)
          .where(
            and(eq(inventoryMovements.businessId, businessId), eq(inventoryMovements.flavorId, id)),
          )
          .limit(1),
        db
          .select({ id: saleItems.id })
          .from(saleItems)
          .innerJoin(sales, eq(sales.id, saleItems.saleId))
          .where(and(eq(sales.businessId, businessId), eq(saleItems.flavorId, id)))
          .limit(1),
        db
          .select({ id: purchaseItems.id })
          .from(purchaseItems)
          .innerJoin(purchases, eq(purchases.id, purchaseItems.purchaseId))
          .where(and(eq(purchases.businessId, businessId), eq(purchaseItems.flavorId, id)))
          .limit(1),
      ]);
      return mov.length > 0 || sale.length > 0 || purchase.length > 0;
    },

    async delete(businessId: string, id: string): Promise<void> {
      await db
        .delete(flavors)
        .where(and(eq(flavors.businessId, businessId), eq(flavors.id, id)));
    },
  };
}
