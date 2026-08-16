import { eq, and, sql } from "drizzle-orm";
import type { DrizzleDb } from "../db/drizzle-types";
import { inventoryMovements, flavors } from "../db/schema";
import type { InventoryMovement, MovementType } from "../domain/types";

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

export function createMovementRepository(db: DrizzleDb) {
  return {
    async create(movement: NewMovement): Promise<InventoryMovement> {
      await db.insert(inventoryMovements).values({
        id: movement.id,
        businessId: movement.businessId,
        flavorId: movement.flavorId,
        movementType: movement.movementType,
        quantity: movement.quantity,
        unitCost: movement.unitCost,
        referenceId: movement.referenceId,
        date: movement.date,
        notes: movement.notes,
        createdAt: new Date().toISOString(),
      });
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
      const rows = await db
        .select({
          flavorId: inventoryMovements.flavorId,
          available: sql<number>`COALESCE(SUM(${inventoryMovements.quantity}), 0)`.as("available"),
        })
        .from(inventoryMovements)
        .where(
          and(
            eq(inventoryMovements.businessId, businessId),
            sql`${inventoryMovements.flavorId} IN ${flavorIds}`,
          ),
        )
        .groupBy(inventoryMovements.flavorId);
      return new Map(rows.map((r: { flavorId: string; available: unknown }) => [r.flavorId, Number(r.available)]));
    },

    /**
     * Totales por sabor y tipo de movimiento.
     * Devuelve Map<saborId, Map<tipo, total>>.
     */
    async totalsByType(
      businessId: string,
    ): Promise<Map<string, Map<MovementType, number>>> {
      const rows = await db
        .select({
          flavorId: inventoryMovements.flavorId,
          movementType: inventoryMovements.movementType,
          total: sql<string>`SUM(${inventoryMovements.quantity})`.as("total"),
        })
        .from(inventoryMovements)
        .where(eq(inventoryMovements.businessId, businessId))
        .groupBy(inventoryMovements.flavorId, inventoryMovements.movementType);

      const result = new Map<string, Map<MovementType, number>>();
      for (const row of rows) {
        const byType = result.get(row.flavorId) ?? new Map<MovementType, number>();
        byType.set(row.movementType as MovementType, Number(row.total));
        result.set(row.flavorId, byType);
      }
      return result;
    },

    /** Costo promedio ponderado por sabor (solo compras). */
    async avgCostByFlavor(
      businessId: string,
    ): Promise<Map<string, number>> {
      const rows = await db
        .select({
          flavorId: inventoryMovements.flavorId,
          avgCost: sql<string>`SUM(${inventoryMovements.quantity} * ${inventoryMovements.unitCost}) / SUM(${inventoryMovements.quantity})`.as("avgCost"),
        })
        .from(inventoryMovements)
        .where(
          and(
            eq(inventoryMovements.businessId, businessId),
            eq(inventoryMovements.movementType, "PURCHASE"),
            sql`${inventoryMovements.unitCost} IS NOT NULL`,
          ),
        )
        .groupBy(inventoryMovements.flavorId);
      return new Map(rows.map((r: { flavorId: string; avgCost: unknown }) => [r.flavorId, Number(r.avgCost)]));
    },

    /** Último costo de compra por sabor. */
    async lastPurchaseCost(
      businessId: string,
    ): Promise<Map<string, number>> {
      const rows = await db
        .select({
          flavorId: inventoryMovements.flavorId,
          unitCost: inventoryMovements.unitCost,
        })
        .from(inventoryMovements)
        .where(
          and(
            eq(inventoryMovements.businessId, businessId),
            eq(inventoryMovements.movementType, "PURCHASE"),
            sql`${inventoryMovements.unitCost} IS NOT NULL`,
          ),
        )
        .orderBy(sql`${inventoryMovements.date} DESC, ${inventoryMovements.createdAt} DESC`);

      const result = new Map<string, number>();
      for (const row of rows) {
        if (!result.has(row.flavorId) && row.unitCost !== null) {
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
      const rows = await db
        .select({
          id: inventoryMovements.id,
          businessId: inventoryMovements.businessId,
          flavorId: inventoryMovements.flavorId,
          flavorName: flavors.name,
          movementType: inventoryMovements.movementType,
          quantity: inventoryMovements.quantity,
          unitCost: inventoryMovements.unitCost,
          referenceId: inventoryMovements.referenceId,
          date: inventoryMovements.date,
          notes: inventoryMovements.notes,
          createdAt: inventoryMovements.createdAt,
        })
        .from(inventoryMovements)
        .innerJoin(flavors, eq(flavors.id, inventoryMovements.flavorId))
        .where(
          and(
            eq(inventoryMovements.businessId, businessId),
            eq(inventoryMovements.flavorId, flavorId),
          ),
        )
        .orderBy(sql`${inventoryMovements.date} DESC, ${inventoryMovements.createdAt} DESC`)
        .limit(limit);
      return rows as InventoryMovement[];
    },

    async listRecent(businessId: string, limit = 50): Promise<InventoryMovement[]> {
      const rows = await db
        .select({
          id: inventoryMovements.id,
          businessId: inventoryMovements.businessId,
          flavorId: inventoryMovements.flavorId,
          flavorName: flavors.name,
          movementType: inventoryMovements.movementType,
          quantity: inventoryMovements.quantity,
          unitCost: inventoryMovements.unitCost,
          referenceId: inventoryMovements.referenceId,
          date: inventoryMovements.date,
          notes: inventoryMovements.notes,
          createdAt: inventoryMovements.createdAt,
        })
        .from(inventoryMovements)
        .innerJoin(flavors, eq(flavors.id, inventoryMovements.flavorId))
        .where(eq(inventoryMovements.businessId, businessId))
        .orderBy(sql`${inventoryMovements.date} DESC, ${inventoryMovements.createdAt} DESC`)
        .limit(limit);
      return rows as InventoryMovement[];
    },
  };
}
