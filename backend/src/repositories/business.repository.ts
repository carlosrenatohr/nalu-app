import type { Db, SqlValue } from "../db/types";
import type { Business } from "../domain/types";

const BUSINESS_SELECT = `
  SELECT
    id, name, currency,
    default_purchase_cost AS defaultPurchaseCost,
    default_home_price AS defaultHomePrice,
    primary_color AS primaryColor,
    secondary_color AS secondaryColor,
    contact,
    report_footer AS reportFooter,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM businesses
`;

export type BusinessUpdate = Partial<
  Pick<
    Business,
    | "name"
    | "currency"
    | "defaultPurchaseCost"
    | "defaultHomePrice"
    | "primaryColor"
    | "secondaryColor"
    | "contact"
    | "reportFooter"
  >
>;

// Mapa de campos del dominio → columnas de la base
const COLUMN_MAP: Record<keyof BusinessUpdate, string> = {
  name: "name",
  currency: "currency",
  defaultPurchaseCost: "default_purchase_cost",
  defaultHomePrice: "default_home_price",
  primaryColor: "primary_color",
  secondaryColor: "secondary_color",
  contact: "contact",
  reportFooter: "report_footer",
};

export function createBusinessRepository(db: Db) {
  return {
    async getDefault(): Promise<Business | null> {
      return db.first<Business>(`${BUSINESS_SELECT} ORDER BY created_at LIMIT 1`);
    },

    async update(id: string, input: BusinessUpdate): Promise<Business | null> {
      const sets: string[] = ["updated_at = ?"];
      const params: SqlValue[] = [new Date().toISOString()];
      for (const [key, value] of Object.entries(input)) {
        if (value === undefined) continue;
        const column = COLUMN_MAP[key as keyof BusinessUpdate];
        if (!column) continue;
        sets.push(`${column} = ?`);
        params.push(value as SqlValue);
      }
      params.push(id);
      await db.run(`UPDATE businesses SET ${sets.join(", ")} WHERE id = ?`, params);
      return this.getDefault();
    },
  };
}
