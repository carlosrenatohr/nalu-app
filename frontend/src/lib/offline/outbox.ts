import { localDb, type OutboxOp } from "./db";

// ---------------------------------------------------------------------
// Outbox: cola de operaciones pendientes de sincronizar.
// Cada operación lleva:
//   - opId: UUID de la entidad (el servidor la deduplica)
//   - tipo, payload, estado, intentos y fecha
// ---------------------------------------------------------------------

export function createOutboxOp(
  type: OutboxOp["type"],
  payload: Record<string, unknown>,
): OutboxOp {
  return {
    opId: payload.id as string,
    type,
    payload,
    status: "pending",
    attempts: 0,
    createdAt: new Date().toISOString(),
  };
}

export async function enqueue(
  type: OutboxOp["type"],
  payload: Record<string, unknown>,
): Promise<void> {
  await localDb.outbox.put(createOutboxOp(type, payload));
}

export async function listPending(): Promise<OutboxOp[]> {
  return localDb.outbox
    .where("status")
    .anyOf("pending", "failed")
    .sortBy("createdAt");
}

export async function countPending(): Promise<number> {
  return localDb.outbox.where("status").equals("pending").count();
}

export async function markSynced(opId: string): Promise<void> {
  await localDb.outbox.update(opId, { status: "synced" });
}

export async function markFailed(opId: string, message: string, attempts: number): Promise<void> {
  await localDb.outbox.update(opId, { status: "failed", lastError: message, attempts });
}
