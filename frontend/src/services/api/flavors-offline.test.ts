// ---------------------------------------------------------------------
// Regresión: el caché offline de sabores guarda activos Y archivados
// (la página de sabores los pide con includeInactive). Si la ruta offline
// los devuelve todos, un sabor archivado aparecería para nuevas
// ventas/compras. Este test protege el filtro de la ruta de red caída.
// ---------------------------------------------------------------------
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { flavorsApi } from "./index";
import { localDb } from "@/lib/offline/db";
import type { Flavor } from "@/types";

function makeFlavor(id: string, name: string, active: boolean): Flavor {
  return {
    id,
    businessId: "10000000-0000-4000-8000-000000000001",
    name,
    slug: name.toLowerCase(),
    emoji: "🍦",
    color: "#F5E9D8",
    costPrice: 28,
    salePrice: 60,
    minStock: 10,
    active,
    createdAt: "2026-08-15T00:00:00.000Z",
    updatedAt: "2026-08-15T00:00:00.000Z",
  };
}

const coco = makeFlavor("20000000-0000-4000-8000-000000000001", "Coco", true);
const vainilla = makeFlavor("20000000-0000-4000-8000-000000000002", "Vainilla", false);

describe("flavorsApi.list — caché offline no expone archivados", () => {
  beforeEach(async () => {
    await localDb.flavors.clear();
    await localDb.flavors.bulkPut([coco, vainilla]);
    // Red caída: fetch rechaza con TypeError (mismo caso que el navegador).
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("por defecto devuelve solo los sabores activos", async () => {
    const result = await flavorsApi.list();
    expect(result.map((f) => f.name)).toEqual(["Coco"]);
  });

  it("con includeInactive=true devuelve todos (para la página de sabores)", async () => {
    const result = await flavorsApi.list(true);
    expect(result.map((f) => f.name)).toEqual(["Coco", "Vainilla"]);
  });
});
