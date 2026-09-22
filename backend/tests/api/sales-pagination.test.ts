import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../../src/app";
import { createMemoryDb } from "../../src/db";
import { resolveBusinessId } from "../../src/config/bootstrap";

// ---------------------------------------------------------------------
// Paginación de GET /api/sales.
// Sin page/limit sigue devolviendo la lista completa (compatibilidad);
// con page/limit responde { items, total, page, limit } y las páginas
// no se solapan ni dejan huecos.
// ---------------------------------------------------------------------

const FLAVORS = {
  coco: "20000000-0000-4000-8000-000000000001",
  oreo: "20000000-0000-4000-8000-000000000002",
  fresaKiwi: "20000000-0000-4000-8000-000000000003",
  maracumango: "20000000-0000-4000-8000-000000000005",
};

const DEFAULT_PIN = "1234";

let app: Express;
let token = "";

async function login(): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ pin: DEFAULT_PIN });
  expect(res.status).toBe(200);
  return res.body.data.token as string;
}

function api(verb: "get" | "post", url: string) {
  const req = request(app)[verb](url);
  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

beforeEach(async () => {
  const { db } = createMemoryDb(true);
  const businessId = await resolveBusinessId(db);
  app = createApp({ db, getBusinessId: async () => businessId });
  token = await login();
});

/** Registra una venta de 1 unidad del sabor indicado. */
async function createSale(flavorId: string): Promise<void> {
  const res = await api("post", "/api/sales").send({
    location: "Casa",
    items: [{ flavorId, quantity: 1, unitPrice: 60 }],
  });
  expect(res.status).toBe(201);
}

describe("Paginación de ventas", () => {
  it("sin page/limit devuelve la lista completa (compatibilidad)", async () => {
    const res = await api("get", "/api/sales");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0); // semilla
  });

  it("con page/limit devuelve items, total y metadatos", async () => {
    const legacy = await api("get", "/api/sales");
    const baseline = legacy.body.data.length as number;

    await createSale(FLAVORS.coco);

    const res = await api("get", "/api/sales?page=1&limit=2");
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.total).toBe(baseline + 1);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.limit).toBe(2);
    // Cada venta lleva su ganancia estimada igual que en la lista completa.
    expect(typeof res.body.data.items[0].profit).toBe("number");
  });

  it("recorre todas las páginas sin solapamientos ni huecos", async () => {
    await createSale(FLAVORS.coco);
    await createSale(FLAVORS.oreo);
    await createSale(FLAVORS.fresaKiwi);
    await createSale(FLAVORS.maracumango);

    const legacy = await api("get", "/api/sales");
    const allIds = legacy.body.data.map((s: { id: string }) => s.id);

    const pagedIds: string[] = [];
    for (let page = 1; page <= Math.ceil(allIds.length / 3); page++) {
      const res = await api("get", `/api/sales?page=${page}&limit=3`);
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(allIds.length);
      pagedIds.push(...res.body.data.items.map((s: { id: string }) => s.id));
    }

    expect(pagedIds).toHaveLength(allIds.length);
    expect(new Set(pagedIds).size).toBe(allIds.length);
    expect([...pagedIds].sort()).toEqual([...allIds].sort());
  });

  it("una página más allá del total viene vacía pero conserva el total", async () => {
    const res = await api("get", "/api/sales?page=99&limit=20");
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
    expect(res.body.data.total).toBeGreaterThan(0);
  });

  it("respeta el filtro de fechas junto con la paginación", async () => {
    const res = await api("get", "/api/sales?from=2000-01-01&to=2000-01-02&page=1&limit=10");
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
    expect(res.body.data.total).toBe(0);
  });

  it("rechaza page/limit inválidos", async () => {
    const zero = await api("get", "/api/sales?page=0");
    expect(zero.status).toBe(400);
    expect(zero.body.error.code).toBe("VALIDATION_ERROR");

    const huge = await api("get", "/api/sales?limit=1000");
    expect(huge.status).toBe(400);
    expect(huge.body.error.code).toBe("VALIDATION_ERROR");
  });
});
