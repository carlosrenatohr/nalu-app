import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { flavorsApi, purchasesApi, suppliersApi, salesApi } from "./index";
import { localDb } from "@/lib/offline/db";
import { syncEngine } from "@/lib/offline/syncEngine";
import { checkConnectivity } from "@/lib/offline/network";
import type { Flavor, Purchase, Sale, Supplier } from "@/types";

// ---------------------------------------------------------------------
// Cola offline de edición (F6) y regresión de recursión:
//  - Si la API se cae con la interfaz aún "en línea", los create deben
//    hacer UN solo intento y caer a la cola (antes `this.create()`
//    recursaba sin fin).
//  - update/delete de compras/proveedores se encolan con su verbo y
//    reflejan el cambio local (documento + delta de inventario).
//  - El neto de una edición de venta es: vieja − nueva (regresión de
//    signo que descontaba dos veces).
// ---------------------------------------------------------------------

const COCO = "20000000-0000-4000-8000-000000000001";
const PURCHASE_ID = "50000000-0000-4000-8000-000000000001";
const SUPPLIER_ID = "30000000-0000-4000-8000-000000000001";
const SALE_ID = "60000000-0000-4000-8000-000000000001";

function makeFlavor(): Flavor {
  return {
    id: COCO,
    businessId: "biz-1",
    name: "Coco",
    slug: "coco",
    emoji: "🥥",
    color: "#F5E9D8",
    costPrice: 30,
    salePrice: 60,
    minStock: 10,
    active: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

function makeCachedInventory(available: number) {
  return {
    flavorId: COCO,
    flavor: makeFlavor(),
    available,
    lastCost: 30,
    purchased: 0,
    sold: 0,
    gifted: 0,
    personalUse: 0,
    lost: 0,
    adjusted: 0,
    returned: 0,
    value: available * 30,
    lowStock: available <= 10,
  };
}

function makePurchase(): Purchase {
  return {
    id: PURCHASE_ID,
    businessId: "biz-1",
    supplierId: SUPPLIER_ID,
    supplierName: "Distribuidora Tropical",
    purchaseDate: "2026-09-18",
    notes: null,
    totalCost: 120,
    paymentType: "cash",
    items: [
      {
        id: "pi-1",
        purchaseId: PURCHASE_ID,
        flavorId: COCO,
        flavorName: "Coco",
        quantity: 4,
        unitCost: 30,
        subtotal: 120,
      },
    ],
    createdAt: "2026-09-18T10:00:00.000Z",
    updatedAt: "2026-09-18T10:00:00.000Z",
  };
}

function makeSupplier(): Supplier {
  return {
    id: SUPPLIER_ID,
    businessId: "biz-1",
    name: "Distribuidora Tropical",
    contact: null,
    notes: null,
    active: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

function makeSale(): Sale {
  return {
    id: SALE_ID,
    businessId: "biz-1",
    saleDate: "2026-09-20",
    location: "Casa",
    notes: null,
    total: 180,
    paymentType: "cash",
    items: [
      {
        id: "si-1",
        saleId: SALE_ID,
        flavorId: COCO,
        flavorName: "Coco",
        quantity: 3,
        unitPrice: 60,
        unitCostSnapshot: 30,
        subtotal: 180,
      },
    ],
    createdAt: "2026-09-20T10:00:00.000Z",
    updatedAt: "2026-09-20T10:00:00.000Z",
  };
}

/** Fuerza el estado de conexión del módulo de red vía su sonda real. */
async function setNetwork(online: boolean): Promise<void> {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      if (online) return new Response(null, { status: 200 });
      throw new TypeError("Failed to fetch");
    }),
  );
  await checkConnectivity();
}

beforeEach(async () => {
  // Sin timers de sincronización en medio: las ops se encolan y ya.
  vi.spyOn(syncEngine, "requestSync").mockImplementation(() => {});
  await Promise.all([
    localDb.flavors.clear(),
    localDb.suppliers.clear(),
    localDb.purchases.clear(),
    localDb.sales.clear(),
    localDb.inventory.clear(),
    localDb.movements.clear(),
    localDb.outbox.clear(),
  ]);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Regresión: sin recursión en los create con la API caída", () => {
  it("sabor: un solo intento de red y cae a la cola offline", async () => {
    await setNetwork(true); // la interfaz cree que está en línea…
    const fetchMock = vi.fn(async () => {
      throw new TypeError("Failed to fetch"); // …pero la API se cayó
    });
    vi.stubGlobal("fetch", fetchMock);

    const flavor = await flavorsApi.create({ name: "Mango" });

    // Antes: `return this.create(input)` → bucle infinito de peticiones.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await localDb.flavors.get(flavor.id)).toBeDefined();
    const ops = await localDb.outbox.toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ type: "flavor", verb: "create", opId: flavor.id });
  });

  it("compra: un solo intento y el stock local sube una sola vez", async () => {
    await localDb.inventory.put(makeCachedInventory(10));
    await setNetwork(true);
    const fetchMock = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    vi.stubGlobal("fetch", fetchMock);

    const purchase = await purchasesApi.create({
      purchaseDate: "2026-09-18",
      supplierId: SUPPLIER_ID,
      paymentType: "cash",
      items: [{ flavorId: COCO, quantity: 4, unitCost: 30 }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await localDb.inventory.get(COCO))!.available).toBe(14); // 10 + 4, una vez
    expect(await localDb.purchases.get(purchase.id)).toBeDefined();
    const ops = await localDb.outbox.toArray();
    expect(ops[0]).toMatchObject({ type: "purchase", verb: "create" });
  });
});

