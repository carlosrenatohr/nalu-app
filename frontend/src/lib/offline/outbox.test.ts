// ---------------------------------------------------------------------
// Tests unitarios del outbox (cola de operaciones offline).
//
// El outbox es el corazón del modo offline-first: cada acción de negocio
// (venta, compra, movimiento) se guarda localmente como operación pendiente
// y se sincroniza cuando vuelve la conexión. El servidor deduplica por opId.
//
// Nota: fake-indexeddb está activado globalmente en src/test/setup.ts,
// así que localDb (Dexie) funciona en memoria dentro de estos tests.
// ---------------------------------------------------------------------
import { beforeEach, describe, expect, it } from "vitest";
import { localDb } from "./db";
import {
  countPending,
  createOutboxOp,
  enqueue,
  listPending,
  markFailed,
  markSynced,
} from "./outbox";

const SALE_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(async () => {
  // Base limpia por test para evitar contaminación entre casos.
  await localDb.outbox.clear();
});

describe("createOutboxOp", () => {
  it("crea una operación pendiente con opId = id de la entidad", () => {
    const op = createOutboxOp("sale", { id: SALE_ID, location: "Casa" });
    expect(op.opId).toBe(SALE_ID);
    expect(op.type).toBe("sale");
    expect(op.status).toBe("pending");
    expect(op.attempts).toBe(0);
    expect(op.createdAt).toBeTruthy();
  });
});

describe("Encolar y consultar", () => {
  it("encola una operación y la lista como pendiente", async () => {
    await enqueue("sale", { id: SALE_ID, location: "Casa" });
    const pending = await listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]!.opId).toBe(SALE_ID);
    expect(await countPending()).toBe(1);
  });

  it("ordena pendientes por fecha de creación (FIFO)", async () => {
    await enqueue("sale", { id: SALE_ID });
    await enqueue("purchase", { id: "22222222-2222-4222-8222-222222222222" });
    const pending = await listPending();
    expect(pending[0]!.type).toBe("sale");
    expect(pending[1]!.type).toBe("purchase");
  });

  it("no cuenta las sincronizadas como pendientes", async () => {
    await enqueue("sale", { id: SALE_ID });
    await markSynced(SALE_ID);
    expect(await countPending()).toBe(0);
  });
});

describe("Marcado de resultados", () => {
  it("marca como sincronizada tras aplicar en el servidor", async () => {
    await enqueue("sale", { id: SALE_ID });
    await markSynced(SALE_ID);
    const op = await localDb.outbox.get(SALE_ID);
    expect(op?.status).toBe("synced");
  });

  it("marca como fallida guardando el error e incrementando intentos", async () => {
    await enqueue("sale", { id: SALE_ID });
    await markFailed(SALE_ID, "INSUFFICIENT_INVENTORY", 1);
    const op = await localDb.outbox.get(SALE_ID);
    expect(op?.status).toBe("failed");
    expect(op?.lastError).toBe("INSUFFICIENT_INVENTORY");
    expect(op?.attempts).toBe(1);
    // Las fallidas siguen apareciendo en listPending para reintentar.
    const pending = await listPending();
    expect(pending).toHaveLength(1);
  });
});
