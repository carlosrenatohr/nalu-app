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

const DEFAULT_PIN = "1234";

let app: Express;
let token = "";

/** Inicia sesión contra la app (PIN de la semilla) y guarda el token. */
async function login(): Promise<string> {
  // Ruta pública: se llama sin token (aún no existe).
  const publicRequest = request(app);
  const res = await publicRequest.post("/api/auth/login").send({ pin: DEFAULT_PIN });
  expect(res.status).toBe(200);
  return res.body.data.token as string;
}

/** Helper que añade el token Bearer a cada petición autenticada. */
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

describe("Salud y errores", () => {
  it("GET /api/health responde ok", async () => {
    const res = await api("get", "/api/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("ok");
  });

  it("devuelve el contrato de error estructurado en español", async () => {
    const res = await api("post", "/api/sales").send({ items: [] });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(typeof res.body.error.message).toBe("string");
  });

  it("404 para rutas inexistentes", async () => {
    const res = await api("get", "/api/no-existe");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("Autenticación (PIN + sesión larga)", () => {
  it("rechaza un PIN incorrecto", async () => {
    const res = await request(app).post("/api/auth/login").send({ pin: "9999" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rechaza rutas protegidas sin token", async () => {
    const res = await request(app).get("/api/inventory");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("valida la sesión con /auth/me", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Nalu");
  });

  it("invalida la sesión al cerrar sesión", async () => {
    await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`);
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it("cambia el PIN y el anterior deja de funcionar", async () => {
    const change = await request(app)
      .post("/api/auth/change-pin")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPin: "1234", newPin: "5678" });
    expect(change.status).toBe(200);

    // El PIN nuevo funciona y el viejo ya no
    expect((await request(app).post("/api/auth/login").send({ pin: "5678" })).status).toBe(200);
    expect((await request(app).post("/api/auth/login").send({ pin: "1234" })).status).toBe(401);
  });
});

describe("Sabores", () => {
  it("lista los sabores semilla", async () => {
    const res = await api("get", "/api/flavors");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(6);
    const names = res.body.data.map((f: { name: string }) => f.name);
    expect(names).toContain("Coco");
    expect(names).toContain("Guanábana");
  });

  it("crea un sabor y genera su slug", async () => {
    const res = await api("post", "/api/flavors")
      .send({ name: "Fresa Limón", emoji: "🍋", minStock: 5 });
    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe("fresa-limon");
  });

  it("rechaza un sabor sin nombre", async () => {
    const res = await api("post", "/api/flavors").send({ name: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("Inventario", () => {
  it("calcula el inventario desde los movimientos (Coco = 4)", async () => {
    const res = await api("get", "/api/inventory");
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
    const res = await api("get", `/api/inventory/${FLAVORS.coco}`);
    expect(res.status).toBe(200);
    expect(res.body.data.summary.flavor.name).toBe("Coco");
    expect(res.body.data.movements.length).toBeGreaterThan(3);
  });
});

describe("Ventas", () => {
  it("registra una venta, descuenta inventario y calcula ganancia", async () => {
    const res = await api("post", "/api/sales")
      .send({
        location: "Casa",
        items: [{ flavorId: FLAVORS.coco, quantity: 2, unitPrice: 60 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.total).toBe(120);
    expect(res.body.data.profit).toBe(120 - 56); // 2 × (60 − 28)
    expect(res.body.data.items[0].unitCostSnapshot).toBe(28);

    // El inventario de Coco baja de 4 a 2
    const inv = await api("get", "/api/inventory");
    const coco = inv.body.data.find(
      (i: { flavor: { id: string } }) => i.flavor.id === FLAVORS.coco,
    );
    expect(coco.available).toBe(2);
  });

  it("rechaza cantidades inválidas", async () => {
    const res = await api("post", "/api/sales")
      .send({
        location: "Casa",
        items: [{ flavorId: FLAVORS.coco, quantity: 0, unitPrice: 60 }],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rechaza una venta sin inventario suficiente y NO altera el stock", async () => {
    // Guanábana solo tiene 1 disponible
    const before = await api("get", "/api/inventory");
    const guanabanaBefore = before.body.data.find(
      (i: { flavor: { id: string } }) => i.flavor.id === FLAVORS.guanabana,
    );

    const res = await api("post", "/api/sales")
      .send({
        location: "Puesto",
        items: [{ flavorId: FLAVORS.guanabana, quantity: 10, unitPrice: 60 }],
      });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INSUFFICIENT_INVENTORY");

    const after = await api("get", "/api/inventory");
    const guanabanaAfter = after.body.data.find(
      (i: { flavor: { id: string } }) => i.flavor.id === FLAVORS.guanabana,
    );
    expect(guanabanaAfter.available).toBe(guanabanaBefore.available);
  });

  it("consulta una venta por id", async () => {
    const res = await api("get", "/api/sales/60000000-0000-4000-8000-000000000001");
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(3);
    expect(res.body.data.location).toBe("Casa");
  });

  it("al editar una venta conserva el costo histórico de las líneas sin cambios", async () => {
    // Sabor nuevo: costo promedio controlado (sin movimientos previos)
    const flavor = await api("post", "/api/flavors")
      .send({ name: "Sabor Snapshot", emoji: "🍧", minStock: 0 });
    expect(flavor.status).toBe(201);
    const flavorId = flavor.body.data.id;

    // Compra 10 @30 → costo promedio 30
    await api("post", "/api/purchases")
      .send({ supplierId: SUPPLIER_TROPICAL, items: [{ flavorId, quantity: 10, unitCost: 30 }] });

    const sale = await api("post", "/api/sales")
      .send({ location: "Puesto", items: [{ flavorId, quantity: 2, unitPrice: 60 }] });
    expect(sale.status).toBe(201);
    expect(sale.body.data.items[0].unitCostSnapshot).toBe(30);
    const saleId = sale.body.data.id;

    // El proveedor sube: compra 10 @40 → promedio ponderado (30×10 + 40×10) / 20 = 35
    await api("post", "/api/purchases")
      .send({ supplierId: SUPPLIER_TROPICAL, items: [{ flavorId, quantity: 10, unitCost: 40 }] });

    // Misma cantidad → el snapshot original (30) se conserva, no se recongela
    const unchanged = await api("patch", `/api/sales/${saleId}`)
      .send({ items: [{ flavorId, quantity: 2, unitPrice: 60 }] });
    expect(unchanged.status).toBe(200);
    expect(unchanged.body.data.items[0].unitCostSnapshot).toBe(30);

    // Cantidad modificada → la línea se trata como nueva venta parcial (costo actual 35)
    const changed = await api("patch", `/api/sales/${saleId}`)
      .send({ items: [{ flavorId, quantity: 3, unitPrice: 60 }] });
    expect(changed.status).toBe(200);
    expect(changed.body.data.items[0].unitCostSnapshot).toBe(35);
  });
});

describe("Compras", () => {
  it("registra una compra y aumenta el inventario", async () => {
    const res = await api("post", "/api/purchases")
      .send({
        supplierId: SUPPLIER_TROPICAL,
        purchaseDate: new Date().toISOString().slice(0, 10),
        items: [{ flavorId: FLAVORS.coco, quantity: 10, unitCost: 30 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.totalCost).toBe(300);

    const inv = await api("get", "/api/inventory");
    const coco = inv.body.data.find(
      (i: { flavor: { id: string } }) => i.flavor.id === FLAVORS.coco,
    );
    expect(coco.available).toBe(14);
    expect(coco.lastCost).toBe(30); // último costo de compra
  });

  it("rechaza una compra con proveedor inexistente", async () => {
    const res = await api("post", "/api/purchases")
      .send({
        supplierId: "00000000-0000-4000-8000-000000000000",
        items: [{ flavorId: FLAVORS.coco, quantity: 1, unitCost: 28 }],
      });
    expect(res.status).toBe(404);
  });

  it("edita una compra: cambia cantidades y el inventario refleja el neto", async () => {
    // Coco inicia con 4 disponibles (semilla). Compra 10 → 14
    const created = await api("post", "/api/purchases")
      .send({
        supplierId: SUPPLIER_TROPICAL,
        items: [{ flavorId: FLAVORS.coco, quantity: 10, unitCost: 30 }],
      });
    expect(created.status).toBe(201);

    // Editar a 6 @32 → disponible 4 + 6 = 10, último costo 32
    const updated = await api("patch", `/api/purchases/${created.body.data.id}`)
      .send({ items: [{ flavorId: FLAVORS.coco, quantity: 6, unitCost: 32 }] });
    expect(updated.status).toBe(200);
    expect(updated.body.data.totalCost).toBe(192);

    const inv = await api("get", "/api/inventory");
    const coco = inv.body.data.find(
      (i: { flavor: { id: string } }) => i.flavor.id === FLAVORS.coco,
    );
    expect(coco.available).toBe(10);
    expect(coco.lastCost).toBe(32);
  });

  it("edita una compra y bloquea si el inventario quedaría negativo", async () => {
    // Coco: 4 semilla + 10 compra = 14. Vender 13 → queda 1.
    const created = await api("post", "/api/purchases")
      .send({
        supplierId: SUPPLIER_TROPICAL,
        items: [{ flavorId: FLAVORS.coco, quantity: 10, unitCost: 30 }],
      });
    expect(created.status).toBe(201);
    await api("post", "/api/sales")
      .send({ location: "Puesto", items: [{ flavorId: FLAVORS.coco, quantity: 13, unitPrice: 60 }] });

    // Reducir la compra de 10 a 2 dejaría disponible 1 − 8 = −7 → 409
    const res = await api("patch", `/api/purchases/${created.body.data.id}`)
      .send({ items: [{ flavorId: FLAVORS.coco, quantity: 2, unitCost: 30 }] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INSUFFICIENT_INVENTORY");

    // El inventario no cambió
    const inv = await api("get", "/api/inventory");
    const coco = inv.body.data.find(
      (i: { flavor: { id: string } }) => i.flavor.id === FLAVORS.coco,
    );
    expect(coco.available).toBe(1);
  });

  it("elimina una compra y restaura el inventario", async () => {
    // Oreo: 8 semilla + 5 compra = 13
    const created = await api("post", "/api/purchases")
      .send({
        supplierId: SUPPLIER_TROPICAL,
        items: [{ flavorId: FLAVORS.oreo, quantity: 5, unitCost: 28 }],
      });
    expect(created.status).toBe(201);

    const del = await api("delete", `/api/purchases/${created.body.data.id}`);
    expect(del.status).toBe(200);

    const inv = await api("get", "/api/inventory");
    const oreo = inv.body.data.find(
      (i: { flavor: { id: string } }) => i.flavor.id === FLAVORS.oreo,
    );
    expect(oreo.available).toBe(8);
  });

  it("elimina una compra y bloquea si el inventario quedaría negativo", async () => {
    // Coco: 4 semilla + 10 compra = 14. Vender 13 → queda 1.
    const created = await api("post", "/api/purchases")
      .send({
        supplierId: SUPPLIER_TROPICAL,
        items: [{ flavorId: FLAVORS.coco, quantity: 10, unitCost: 30 }],
      });
    expect(created.status).toBe(201);
    await api("post", "/api/sales")
      .send({ location: "Puesto", items: [{ flavorId: FLAVORS.coco, quantity: 13, unitPrice: 60 }] });

    // Eliminar la compra dejaría disponible 1 − 10 = −9 → 409
    const res = await api("delete", `/api/purchases/${created.body.data.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INSUFFICIENT_INVENTORY");
  });

  it("devuelve 404 al editar o eliminar una compra inexistente", async () => {
    const res = await api("patch", "/api/purchases/00000000-0000-4000-8000-000000000000")
      .send({ notes: "nope" });
    expect(res.status).toBe(404);
    const del = await api("delete", "/api/purchases/00000000-0000-4000-8000-000000000000");
    expect(del.status).toBe(404);
  });
});

describe("Salidas sin venta (regalo, consumo, pérdida)", () => {
  it("registra un regalo que reduce inventario pero no genera ingresos", async () => {
    const res = await api("post", "/api/inventory/movements")
      .send({
        flavorId: FLAVORS.oreo,
        movementType: "GIFT",
        quantity: 2,
        notes: "Regalo a la familia",
      });
    expect(res.status).toBe(201);
    expect(res.body.data.quantity).toBe(-2); // cantidad firmada negativa

    const inv = await api("get", "/api/inventory");
    const oreo = inv.body.data.find(
      (i: { flavor: { id: string } }) => i.flavor.id === FLAVORS.oreo,
    );
    expect(oreo.available).toBe(6);

    // Las ventas de hoy NO cambian (el regalo no es una venta)
    const today = new Date();
    const iso = (d: Date) =>
      new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    const report = await api("get", 
      `/api/reports/sales?from=${iso(today)}&to=${iso(today)}`,
    );
    expect(report.body.data.totalSales).toBe(540);
  });
});

describe("Ajuste de stock bidireccional (con motivo)", () => {
  it("ajuste negativo (salida) con motivo reduce el inventario", async () => {
    // Coco = 4. Ajuste out 2 → 2
    const res = await api("post", "/api/inventory/movements")
      .send({
        flavorId: FLAVORS.coco,
        movementType: "ADJUSTMENT",
        quantity: 2,
        notes: "Producto dañado",
      });
    expect(res.status).toBe(201);
    expect(res.body.data.quantity).toBe(-2);

    const inv = await api("get", "/api/inventory");
    const coco = inv.body.data.find(
      (i: { flavor: { id: string } }) => i.flavor.id === FLAVORS.coco,
    );
    expect(coco.available).toBe(2);
  });

  it("ajuste positivo (entrada) con motivo aumenta el inventario", async () => {
    const res = await api("post", "/api/inventory/movements")
      .send({
        flavorId: FLAVORS.coco,
        movementType: "ADJUSTMENT",
        quantity: 3,
        direction: "in",
        notes: "Conteo físico",
      });
    expect(res.status).toBe(201);
    expect(res.body.data.quantity).toBe(3);

    const inv = await api("get", "/api/inventory");
    const coco = inv.body.data.find(
      (i: { flavor: { id: string } }) => i.flavor.id === FLAVORS.coco,
    );
    expect(coco.available).toBe(7);
  });

  it("rechaza un ajuste sin motivo", async () => {
    const res = await api("post", "/api/inventory/movements")
      .send({ flavorId: FLAVORS.coco, movementType: "ADJUSTMENT", quantity: 2 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rechaza un ajuste negativo mayor al disponible", async () => {
    const res = await api("post", "/api/inventory/movements")
      .send({ flavorId: FLAVORS.coco, movementType: "ADJUSTMENT", quantity: 99, notes: "x" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INSUFFICIENT_INVENTORY");
  });
});

describe("Ciclo de vida de sabores (eliminar / archivar / desactivar)", () => {
  it("elimina físicamente un sabor sin referencias", async () => {
    const created = await api("post", "/api/flavors")
      .send({ name: "Sabor a borrar", emoji: "🍧", minStock: 0 });
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    const res = await api("delete", `/api/flavors/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.archived).toBe(false);

    const list = await api("get", "/api/flavors?includeInactive=true");
    const found = list.body.data.find((f: { id: string }) => f.id === id);
    expect(found).toBeUndefined();
  });

  it("archiva un sabor con referencias históricas y conserva el historial", async () => {
    // Coco tiene movimientos/ventas históricas → se archiva, no se borra
    const res = await api("delete", `/api/flavors/${FLAVORS.coco}`);
    expect(res.status).toBe(200);
    expect(res.body.data.archived).toBe(true);
    expect(res.body.data.flavor.active).toBe(false);

    // Oculta del listado normal
    const list = await api("get", "/api/flavors");
    const coco = list.body.data.find((f: { id: string }) => f.id === FLAVORS.coco);
    expect(coco).toBeUndefined();

    // Pero sigue en el inventario (histórico + actual)
    const inv = await api("get", "/api/inventory");
    const cocoInv = inv.body.data.find(
      (i: { flavor: { id: string } }) => i.flavor.id === FLAVORS.coco,
    );
    expect(cocoInv).toBeDefined();
    expect(cocoInv.available).toBe(4);
  });

  it("un sabor desactivado no puede usarse en una nueva venta", async () => {
    await api("patch", `/api/flavors/${FLAVORS.coco}`).send({ active: false });
    const res = await api("post", "/api/sales")
      .send({ location: "Casa", items: [{ flavorId: FLAVORS.coco, quantity: 1, unitPrice: 60 }] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("FLAVOR_INACTIVE");
  });

  it("un sabor desactivado no puede usarse en una nueva compra", async () => {
    await api("patch", `/api/flavors/${FLAVORS.coco}`).send({ active: false });
    const res = await api("post", "/api/purchases")
      .send({ supplierId: SUPPLIER_TROPICAL, items: [{ flavorId: FLAVORS.coco, quantity: 1, unitCost: 28 }] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("FLAVOR_INACTIVE");
  });

  it("un sabor desactivado puede seguir editándose en una venta existente", async () => {
    await api("patch", `/api/flavors/${FLAVORS.coco}`).send({ active: false });
    const res = await api("patch", "/api/sales/60000000-0000-4000-8000-000000000001")
      .send({ items: [{ flavorId: FLAVORS.coco, quantity: 2, unitPrice: 60 }] });
    expect(res.status).toBe(200);
  });
});

describe("Reportes", () => {
  it("reporte de ventas con totales, ganancia, sabores, ubicaciones y precios", async () => {
    const today = new Date();
    const iso = (d: Date) =>
      new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    const res = await api("get", `/api/reports/sales?from=${iso(today)}&to=${iso(today)}`);
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
    const res = await api("get", "/api/reports/purchases");
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.totalPurchases).toBe(1);
    expect(data.bySupplier[0].supplierName).toBe("Distribuidora La Tropical");
    expect(data.bySupplier[0].totalCost).toBe(2240);
  });

  it("reporte de inventario", async () => {
    const res = await api("get", "/api/reports/inventory");
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

    const first = await api("post", "/api/sync/operations")
      .send({ operations: [{ type: "sale", payload }] });
    expect(first.status).toBe(200);
    expect(first.body.data.results[0].status).toBe("applied");
    expect(first.body.data.results[0].entityId).toBe(opId);

    // Reintento: debe devolver "duplicate" sin duplicar la venta
    const second = await api("post", "/api/sync/operations")
      .send({ operations: [{ type: "sale", payload }] });
    expect(second.body.data.results[0].status).toBe("duplicate");

    const inv = await api("get", "/api/inventory");
    const nutella = inv.body.data.find(
      (i: { flavor: { id: string } }) => i.flavor.id === FLAVORS.nutella,
    );
    expect(nutella.available).toBe(10); // 12 − 2 (una sola vez)
  });

  it("reporta operaciones fallidas por inventario insuficiente", async () => {
    const res = await api("post", "/api/sync/operations")
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

  it("aplica una actualización de venta offline (verb update)", async () => {
    const saleId = "60000000-0000-4000-8000-000000000001"; // seed
    const res = await api("post", "/api/sync/operations")
      .send({
        operations: [
          {
            type: "sale",
            verb: "update",
            opId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            payload: { id: saleId, items: [{ flavorId: FLAVORS.coco, quantity: 2, unitPrice: 60 }] },
          },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.data.results[0].status).toBe("applied");

    const sale = await api("get", `/api/sales/${saleId}`);
    expect(sale.body.data.items).toHaveLength(1);
  });

  it("aplica un borrado de venta offline (verb delete)", async () => {
    const saleId = "60000000-0000-4000-8000-000000000001"; // seed
    const res = await api("post", "/api/sync/operations")
      .send({
        operations: [
          {
            type: "sale",
            verb: "delete",
            opId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            payload: { id: saleId },
          },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.data.results[0].status).toBe("applied");

    const sale = await api("get", `/api/sales/${saleId}`);
    expect(sale.status).toBe(404);
  });

  it("aplica desactivación de sabor offline (verb update)", async () => {
    const res = await api("post", "/api/sync/operations")
      .send({
        operations: [
          {
            type: "flavor",
            verb: "update",
            opId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            payload: { id: FLAVORS.coco, active: false },
          },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.data.results[0].status).toBe("applied");

    const flavors = await api("get", "/api/flavors?includeInactive=true");
    const coco = flavors.body.data.find((f: { id: string }) => f.id === FLAVORS.coco);
    expect(coco.active).toBe(false);
  });

  it("aplica archivado de sabor offline (verb delete)", async () => {
    const res = await api("post", "/api/sync/operations")
      .send({
        operations: [
          {
            type: "flavor",
            verb: "delete",
            opId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            payload: { id: FLAVORS.coco },
          },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.data.results[0].status).toBe("applied");
    expect(res.body.data.results[0].entityId).toBe(FLAVORS.coco);

    const list = await api("get", "/api/flavors");
    const coco = list.body.data.find((f: { id: string }) => f.id === FLAVORS.coco);
    expect(coco).toBeUndefined();
  });

  it("rechaza update offline para tipos no editables (compra)", async () => {
    const res = await api("post", "/api/sync/operations")
      .send({
        operations: [
          {
            type: "purchase",
            verb: "update",
            opId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            payload: { id: "50000000-0000-4000-8000-000000000001", notes: "x" },
          },
        ],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
