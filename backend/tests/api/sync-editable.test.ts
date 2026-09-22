import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../../src/app";
import { createMemoryDb } from "../../src/db";
import { resolveBusinessId } from "../../src/config/bootstrap";

// ---------------------------------------------------------------------
// Cola de edición offline para compras y proveedores (F6): el outbox
// envía verbos update/delete y el servidor los aplica con las mismas
// reglas de negocio que la API normal (inventario, archivado, dedupe).
// ---------------------------------------------------------------------

const COCO = "20000000-0000-4000-8000-000000000001";
const SUPPLIER_TROPICAL = "30000000-0000-4000-8000-000000000001";
const DEFAULT_PIN = "1234";

let app: Express;
let token = "";

async function login(): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ pin: DEFAULT_PIN });
  expect(res.status).toBe(200);
  return res.body.data.token as string;
}

function api(verb: "get" | "post" | "patch" | "delete", url: string) {
  const req = request(app)[verb](url);
  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

beforeEach(async () => {
  const { db } = createMemoryDb(true);
  const businessId = await resolveBusinessId(db);
  app = createApp({ db, getBusinessId: async () => businessId });
  token = await login();
});

/** Crea una compra real vía API (10 Coco × C$30). */
async function createPurchase(): Promise<{ id: string }> {
  const res = await api("post", "/api/purchases").send({
    supplierId: SUPPLIER_TROPICAL,
    items: [{ flavorId: COCO, quantity: 10, unitCost: 30 }],
  });
  expect(res.status).toBe(201);
  return res.body.data as { id: string };
}

async function syncOp(op: Record<string, unknown>) {
  return api("post", "/api/sync/operations").send({ operations: [op] });
}

async function cocoAvailable(): Promise<number> {
  const res = await api("get", "/api/inventory");
  const row = (res.body.data as { flavor: { id: string }; available: number }[]).find(
    (i) => i.flavor.id === COCO,
  );
  return row!.available;
}

describe("Edición offline de compras", () => {
  it("aplica una actualización (verb update) y deduplica el reintento", async () => {
    const purchase = await createPurchase();
    const cocoBefore = await cocoAvailable();

    const op = {
      type: "purchase",
      verb: "update",
      opId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      payload: {
        id: purchase.id,
        notes: "Editada offline",
        items: [{ flavorId: COCO, quantity: 5, unitCost: 30 }],
      },
    };

    const first = await syncOp(op);
    expect(first.status).toBe(200);
    expect(first.body.data.results[0].status).toBe("applied");

    // Reintento con el mismo opId → duplicate, sin doble efecto.
    const second = await syncOp(op);
    expect(second.body.data.results[0].status).toBe("duplicate");

    const updated = await api("get", `/api/purchases/${purchase.id}`);
    expect(updated.status).toBe(200);
    expect(updated.body.data.notes).toBe("Editada offline");
    expect(updated.body.data.items).toHaveLength(1);
    expect(updated.body.data.items[0].quantity).toBe(5);
    expect(updated.body.data.totalCost).toBe(150);

    // El inventario refleja 10 → 5 unidades de la compra.
    expect(await cocoAvailable()).toBe(cocoBefore - 5);
  });

  it("aplica un borrado (verb delete) y baja el inventario", async () => {
    const purchase = await createPurchase();
    const cocoBefore = await cocoAvailable();

    const res = await syncOp({
      type: "purchase",
      verb: "delete",
      opId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      payload: { id: purchase.id },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.results[0].status).toBe("applied");

    const gone = await api("get", `/api/purchases/${purchase.id}`);
    expect(gone.status).toBe(404);
    expect(await cocoAvailable()).toBe(cocoBefore - 10);
  });
});

describe("Edición offline de proveedores", () => {
  it("aplica una actualización (verb update)", async () => {
    const res = await syncOp({
      type: "supplier",
      verb: "update",
      opId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      payload: { id: SUPPLIER_TROPICAL, name: "Tropical Editada" },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.results[0].status).toBe("applied");

    const list = await api("get", "/api/suppliers?includeInactive=true");
    const supplier = (list.body.data as { id: string; name: string }[]).find(
      (s) => s.id === SUPPLIER_TROPICAL,
    );
    expect(supplier?.name).toBe("Tropical Editada");
  });

  it("archiva un proveedor con compras al borrarlo offline (verb delete)", async () => {
    await createPurchase();

    const res = await syncOp({
      type: "supplier",
      verb: "delete",
      opId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      payload: { id: SUPPLIER_TROPICAL },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.results[0].status).toBe("applied");

    // Con historial de compras → archivado, no borrado.
    const active = await api("get", "/api/suppliers");
    expect(
      (active.body.data as { id: string }[]).find((s) => s.id === SUPPLIER_TROPICAL),
    ).toBeUndefined();

    const all = await api("get", "/api/suppliers?includeInactive=true");
    const supplier = (all.body.data as { id: string; active: boolean }[]).find(
      (s) => s.id === SUPPLIER_TROPICAL,
    );
    expect(supplier?.active).toBe(false);
  });

  it("rechaza verbs de edición para tipos no editables (movement)", async () => {
    const res = await syncOp({
      type: "movement",
      verb: "update",
      opId: "99999999-9999-4999-8999-999999999999",
      payload: { id: "99999999-9999-4999-8999-999999999998" },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain("solo admiten creación");
  });
});
