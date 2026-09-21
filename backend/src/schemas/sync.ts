import { z } from "zod";
import { createSaleSyncSchema, updateSaleSchema } from "./sale";
import { createPurchaseSyncSchema } from "./purchase";
import { createMovementSyncSchema } from "./inventory";
import { createFlavorSyncSchema, updateFlavorSchema } from "./flavor";
import { createSupplierSyncSchema } from "./supplier";
import { uuidSchema } from "./common";

// ---------------------------------------------------------------------
// Operación de sincronización offline.
// El cliente genera los UUID para permitir la deduplicación por clave
// primaria ante reintentos:
//   - create:  opId = id de la entidad (payload.id), como siempre.
//   - update/delete (solo sale y flavor): opId propio (UUID de la
//     operación) distinto del id de la entidad para no colisionar con el
//     create de la misma entidad.
// ---------------------------------------------------------------------

function payloadSchemaFor(type: string, verb: string): z.ZodType {
  if (verb === "delete") return z.object({ id: uuidSchema });
  switch (type) {
    case "sale":
      return verb === "create" ? createSaleSyncSchema : updateSaleSchema.extend({ id: uuidSchema });
    case "flavor":
      return verb === "create" ? createFlavorSyncSchema : updateFlavorSchema.extend({ id: uuidSchema });
    case "purchase":
      return createPurchaseSyncSchema;
    case "movement":
      return createMovementSyncSchema;
    case "supplier":
      return createSupplierSyncSchema;
    default:
      return z.unknown();
  }
}

export const syncOperationSchema = z
  .object({
    type: z.enum(["sale", "purchase", "movement", "flavor", "supplier"]),
    verb: z.enum(["create", "update", "delete"]).default("create"),
    opId: uuidSchema.optional(),
    payload: z.record(z.string(), z.unknown()),
  })
  .superRefine((data, ctx) => {
    const supportsEdit = data.type === "sale" || data.type === "flavor";
    if (data.verb !== "create" && !supportsEdit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["verb"],
        message: `Las operaciones offline de ${data.type} solo admiten creación.`,
      });
      return;
    }
    if (data.verb !== "create" && !data.opId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["opId"],
        message: "Las operaciones de actualización y borrado requieren un opId propio.",
      });
      return;
    }
    const result = payloadSchemaFor(data.type, data.verb).safeParse(data.payload);
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: issue.message, path: issue.path });
      }
    }
  });

export const syncRequestSchema = z.object({
  operations: z.array(syncOperationSchema).min(1, "No hay operaciones para sincronizar."),
});