import type { Db } from "../db/types";
import type { Location } from "../domain/types";
import { newId } from "../utils/ids";

const LOCATION_SELECT = `
  SELECT id, business_id AS businessId, name, active
  FROM locations
`;

export function createLocationRepository(db: Db) {
  return {
    async list(businessId: string, includeInactive = false): Promise<Location[]> {
      const rows = await db.all<{
        id: string;
        businessId: string;
        name: string;
        active: number;
      }>(
        `${LOCATION_SELECT}
         WHERE business_id = ? ${includeInactive ? "" : "AND active = 1"}
         ORDER BY name`,
        [businessId],
      );
      return rows.map((r) => ({ ...r, active: r.active === 1 }));
    },

    async create(
      businessId: string,
      input: { name: string },
    ): Promise<Location> {
      const id = newId();
      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO locations (id, business_id, name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, businessId, input.name, now, now],
      );
      return { id, businessId, name: input.name, active: true };
    },

    async update(
      businessId: string,
      id: string,
      input: { name?: string; active?: boolean },
    ): Promise<Location | null> {
      const sets: string[] = ["updated_at = ?"];
      const params: (string | number)[] = [new Date().toISOString()];
      if (input.name !== undefined) {
        sets.push("name = ?");
        params.push(input.name);
      }
      if (input.active !== undefined) {
        sets.push("active = ?");
        params.push(input.active ? 1 : 0);
      }
      params.push(businessId, id);
      await db.run(
        `UPDATE locations SET ${sets.join(", ")} WHERE business_id = ? AND id = ?`,
        params,
      );
      return this.list(businessId, true).then(
        (rows) => rows.find((l) => l.id === id) ?? null,
      );
    },
  };
}
