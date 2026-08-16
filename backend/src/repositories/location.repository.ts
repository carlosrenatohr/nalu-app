import { eq, and, asc } from "drizzle-orm";
import type { DrizzleDb } from "../db/drizzle-types";
import { locations } from "../db/schema";
import type { Location } from "../domain/types";
import { newId } from "../utils/ids";

export function createLocationRepository(db: DrizzleDb) {
  return {
    async list(businessId: string, includeInactive = false): Promise<Location[]> {
      const conditions = [eq(locations.businessId, businessId)];
      if (!includeInactive) {
        conditions.push(eq(locations.active, 1));
      }
      const rows: { id: string; businessId: string; name: string; active: number }[] = await db
        .select({
          id: locations.id,
          businessId: locations.businessId,
          name: locations.name,
          active: locations.active,
        })
        .from(locations)
        .where(and(...conditions))
        .orderBy(asc(locations.name));
      return rows.map((r) => ({ ...r, active: r.active === 1 }));
    },

    async create(
      businessId: string,
      input: { name: string },
    ): Promise<Location> {
      const id = newId();
      const now = new Date().toISOString();
      await db.insert(locations).values({
        id,
        businessId,
        name: input.name,
        createdAt: now,
        updatedAt: now,
      });
      return { id, businessId, name: input.name, active: true };
    },

    async update(
      businessId: string,
      id: string,
      input: { name?: string; active?: boolean },
    ): Promise<Location | null> {
      const updateData: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      if (input.name !== undefined) updateData.name = input.name;
      if (input.active !== undefined) updateData.active = input.active ? 1 : 0;

      await db
        .update(locations)
        .set(updateData)
        .where(and(eq(locations.businessId, businessId), eq(locations.id, id)));

      return this.list(businessId, true).then(
        (rows) => rows.find((l) => l.id === id) ?? null,
      );
    },
  };
}
