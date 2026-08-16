import type { BatchStatement, Db } from "../db/types";
import type { InventoryMovement, MovementType } from "../domain/types";

const MOVEMENT_SELECT = `
  SELECT
    m.id, m.business_id AS businessId, m.flavor_id AS flavorId,
    f.name AS flavorName, m.movement_type AS movementType,
    m.quantity, m.unit_cost AS unitCost, m.reference_id AS referenceId,
    m.date, m.notes, m.created_at AS createdAt
  FROM inventory_movements m
  JOIN flavors f ON f.id = m.flavor_id
`;

export interface NewMovement {
  id: string;
  businessId: string;
  flavorId: string;
  movementType: MovementType;
  /** Cantidad CON SIGNO: positivo = entrada, negativo = salida. */
  quantity: number;
  unitCost: number | null;
  referenceId: string | null;
  date: string;
  notes: string | null;
}

interface MovementRow {
  id: string;
  businessId: string;
  flavorId: string;
  flavorName: string;
  movementType: MovementType;
  quantity: number;
  unitCost: number | null;
  referenceId: string | null;
  date: string;
  notes: string | null;
  createdAt: string;
}

export function createMovementRepository(db: Db) {
  return {
    buildCreateStatements(movements: NewMovement[]): BatchStatement[] {
      return movements.map((m) => ({
        sql: `INSERT INTO inventory_movements
          (id, business_id, flavor_id, movement_type, quantity, unit_cost,
           reference_id, date, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          m.id,
          m.businessId,
          m.flavorId,
          m.movementType,
          m.quantity,
          m.unitCost,
          m.referenceId,
          m.date,
          m.notes,
          new Date().toISOString(),
        ],
      }));
    },

    async create(movement: NewMovement): Promise<InventoryMovement> {
      const st = this.buildCreateStatements([movement])[0]!;
      await db.run(st.sql, st.params);
      return {
        ...movement,
        flavorName: undefined,
        createdAt: new Date().toISOString(),
      } as InventoryMovement;
    },

    /** Disponibilidad por sabor: suma de cantidades firmadas. */
    async availabilityByFlavor(
      businessId: string,
      flavorIds: string[],
    ): Promise<Map<string, number>> {
      if (flavorIds.length === 0) return new Map();
      const placeholders = flavorIds.map(() => "?").join(", ");
      const rows = await db.all<{ flavorId: string; available: number }>(
        `SELECT flavor_id AS flavorId, COALESCE(SUM(quantity), 0) AS available
         FROM inventory_movements
         WHERE business_id = ? AND flavor_id IN (${placeholders})
         GROUP BY flavor_id`,
        [businessId, ...flavorIds],
      );
      return new Map(rows.map((r) => [r.flavorId, r.available]));
    },

    /**
     * Totales por sabor y tipo de movimiento.
     * Devuelve Map<saborId, Map<tipo, total>>.
     */
    async totalsByType(
      businessId: string,
    ): Promise<Map<string, Map<MovementType, number>>> {
      const rows = await db.all<{ flavorId: string; movementType: MovementType; total: number }>(
        `SELECT flavor_id AS flavorId, movement_type AS movementType, SUM(quantity) AS total
         FROM inventory_movements
         WHERE business_id = ?
         GROUP BY flavor_id, movement_type`,
        [businessId],
      );
      const result = new Map<string, Map<MovementType, number>>();
      for (const row of rows) {
        const byType = result.get(row.flavorId) ?? new Map<MovementType, number>();
        byType.set(row.movementType, row.total);
        result.set(row.flavorId, byType);
      }
      return result;
    },

    /** Costo promedio ponderado por sabor (solo compras). */
    async avgCostByFlavor(
      businessId: string,
    ): Promise<Map<string, number>> {
      const rows = await db.all<{ flavorId: string; avgCost: number }>(
        `SELECT flavor_id AS flavorId,
                SUM(quantity * unit_cost) / SUM(quantity) AS avgCost
         FROM inventory_movements
         WHERE business_id = ? AND movement_type = 'PURCHASE'
           AND unit_cost IS NOT NULL
         GROUP BY flavor_id`,
        [businessId],
      );
      return new Map(rows.map((r) => [r.flavorId, r.avgCost]));
    },

    /** Último costo de compra por sabor. */
    async lastPurchaseCost(
      businessId: string,
    ): Promise<Map<string, number>> {
      const rows = await db.all<{ flavorId: string; unitCost: number }>(
        `SELECT flavor_id AS flavorId, unit_cost AS unitCost
         FROM inventory_movements
         WHERE business_id = ? AND movement_type = 'PURCHASE'
           AND unit_cost IS NOT NULL
         ORDER BY date DESC, created_at DESC`,
        [businessId],
      );
      const result = new Map<string, number>();
      for (const row of rows) {
        if (!result.has(row.flavorId)) {
          result.set(row.flavorId, row.unitCost);
        }
      }
      return result;
    },

    async listByFlavor(
      businessId: string,
      flavorId: string,
      limit = 100,
    ): Promise<InventoryMovement[]> {
      const rows = await db.all<MovementRow>(
        `${MOVEMENT_SELECT}
         WHERE m.business_id = ? AND m.flavor_id = ?
         ORDER BY m.date DESC, m.created_at DESC
         LIMIT ?`,
        [businessId, flavorId, limit],
      );
      return rows;
    },

    async listRecent(businessId: string, limit = 50): Promise<InventoryMovement[]> {
      const rows = await db.all<MovementRow>(
        `${MOVEMENT_SELECT}
         WHERE m.business_id = ?
         ORDER BY m.date DESC, m.created_at DESC
         LIMIT ?`,
        [businessId, limit],
      );
      return rows;
    },
  };
}
