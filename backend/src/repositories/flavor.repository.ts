import { eq, and, asc, inArray } from "drizzle-orm";
import type { DrizzleDb } from "../db/drizzle-types";
import { flavors } from "../db/schema";
import type { Flavor } from "../domain/types";

interface FlavorRow {
  id: string;
  businessId: string;
  name: string;
  slug: string;
  emoji: string | null;
  color: string | null;
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
      input: Partial<Pick<Flavor, "name" | "slug" | "emoji" | "color" | "minStock" | "active">>,
    ): Promise<Flavor | null> {
      const updateData: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      if (input.name !== undefined) updateData.name = input.name;
      if (input.slug !== undefined) updateData.slug = input.slug;
      if (input.emoji !== undefined) updateData.emoji = input.emoji;
      if (input.color !== undefined) updateData.color = input.color;
      if (input.minStock !== undefined) updateData.minStock = input.minStock;
      if (input.active !== undefined) updateData.active = input.active ? 1 : 0;

      await db
        .update(flavors)
        .set(updateData)
        .where(and(eq(flavors.businessId, businessId), eq(flavors.id, id)));

      return this.getById(businessId, id);
    },
  };
}
