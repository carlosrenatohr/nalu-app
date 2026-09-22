import { localDb, type OutboxOp, type OutboxVerb } from "./db";
import { newId } from "@/lib/utils/id";

// ---------------------------------------------------------------------
// Outbox: cola de operaciones pendientes de sincronizar.
//   - create  → opId = id de la entidad (payload.id); el servidor deduplica.
//   - update/delete (sale, flavor, purchase, supplier) → opId propio
//     (UUID de la operación) para no colisionar con el create de la misma
//     entidad; payload.id es el id de la entidad.
// ---------------------------------------------------------------------

export function createOutboxOp(
  type: OutboxOp["type"],
  payload: Record<string, unknown>,
  verb: OutboxVerb = "create",
): OutboxOp {
  return {
    opId: verb === "create" ? (payload.id as string) : newId(),
    type,
    verb,
    payload,
    status: "pending",
    attempts: 0,
    createdAt: new Date().toISOString(),
  };
}

export async function enqueue(
  type: OutboxOp["type"],
  payload: Record<string, unknown>,
  verb: OutboxVerb = "create",
  opId?: string,
): Promise<void> {
  await localDb.outbox.put(
    opId
      ? { ...createOutboxOp(type, payload, verb), opId }
      : createOutboxOp(type, payload, verb),
  );
}

export async function listPending(): Promise<OutboxOp[]> {
  return localDb.outbox
    .where("status")
    .anyOf("pending", "failed")
    .sortBy("createdAt");
}

/** Operaciones aún sin sincronizar (pendientes + fallidas pendientes de reintento). */
export async function countPending(): Promise<number> {
  return localDb.outbox.where("status").anyOf("pending", "failed").count();
}

export async function markSynced(opId: string): Promise<void> {
  await localDb.outbox.update(opId, { status: "synced" });
}

export async function markFailed(opId: string, message: string, attempts: number): Promise<void> {
  await localDb.outbox.update(opId, {
    status: "failed",
    lastError: message,
    attempts,
    lastAttemptAt: Date.now(),
  });
}