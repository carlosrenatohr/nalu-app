import type { BatchStatement, Db } from "../db/types";

export function createSyncRepository(db: Db) {
  return {
    async exists(opId: string): Promise<boolean> {
      const row = await db.first<{ n: number }>(
        "SELECT 1 AS n FROM sync_operations WHERE op_id = ?",
        [opId],
      );
      return row !== null;
    },

    buildCreateStatements(op: {
      opId: string;
      operationType: string;
      entityType: string;
      entityId: string;
    }): BatchStatement[] {
      return [
        {
          sql: `INSERT INTO sync_operations
            (op_id, operation_type, entity_type, entity_id, status, created_at)
            VALUES (?, ?, ?, ?, 'applied', ?)`,
          params: [
            op.opId,
            op.operationType,
            op.entityType,
            op.entityId,
            new Date().toISOString(),
          ],
        },
      ];
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
