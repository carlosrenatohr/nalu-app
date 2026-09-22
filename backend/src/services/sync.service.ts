import type { DrizzleDb } from "../db/drizzle-types";
import { createSyncRepository, isConstraintError } from "../repositories/sync.repository";
import { ApiError } from "../utils/http-error";

export type SyncType = "sale" | "purchase" | "movement" | "flavor" | "supplier";
export type SyncVerb = "create" | "update" | "delete";

export interface SyncOperation {
  type: SyncType;
  verb?: SyncVerb;
  opId?: string;
  payload: { id?: string } & Record<string, unknown>;
}

export interface SyncOperationResult {
  opId: string;
  status: "applied" | "duplicate" | "failed";
  entityId?: string;
  message?: string;
}

/** Tipos con cola de edición offline (update/delete en el outbox). */
type EditableSyncType = "sale" | "flavor" | "purchase" | "supplier";

/**
 * Aplica operaciones del outbox offline.
 *
 * El opId permite deduplicar reintentos: si ya existe en sync_operations,
 * la operación se ignora. Para `create` el opId es el UUID de la entidad
 * (payload.id); para `update`/`delete` es un UUID propio de la operación.
 *
 * Reglas:
 *  - applied   → se aplicó correctamente
 *  - duplicate → ya se había aplicado antes (reintento seguro)
 *  - failed    → error de negocio; el cliente conserva la operación
 */
export function createSyncService(deps: {
  db: DrizzleDb;
  applySale: (payload: SyncOperation["payload"]) => Promise<{ id: string }>;
  applyPurchase: (payload: SyncOperation["payload"]) => Promise<{ id: string }>;
  applyMovement: (payload: SyncOperation["payload"]) => Promise<{ id: string }>;
  applyFlavor: (payload: SyncOperation["payload"]) => Promise<{ id: string }>;
  applySupplier: (payload: SyncOperation["payload"]) => Promise<{ id: string }>;
  updateSale: (payload: SyncOperation["payload"]) => Promise<{ id: string }>;
  deleteSale: (payload: SyncOperation["payload"]) => Promise<{ id: string }>;
  updateFlavor: (payload: SyncOperation["payload"]) => Promise<{ id: string }>;
  deleteFlavor: (payload: SyncOperation["payload"]) => Promise<{ id: string }>;
  updatePurchase: (payload: SyncOperation["payload"]) => Promise<{ id: string }>;
  deletePurchase: (payload: SyncOperation["payload"]) => Promise<{ id: string }>;
  updateSupplier: (payload: SyncOperation["payload"]) => Promise<{ id: string }>;
  deleteSupplier: (payload: SyncOperation["payload"]) => Promise<{ id: string }>;
}) {
  const { db } = deps;
  const syncRepo = createSyncRepository(db);

  const createAppliers: Record<SyncType, (payload: SyncOperation["payload"]) => Promise<{ id: string }>> = {
    sale: deps.applySale,
    purchase: deps.applyPurchase,
    movement: deps.applyMovement,
    flavor: deps.applyFlavor,
    supplier: deps.applySupplier,
  };
  const updateAppliers: Record<EditableSyncType, (payload: SyncOperation["payload"]) => Promise<{ id: string }>> = {
    sale: deps.updateSale,
    flavor: deps.updateFlavor,
    purchase: deps.updatePurchase,
    supplier: deps.updateSupplier,
  };
  const deleteAppliers: Record<EditableSyncType, (payload: SyncOperation["payload"]) => Promise<{ id: string }>> = {
    sale: deps.deleteSale,
    flavor: deps.deleteFlavor,
    purchase: deps.deletePurchase,
    supplier: deps.deleteSupplier,
  };

  async function applyOperations(operations: SyncOperation[]): Promise<SyncOperationResult[]> {
    const results: SyncOperationResult[] = [];

    for (const op of operations) {
      const verb: SyncVerb = op.verb ?? "create";
      const isEdit = verb !== "create";
      const opId = (isEdit ? op.opId : op.opId ?? op.payload.id) as string;
      const entityType = op.type;

      // 1. Deduplicación: si la operación ya se aplicó, se ignora
      if (await syncRepo.exists(opId)) {
        results.push({ opId, status: "duplicate", entityId: opId });
        continue;
      }

      // 2. Aplicación de la operación
      try {
        let entity: { id: string };
        if (!isEdit) {
          entity = await createAppliers[op.type](op.payload);
        } else if (verb === "update") {
          entity = await updateAppliers[op.type as EditableSyncType](op.payload);
        } else {
          entity = await deleteAppliers[op.type as EditableSyncType](op.payload);
        }
        // 3. Registro de la operación aplicada
        await syncRepo.create({
          opId,
          operationType: `${verb}:${op.type}`,
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