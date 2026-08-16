import type { BatchStatement, Db, SqlValue } from "../db/types";
import type { Supplier } from "../domain/types";

const SUPPLIER_SELECT = `
  SELECT
    id, business_id AS businessId, name, contact, notes, active,
    created_at AS createdAt, updated_at AS updatedAt
  FROM suppliers
`;

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

export function createSupplierRepository(db: Db) {
  return {
    buildCreateStatements(supplier: NewSupplier): BatchStatement[] {
      const now = new Date().toISOString();
      return [
        {
          sql: `INSERT INTO suppliers
            (id, business_id, name, contact, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
          params: [
            supplier.id,
            supplier.businessId,
            supplier.name,
            supplier.contact,
            supplier.notes,
            now,
            now,
          ],
        },
      ];
    },

    async create(supplier: NewSupplier): Promise<Supplier> {
      const st = this.buildCreateStatements(supplier)[0]!;
      await db.run(st.sql, st.params);
      return mapSupplier({
        ...supplier,
        active: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    },

    async list(businessId: string, includeInactive = false): Promise<Supplier[]> {
      const rows = await db.all<SupplierRow>(
        `${SUPPLIER_SELECT}
         WHERE business_id = ? ${includeInactive ? "" : "AND active = 1"}
         ORDER BY name`,
        [businessId],
      );
      return rows.map(mapSupplier);
    },

    async getById(businessId: string, id: string): Promise<Supplier | null> {
      const row = await db.first<SupplierRow>(
        `${SUPPLIER_SELECT} WHERE business_id = ? AND id = ?`,
        [businessId, id],
      );
      return row ? mapSupplier(row) : null;
    },

    async update(
      businessId: string,
      id: string,
      input: Partial<Pick<Supplier, "name" | "contact" | "notes" | "active">>,
    ): Promise<Supplier | null> {
      const sets: string[] = ["updated_at = ?"];
      const params: SqlValue[] = [new Date().toISOString()];
      for (const [key, value] of Object.entries(input)) {
        if (value === undefined) continue;
        sets.push(`${key} = ?`);
        params.push(typeof value === "boolean" ? (value ? 1 : 0) : (value as SqlValue));
      }
      params.push(businessId, id);
      await db.run(
        `UPDATE suppliers SET ${sets.join(", ")} WHERE business_id = ? AND id = ?`,
        params,
      );
      return this.getById(businessId, id);
    },
  };
}
