import { eq } from "drizzle-orm";
import type { DrizzleDb } from "../db/drizzle-types";
import { syncOperations } from "../db/schema";

export function createSyncRepository(db: DrizzleDb) {
  return {
    async exists(opId: string): Promise<boolean> {
      const result = await db
        .select({ opId: syncOperations.opId })
        .from(syncOperations)
        .where(eq(syncOperations.opId, opId))
        .then((rows: { opId: string }[]) => rows[0] ?? null);
      return result !== null;
    },

    async create(op: {
      opId: string;
      operationType: string;
      entityType: string;
      entityId: string;
    }): Promise<void> {
      await db.insert(syncOperations).values({
        opId: op.opId,
        operationType: op.operationType,
        entityType: op.entityType,
        entityId: op.entityId,
        status: "applied",
        createdAt: new Date().toISOString(),
      });
    },
  };
}

/** Detecta violaciones de unicidad (reintento de una operación ya aplicada). */
export function isConstraintError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message.includes("UNIQUE constraint failed") ||
      err.message.includes("constraint failed"))
  );
}
