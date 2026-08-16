import { eq, asc } from "drizzle-orm";
import type { DrizzleDb } from "../db/drizzle-types";
import { businesses } from "../db/schema";
import type { Business } from "../domain/types";

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
    | "alertEmail"
  >
>;

export function createBusinessRepository(db: DrizzleDb) {
  return {
    async getDefault(): Promise<Business | null> {
      const rows: Record<string, unknown>[] = await db
        .select()
        .from(businesses)
        .orderBy(asc(businesses.createdAt));
      const row = rows[0] ?? null;
      if (!row) return null;
      return {
        id: row.id as string,
        name: row.name as string,
        currency: row.currency as string,
        defaultPurchaseCost: row.defaultPurchaseCost as number,
        defaultHomePrice: row.defaultHomePrice as number,
        primaryColor: row.primaryColor as string,
        secondaryColor: row.secondaryColor as string,
        contact: row.contact as string | null,
        reportFooter: row.reportFooter as string | null,
        alertEmail: row.alertEmail as string | null,
        createdAt: row.createdAt as string,
        updatedAt: row.updatedAt as string,
      };
    },

    async update(id: string, input: BusinessUpdate): Promise<Business | null> {
      const updateData: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      if (input.name !== undefined) updateData.name = input.name;
      if (input.currency !== undefined) updateData.currency = input.currency;
      if (input.defaultPurchaseCost !== undefined) updateData.defaultPurchaseCost = input.defaultPurchaseCost;
      if (input.defaultHomePrice !== undefined) updateData.defaultHomePrice = input.defaultHomePrice;
      if (input.primaryColor !== undefined) updateData.primaryColor = input.primaryColor;
      if (input.secondaryColor !== undefined) updateData.secondaryColor = input.secondaryColor;
      if (input.contact !== undefined) updateData.contact = input.contact;
      if (input.reportFooter !== undefined) updateData.reportFooter = input.reportFooter;
      if (input.alertEmail !== undefined) updateData.alertEmail = input.alertEmail;

      await db.update(businesses).set(updateData).where(eq(businesses.id, id));
      return this.getDefault();
    },
  };
}