describe("Cola offline de edición de compras", () => {
  it("update: encola el verbo, actualiza el doc y aplica el neto (nuevo − viejo)", async () => {
    await localDb.inventory.put(makeCachedInventory(10));
    await localDb.purchases.put(makePurchase()); // aporta +4 al stock
    await setNetwork(false);

    const updated = await purchasesApi.update(PURCHASE_ID, {
      purchaseDate: "2026-09-18",
      supplierId: SUPPLIER_ID,
      notes: "Editada offline",
      items: [{ flavorId: COCO, quantity: 7, unitCost: 30 }],
    });

    const ops = await localDb.outbox.toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ type: "purchase", verb: "update" });
    expect(ops[0]!.payload.id).toBe(PURCHASE_ID);
    expect(ops[0]!.opId).not.toBe(PURCHASE_ID); // opId propio, no colisiona con el create

    expect(updated.notes).toBe("Editada offline");
    expect(updated.items).toHaveLength(1);
    expect(updated.items[0]!.quantity).toBe(7);
    expect(updated.totalCost).toBe(210);
    // 10 − 4 (quito lo viejo) + 7 (sumo lo nuevo) = 13
    expect((await localDb.inventory.get(COCO))!.available).toBe(13);
  });

  it("delete: encola, borra el doc local y descuenta lo que aportaba", async () => {
    await localDb.inventory.put(makeCachedInventory(14));
    await localDb.purchases.put(makePurchase());
    await setNetwork(false);

    const removed = await purchasesApi.delete(PURCHASE_ID);

    expect(removed.id).toBe(PURCHASE_ID);
    expect(await localDb.purchases.get(PURCHASE_ID)).toBeUndefined();
    expect((await localDb.inventory.get(COCO))!.available).toBe(10); // 14 − 4
    const ops = await localDb.outbox.toArray();
    expect(ops[0]).toMatchObject({ type: "purchase", verb: "delete" });
  });
});

describe("Cola offline de edición de proveedores", () => {
  it("update: refleja el cambio local y encola el verbo", async () => {
    await localDb.suppliers.put(makeSupplier());
    await setNetwork(false);

    const updated = await suppliersApi.update(SUPPLIER_ID, { name: "Tropical Editada" });

    expect(updated.name).toBe("Tropical Editada");
    expect((await localDb.suppliers.get(SUPPLIER_ID))!.name).toBe("Tropical Editada");
    const ops = await localDb.outbox.toArray();
    expect(ops[0]).toMatchObject({ type: "supplier", verb: "update" });
    expect(ops[0]!.payload.id).toBe(SUPPLIER_ID);
  });

  it("delete: oculta la fila local y encola el borrado", async () => {
    await localDb.suppliers.put(makeSupplier());
    await setNetwork(false);

    const result = await suppliersApi.delete(SUPPLIER_ID);

    expect(result.supplier.id).toBe(SUPPLIER_ID);
    expect(await localDb.suppliers.get(SUPPLIER_ID)).toBeUndefined();
    const ops = await localDb.outbox.toArray();
    expect(ops[0]).toMatchObject({ type: "supplier", verb: "delete" });
  });
});

describe("Regresión: signo del neto al editar una venta offline", () => {
  it("inventario neto = vieja − nueva (antes descontaba dos veces)", async () => {
    await localDb.inventory.put(makeCachedInventory(7)); // 10 − 3 de la venta
    await localDb.sales.put(makeSale()); // 3 unidades
    await setNetwork(false);

    await salesApi.update(SALE_ID, {
      saleDate: "2026-09-20",
      location: "Casa",
      items: [{ flavorId: COCO, quantity: 5, unitPrice: 60 }],
    });

    // 7 + 3 (devuelvo la vieja) − 5 (descuento la nueva) = 5.
    // El bug daba 7 − 3 − 5 = −1.
    expect((await localDb.inventory.get(COCO))!.available).toBe(5);
    const ops = await localDb.outbox.toArray();
    expect(ops[0]).toMatchObject({ type: "sale", verb: "update" });
  });
});
