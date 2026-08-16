import { eq, and, asc } from "drizzle-orm";
import type { DrizzleDb } from "../db/drizzle-types";
import { suppliers } from "../db/schema";
import type { Supplier } from "../domain/types";

interface SupplierRow {
  id: string;
  businessId: string;
  name: string;
  contact: string | null;
  notes: string | null;
  active: number;
  createdAt: string;
  updatedAt: string;
}

function mapSupplier(row: SupplierRow): Supplier {
  return { ...row, active: row.active === 1 };
}

export interface NewSupplier {
  id: string;
  businessId: string;
  name: string;
  contact: string | null;
  notes: string | null;
}

export function createSupplierRepository(db: DrizzleDb) {
  return {
    async create(supplier: NewSupplier): Promise<Supplier> {
      const now = new Date().toISOString();
      await db.insert(suppliers).values({
        id: supplier.id,
        businessId: supplier.businessId,
        name: supplier.name,
        contact: supplier.contact,
        notes: supplier.notes,
        createdAt: now,
        updatedAt: now,
      });
      return mapSupplier({
        ...supplier,
        active: 1,
        createdAt: now,
        updatedAt: now,
      });
    },

    async list(businessId: string, includeInactive = false): Promise<Supplier[]> {
      const conditions = [eq(suppliers.businessId, businessId)];
      if (!includeInactive) {
        conditions.push(eq(suppliers.active, 1));
      }
      const rows: SupplierRow[] = await db
        .select()
        .from(suppliers)
        .where(and(...conditions))
        .orderBy(asc(suppliers.name));
      return rows.map(mapSupplier);
    },

    async getById(businessId: string, id: string): Promise<Supplier | null> {
      const row = await db
        .select()
        .from(suppliers)
        .where(and(eq(suppliers.businessId, businessId), eq(suppliers.id, id)))
        .then((rows: SupplierRow[]) => rows[0] ?? null);
      return row ? mapSupplier(row) : null;
    },

    async update(
      businessId: string,
      id: string,
      input: Partial<Pick<Supplier, "name" | "contact" | "notes" | "active">>,
    ): Promise<Supplier | null> {
      const updateData: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      if (input.name !== undefined) updateData.name = input.name;
      if (input.contact !== undefined) updateData.contact = input.contact;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.active !== undefined) updateData.active = input.active ? 1 : 0;

      await db
        .update(suppliers)
        .set(updateData)
        .where(and(eq(suppliers.businessId, businessId), eq(suppliers.id, id)));

      return this.getById(businessId, id);
    },
  };
}
