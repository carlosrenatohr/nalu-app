import { beforeEach, describe, expect, it } from "vitest";
import { localDb } from "./db";
import { enqueue } from "./outbox";
import { revertPendingOp } from "./revert";

// ---------------------------------------------------------------------
// Tests de la reversión segura de operaciones pendientes del outbox.
// ---------------------------------------------------------------------

const SALE_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(async () => {
  await localDb.outbox.clear();
  await localDb.sales.clear();
});

describe("revertPendingOp", () => {
  it("elimina una venta pendiente y su op del outbox", async () => {
    await localDb.sales.put({
      id: SALE_ID,
      businessId: "biz",
      saleDate: "2026-09-20",
      location: "Casa",
      notes: null,
      total: 120,
      paymentType: "cash",
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await enqueue("sale", { id: SALE_ID, location: "Casa", items: [] });

    const ok = await revertPendingOp(SALE_ID);
    expect(ok).toBe(true);
    expect(await localDb.outbox.get(SALE_ID)).toBeUndefined();
    expect(await localDb.sales.get(SALE_ID)).toBeUndefined();
  });

  it("no revierte una operación ya sincronizada", async () => {
    await enqueue("sale", { id: SALE_ID });
    await localDb.outbox.update(SALE_ID, { status: "synced" });
    expect(await revertPendingOp(SALE_ID)).toBe(false);
  });
});