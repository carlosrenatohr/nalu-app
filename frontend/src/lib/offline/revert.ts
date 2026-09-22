import { localDb, type OutboxOp } from "./db";
import { refreshInventoryCache } from "@/services/api";

// ---------------------------------------------------------------------
// Reversión segura de una operación del outbox que aún NO se sincronizó.
// Solo aplica a ops pending/failed y nunca toca registros ya
// sincronizados (synced).
//   - create: elimina el registro local y revierte su delta de inventario.
//   - update/delete: no hay snapshot que restaurar → solo se quita la op
//     de la cola; el valor local vuelve al del servidor en la próxima
//     recarga de listas y el inventario se refresca si hay red.
// ---------------------------------------------------------------------

async function reverseInventoryDeltas(deltas: { flavorId: string; delta: number }[]): Promise<void> {
  await localDb.transaction("rw", localDb.inventory, async () => {
    for (const d of deltas) {
      const cached = await localDb.inventory.get(d.flavorId);
      if (!cached) continue;
      const next = cached.available - d.delta;
      await localDb.inventory.put({
        ...cached,
        available: next,
        lowStock: next <= cached.flavor.minStock,
      });
    }
  });
}

function movementSign(p: { movementType: string; quantity: number; direction?: string }): number {
  const isIn =
    p.movementType === "PURCHASE" ||
    p.movementType === "RETURN" ||
    (p.movementType === "ADJUSTMENT" && p.direction === "in");
  return isIn ? p.quantity : -p.quantity;
}

export async function revertOperation(op: OutboxOp): Promise<void> {
  // update/delete: solo quitamos la op de la cola (sin snapshot local no
  // hay nada que restaurar) y refrescamos el caché de inventario si hay red.
  if ((op.verb ?? "create") !== "create") {
    await localDb.outbox.delete(op.opId);
    await refreshInventoryCache();
    return;
  }

  const entityId = op.payload.id as string;
  switch (op.type) {
    case "sale": {
      const items = (op.payload.items as { flavorId: string; quantity: number }[] | undefined) ?? [];
      await reverseInventoryDeltas(items.map((i) => ({ flavorId: i.flavorId, delta: -i.quantity })));
      await localDb.sales.delete(entityId);
      break;
    }
    case "purchase": {
      const items = (op.payload.items as { flavorId: string; quantity: number }[] | undefined) ?? [];
      await reverseInventoryDeltas(items.map((i) => ({ flavorId: i.flavorId, delta: i.quantity })));
      await localDb.purchases.delete(entityId);
      break;
    }
    case "movement": {
      const payload = op.payload as { flavorId: string; movementType: string; quantity: number; direction?: string };
      await reverseInventoryDeltas([
        { flavorId: payload.flavorId, delta: movementSign(payload) },
      ]);
      await localDb.movements.delete(entityId);
      break;
    }
    case "flavor":
      await localDb.flavors.delete(entityId);
      break;
    case "supplier":
      await localDb.suppliers.delete(entityId);
      break;
  }
  await localDb.outbox.delete(op.opId);
}

/** Revertir una op pendiente/fallida. Devuelve false si ya estaba sincronizada o no existía. */
export async function revertPendingOp(opId: string): Promise<boolean> {
  const op = await localDb.outbox.get(opId);
  if (!op || op.status === "synced") return false;
  await revertOperation(op);
  return true;
}