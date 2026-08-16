import { z } from "zod";
import { createSaleSyncSchema } from "./sale";
import { createPurchaseSyncSchema } from "./purchase";
import { createMovementSyncSchema } from "./inventory";
import { createFlavorSyncSchema } from "./flavor";
import { createSupplierSyncSchema } from "./supplier";

// ---------------------------------------------------------------------
// Operación de sincronización offline.
// El cliente genera los UUID (opId = id de la entidad) para permitir la
// deduplicación por clave primaria ante reintentos.
// ---------------------------------------------------------------------
export const syncOperationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("sale"), payload: createSaleSyncSchema }),
  z.object({ type: z.literal("purchase"), payload: createPurchaseSyncSchema }),
  z.object({ type: z.literal("movement"), payload: createMovementSyncSchema }),
  z.object({ type: z.literal("flavor"), payload: createFlavorSyncSchema }),
  z.object({ type: z.literal("supplier"), payload: createSupplierSyncSchema }),
]);

export const syncRequestSchema = z.object({
  operations: z.array(syncOperationSchema).min(1, "No hay operaciones para sincronizar."),
});
