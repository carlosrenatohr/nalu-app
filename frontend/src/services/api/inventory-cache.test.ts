// ---------------------------------------------------------------------
// Regresión: la tabla IndexedDB `inventory` usa `flavorId` como clave,
// pero la API expone el id dentro de `flavor.id`. Si persistimos la
// respuesta tal cual, bulkPut lanza DataError y la UI muestra error
// aunque la red funcione. Este test protege la normalización.
// ---------------------------------------------------------------------
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { inventoryApi } from "./index";
import { localDb } from "@/lib/offline/db";
import type { FlavorInventory } from "@/types";

const flavor = {
  id: "20000000-0000-4000-8000-000000000001",
  businessId: "10000000-0000-4000-8000-000000000001",
  name: "Coco",
  slug: "coco",
  emoji: "🥥",
  color: "#F5E9D8",
  costPrice: null,
  salePrice: null,
  minStock: 10,
  active: true,
  createdAt: "2026-08-15T00:00:00.000Z",
  updatedAt: "2026-08-15T00:00:00.000Z",
};

const mockInventory: FlavorInventory[] = [
  {
    flavor,
    available: 4,
    lastCost: 28,
    purchased: 10,
    sold: 5,
    gifted: 1,
    personalUse: 0,
    lost: 0,
    adjusted: 0,
    returned: 0,
    value: 112,
    lowStock: true,
  },
];

describe("inventoryApi.list — caché en IndexedDB", () => {
  beforeEach(async () => {
    await localDb.inventory.clear();
    // Simulamos la respuesta del servidor (200 con datos reales).
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: mockInventory }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persiste el inventario con la clave flavorId derivada de flavor.id", async () => {
    const result = await inventoryApi.list();

    // La respuesta al componente no cambia (sigue usando flavor.id)
    expect(result).toHaveLength(1);
    const [first] = result;
    expect(first?.flavor.id).toBe(flavor.id);

    // El caché guarda la clave derivada para que la tabla funcione
    const cached = await localDb.inventory.toArray();
    expect(cached).toHaveLength(1);
    const [cachedItem] = cached;
    expect(cachedItem?.flavorId).toBe(flavor.id);
    expect(cachedItem?.available).toBe(4);
  });

  it("permite leer el inventario cacheado por flavorId (ruta offline)", async () => {
    await inventoryApi.list();

    const cached = await localDb.inventory.get(flavor.id);
    expect(cached).toBeDefined();
    expect(cached?.flavor.name).toBe("Coco");
    expect(cached?.lowStock).toBe(true);
  });
});
