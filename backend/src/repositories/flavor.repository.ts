import type { BatchStatement, Db, SqlValue } from "../db/types";
import type { Flavor } from "../domain/types";

const FLAVOR_SELECT = `
  SELECT
    id, business_id AS businessId, name, slug, emoji, color,
    min_stock AS minStock, active,
    created_at AS createdAt, updated_at AS updatedAt
  FROM flavors
`;

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

export function createFlavorRepository(db: Db) {
  return {
    buildCreateStatements(flavor: NewFlavor): BatchStatement[] {
      const now = new Date().toISOString();
      return [
        {
          sql: `INSERT INTO flavors
            (id, business_id, name, slug, emoji, color, min_stock, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [
            flavor.id,
            flavor.businessId,
            flavor.name,
            flavor.slug,
            flavor.emoji,
            flavor.color,
            flavor.minStock,
            now,
            now,
          ],
        },
      ];
    },

    async create(flavor: NewFlavor): Promise<Flavor> {
      await db.run(this.buildCreateStatements(flavor)[0]!.sql, this.buildCreateStatements(flavor)[0]!.params);
      return mapFlavor({
        ...flavor,
        active: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    },

    async list(businessId: string, includeInactive = false): Promise<Flavor[]> {
      const rows = await db.all<FlavorRow>(
        `${FLAVOR_SELECT}
         WHERE business_id = ? ${includeInactive ? "" : "AND active = 1"}
         ORDER BY name`,
        [businessId],
      );
      return rows.map(mapFlavor);
    },

    async getById(businessId: string, id: string): Promise<Flavor | null> {
      const row = await db.first<FlavorRow>(
        `${FLAVOR_SELECT} WHERE business_id = ? AND id = ?`,
        [businessId, id],
      );
      return row ? mapFlavor(row) : null;
    },

    /** Valida que todos los ids existan; devuelve los sabores encontrados. */
    async getByIds(businessId: string, ids: string[]): Promise<Flavor[]> {
      if (ids.length === 0) return [];
      const placeholders = ids.map(() => "?").join(", ");
      const rows = await db.all<FlavorRow>(
        `${FLAVOR_SELECT} WHERE business_id = ? AND id IN (${placeholders})`,
        [businessId, ...ids],
      );
      return rows.map(mapFlavor);
    },

    async update(
      businessId: string,
      id: string,
      input: Partial<Pick<Flavor, "name" | "slug" | "emoji" | "color" | "minStock" | "active">>,
    ): Promise<Flavor | null> {
      const sets: string[] = ["updated_at = ?"];
      const params: SqlValue[] = [new Date().toISOString()];
      const columnMap: Record<string, string> = {
        name: "name",
        slug: "slug",
        emoji: "emoji",
        color: "color",
        minStock: "min_stock",
        active: "active",
      };
      for (const [key, value] of Object.entries(input)) {
        if (value === undefined) continue;
        const column = columnMap[key];
        if (!column) continue;
        sets.push(`${column} = ?`);
        params.push(typeof value === "boolean" ? (value ? 1 : 0) : (value as SqlValue));
      }
      params.push(businessId, id);
      await db.run(
        `UPDATE flavors SET ${sets.join(", ")} WHERE business_id = ? AND id = ?`,
        params,
      );
      return this.getById(businessId, id);
    },
  };
}
