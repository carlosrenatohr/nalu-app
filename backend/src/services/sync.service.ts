import type { DrizzleDb } from "../db/drizzle-types";
import { createSyncRepository, isConstraintError } from "../repositories/sync.repository";
import { ApiError } from "../utils/http-error";

export interface SyncOperation {
  type: "sale" | "purchase" | "movement" | "flavor" | "supplier";
  payload: { id: string } & Record<string, unknown>;
}

export interface SyncOperationResult {
  opId: string;
  status: "applied" | "duplicate" | "failed";
  entityId?: string;
  message?: string;
}

/**
 * Aplica operaciones del outbox offline.
 *
 * El ID de cada operación (opId) es el UUID de la entidad, generado por
 * el cliente. Esto permite deduplicar reintentos de forma idempotente:
 * si el opId ya existe en sync_operations, la operación se ignora.
 *
 * Reglas:
 *  - applied   → se creó la entidad correctamente
 *  - duplicate → ya se había aplicado antes (reintento seguro)
 *  - failed    → error de negocio (p.ej. inventario insuficiente); el
 *                cliente conserva la operación para revisión
 */
export function createSyncService(deps: {
  db: DrizzleDb;
  applySale: (payload: { id: string } & Record<string, unknown>) => Promise<{ id: string }>;
  applyPurchase: (payload: { id: string } & Record<string, unknown>) => Promise<{ id: string }>;
  applyMovement: (payload: { id: string } & Record<string, unknown>) => Promise<{ id: string }>;
  applyFlavor: (payload: { id: string } & Record<string, unknown>) => Promise<{ id: string }>;
  applySupplier: (payload: { id: string } & Record<string, unknown>) => Promise<{ id: string }>;
}) {
  const { db } = deps;
  const syncRepo = createSyncRepository(db);

  const appliers: Record<
    SyncOperation["type"],
    (payload: SyncOperation["payload"]) => Promise<{ id: string }>
  > = {
    sale: deps.applySale,
    purchase: deps.applyPurchase,
    movement: deps.applyMovement,
    flavor: deps.applyFlavor,
    supplier: deps.applySupplier,
  };

  async function applyOperations(operations: SyncOperation[]): Promise<SyncOperationResult[]> {
    const results: SyncOperationResult[] = [];

    for (const op of operations) {
      const opId = op.payload.id;
      const entityType = op.type;

      // 1. Deduplicación: si la operación ya se aplicó, se ignora
      if (await syncRepo.exists(opId)) {
        results.push({ opId, status: "duplicate", entityId: opId });
        continue;
      }

      // 2. Aplicación de la operación
      try {
        const entity = await appliers[op.type](op.payload);
        // 3. Registro de la operación aplicada
        await syncRepo.create({
          opId,
          operationType: op.type,
          entityType,
          entityId: entity.id,
        });
        results.push({ opId, status: "applied", entityId: entity.id });
      } catch (error) {
        // Reintento de una entidad ya creada → se trata como duplicado
        if (isConstraintError(error)) {
          results.push({ opId, status: "duplicate", entityId: opId });
          continue;
        }
        // Error de negocio (inventario, validación...) → se reporta
        if (error instanceof ApiError) {
          results.push({ opId, status: "failed", message: error.message });
          continue;
        }
        throw error;
      }
    }

    return results;
  }

  return { applyOperations };
}
