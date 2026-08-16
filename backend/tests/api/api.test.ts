import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../../src/app";
import { createMemoryDb } from "../../src/db";
import { resolveBusinessId } from "../../src/config/bootstrap";

// ---------------------------------------------------------------------
// Tests de integración de la API con una base SQLite en memoria
// sembrada con los datos de demo (mismas migraciones que D1).
// Cada test usa una base fresca para ser determinista.
// ---------------------------------------------------------------------

const FLAVORS = {
  coco: "20000000-0000-4000-8000-000000000001",
  oreo: "20000000-0000-4000-8000-000000000002",
  fresaKiwi: "20000000-0000-4000-8000-000000000003",
  nutella: "20000000-0000-4000-8000-000000000004",
  maracumango: "20000000-0000-4000-8000-000000000005",
  guanabana: "20000000-0000-4000-8000-000000000006",
};

const SUPPLIER_TROPICAL = "30000000-0000-4000-8000-000000000001";

let app: Express;

beforeEach(async () => {
  const { db } = createMemoryDb(true);
  const businessId = await resolveBusinessId(db);
  app = createApp({ db, getBusinessId: async () => businessId });
});

describe("Salud y errores", () => {
  it("GET /api/health responde ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("ok");
  });

  it("devuelve el contrato de error estructurado en español", async () => {
    const res = await request(app).post("/api/sales").send({ items: [] });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(typeof res.body.error.message).toBe("string");
  });

  it("404 para rutas inexistentes", async () => {
    const res = await request(app).get("/api/no-existe");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("Sabores", () => {
  it("lista los sabores semilla", async () => {
    const res = await request(app).get("/api/flavors");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(6);
    const names = res.body.data.map((f: { name: string }) => f.name);
    expect(names).toContain("Coco");
    expect(names).toContain("Guanábana");
  });

  it("crea un sabor y genera su slug", async () => {
    const res = await request(app)
      .post("/api/flavors")
      .send({ name: "Fresa Limón", emoji: "🍋", minStock: 5 });
    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe("fresa-limon");
  });

  it("rechaza un sabor sin nombre", async () => {
    const res = await request(app).post("/api/flavors").send({ name: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("Inventario", () => {
  it("calcula el inventario desde los movimientos (Coco = 4)", async () => {
    const res = await request(app).get("/api/inventory");
    expect(res.status).toBe(200);
    const coco = res.body.data.find(
      (i: { flavor: { id: string } }) => i.flavor.id === FLAVORS.coco,
    );
    expect(coco.available).toBe(4);
    expect(coco.sold).toBe(5);
    expect(coco.gifted).toBe(1); // regalo de Coco
    expect(coco.personalUse).toBe(0); // el consumo propio fue de Oreo
    expect(coco.lowStock).toBe(true);
  });

  it("detalla un sabor con su historial de movimientos", async () => {
    const res = await request(app).get(`/api/inventory/${FLAVORS.coco}`);
    expect(res.status).toBe(200);
    expect(res.body.data.summary.flavor.name).toBe("Coco");
    expect(res.body.data.movements.length).toBeGreaterThan(3);
  });
});

describe("Ventas", () => {
  it("registra una venta, descuenta inventario y calcula ganancia", async () => {
    const res = await request(app)
      .post("/api/sales")
      .send({
        location: "Casa",
        items: [{ flavorId: FLAVORS.coco, quantity: 2, unitPrice: 60 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.total).toBe(120);
    expect(res.body.data.profit).toBe(120 - 56); // 2 × (60 − 28)
    expect(res.body.data.items[0].unitCostSnapshot).toBe(28);

    // El inventario de Coco baja de 4 a 2
    const inv = await request(app).get("/api/inventory");
    const coco = inv.body.data.find(
      (i: { flavor: { id: string } }) => i.flavor.id === FLAVORS.coco,
    );
    expect(coco.available).toBe(2);
  });

  it("rechaza cantidades inválidas", async () => {
    const res = await request(app)
      .post("/api/sales")
      .send({
        location: "Casa",
        items: [{ flavorId: FLAVORS.coco, quantity: 0, unitPrice: 60 }],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rechaza una venta sin inventario suficiente y NO altera el stock", async () => {
    // Guanábana solo tiene 1 disponible
    const before = await request(app).get("/api/inventory");
    const guanabanaBefore = before.body.data.find(
      (i: { flavor: { id: string } }) => i.flavor.id === FLAVORS.guanabana,
    );

    const res = await request(app)
      .post("/api/sales")
      .send({
        location: "Puesto",
        items: [{ flavorId: FLAVORS.guanabana, quantity: 10, unitPrice: 60 }],
      });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INSUFFICIENT_INVENTORY");

    const after = await request(app).get("/api/inventory");
    const guanabanaAfter = after.body.data.find(
      (i: { flavor: { id: string } }) => i.flavor.id === FLAVORS.guanabana,
    );
    expect(guanabanaAfter.available).toBe(guanabanaBefore.available);
  });

  it("consulta una venta por id", async () => {
    const res = await request(app).get("/api/sales/60000000-0000-4000-8000-000000000001");
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(3);
    expect(res.body.data.location).toBe("Casa");
  });
});

describe("Compras", () => {
  it("registra una compra y aumenta el inventario", async () => {
    const res = await request(app)
      .post("/api/purchases")
      .send({
        supplierId: SUPPLIER_TROPICAL,
        purchaseDate: new Date().toISOString().slice(0, 10),
        items: [{ flavorId: FLAVORS.coco, quantity: 10, unitCost: 30 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.totalCost).toBe(300);

    const inv = await request(app).get("/api/inventory");
    const coco = inv.body.data.find(
      (i: { flavor: { id: string } }) => i.flavor.id === FLAVORS.coco,
    );
    expect(coco.available).toBe(14);
    expect(coco.lastCost).toBe(30); // último costo de compra
  });

  it("rechaza una compra con proveedor inexistente", async () => {
    const res = await request(app)
      .post("/api/purchases")
      .send({
        supplierId: "00000000-0000-4000-8000-000000000000",
        items: [{ flavorId: FLAVORS.coco, quantity: 1, unitCost: 28 }],
      });
    expect(res.status).toBe(404);
  });
});

describe("Salidas sin venta (regalo, consumo, pérdida)", () => {
  it("registra un regalo que reduce inventario pero no genera ingresos", async () => {
    const res = await request(app)
      .post("/api/inventory/movements")
      .send({
        flavorId: FLAVORS.oreo,
        movementType: "GIFT",
        quantity: 2,
        notes: "Regalo a la familia",
      });
    expect(res.status).toBe(201);
    expect(res.body.data.quantity).toBe(-2); // cantidad firmada negativa

    const inv = await request(app).get("/api/inventory");
    const oreo = inv.body.data.find(
      (i: { flavor: { id: string } }) => i.flavor.id === FLAVORS.oreo,
    );
    expect(oreo.available).toBe(6);

    // Las ventas de hoy NO cambian (el regalo no es una venta)
    const today = new Date();
    const iso = (d: Date) =>
      new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    const report = await request(app).get(
      `/api/reports/sales?from=${iso(today)}&to=${iso(today)}`,
    );
    expect(report.body.data.totalSales).toBe(540);
  });
});

describe("Reportes", () => {
  it("reporte de ventas con totales, ganancia, sabores, ubicaciones y precios", async () => {
    const today = new Date();
    const iso = (d: Date) =>
      new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/api/reports/sales?from=${iso(today)}&to=${iso(today)}`);
    expect(res.status).toBe(200);
    const data = res.body.data;
    // Seed: sal-001 (C$300) + sal-002 (C$240) hoy
    expect(data.totalSales).toBe(540);
    expect(data.unitsSold).toBe(9);
    expect(data.byLocation.length).toBeGreaterThanOrEqual(2);
    expect(data.byPrice).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ unitPrice: 60, units: 9 }),
      ]),
    );
    const top = data.byFlavor[0];
    expect(top.flavorName).toBe("Fresa Kiwi");
  });

  it("reporte de compras con análisis por proveedor", async () => {
    const res = await request(app).get("/api/reports/purchases");
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.totalPurchases).toBe(1);
    expect(data.bySupplier[0].supplierName).toBe("Distribuidora La Tropical");
    expect(data.bySupplier[0].totalCost).toBe(2240);
  });

  it("reporte de inventario", async () => {
    const res = await request(app).get("/api/reports/inventory");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(6);
  });
});

describe("Sincronización offline (outbox)", () => {
  it("aplica una venta offline y deduplica el reintento", async () => {
    const opId = "11111111-1111-4111-8111-111111111111";
    const payload = {
      id: opId,
      saleDate: new Date().toISOString().slice(0, 10),
      location: "Puesto",
      items: [{ flavorId: FLAVORS.nutella, quantity: 2, unitPrice: 60 }],
    };

    const first = await request(app)
      .post("/api/sync/operations")
      .send({ operations: [{ type: "sale", payload }] });
    expect(first.status).toBe(200);
    expect(first.body.data.results[0].status).toBe("applied");
    expect(first.body.data.results[0].entityId).toBe(opId);

    // Reintento: debe devolver "duplicate" sin duplicar la venta
    const second = await request(app)
      .post("/api/sync/operations")
      .send({ operations: [{ type: "sale", payload }] });
    expect(second.body.data.results[0].status).toBe("duplicate");

    const inv = await request(app).get("/api/inventory");
    const nutella = inv.body.data.find(
      (i: { flavor: { id: string } }) => i.flavor.id === FLAVORS.nutella,
    );
    expect(nutella.available).toBe(10); // 12 − 2 (una sola vez)
  });

  it("reporta operaciones fallidas por inventario insuficiente", async () => {
    const res = await request(app)
      .post("/api/sync/operations")
      .send({
        operations: [
          {
            type: "movement",
            payload: {
              id: "22222222-2222-4222-8222-222222222222",
              flavorId: FLAVORS.guanabana,
              movementType: "LOSS",
              quantity: 50,
            },
          },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.data.results[0].status).toBe("failed");
    expect(res.body.data.results[0].message).toContain("No hay suficientes");
  });
});
