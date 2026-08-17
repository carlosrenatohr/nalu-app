import { apiRequest, ApiClientError } from "./client";
import { localDb, type CachedInventory } from "@/lib/offline/db";
import { isOnline, isNetworkError } from "@/lib/offline/network";
import { enqueue } from "@/lib/offline/outbox";
import { syncEngine } from "@/lib/offline/syncEngine";
import { newId } from "@/lib/utils/id";
import type {
  AuthSession,
  Business,
  Flavor,
  FlavorInventory,
  FlavorInventoryDetail,
  InventoryMovement,
  Location,
  MovementType,
  NewMovementInput,
  NewPurchaseInput,
  NewSaleInput,
  Purchase,
  PurchasesReport,
  Sale,
  SalesReport,
  Supplier,
  SyncOperationResult,
} from "@/types";
import { clearSession, getToken, loadSession, persistSession } from "@/lib/offline/session";

// ---------------------------------------------------------------------
// APIs por recurso. Lecturas: intentan el servidor y caen al caché de
// IndexedDB si no hay conexión. Escrituras: si no hay conexión, crean
// la entidad local y encolan la operación en el outbox.
// ---------------------------------------------------------------------

// ---------------------------------------------------------------------
// Autenticación: PIN + sesión de larga duración (90 días). El token se
// guarda en IndexedDB (lib/offline/session) para sobrevivir recargas.
// ---------------------------------------------------------------------
export const authApi = {
  async login(pin: string): Promise<AuthSession> {
    const session = await apiRequest<AuthSession>("/auth/login", {
      method: "POST",
      body: { pin },
    });
    await persistSession(session.token, session.expiresAt);
    await localDb.business.put(session.business);
    return session;
  },

  async logout(): Promise<void> {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } finally {
      await clearSession();
    }
  },

  /**
   * Valida la sesión local contra el servidor; devuelve el negocio.
   * Solo un 401 invalida la sesión: un error de red NO cierra sesión
   * (offline-first: confiamos en el token local hasta que el servidor
   * diga lo contrario).
   */
  async me(): Promise<Business | null> {
    const token = getToken();
    if (!token) return null;
    try {
      return await apiRequest<Business>("/auth/me");
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) return null;
      // Sin conexión: usamos el caché local del negocio.
      return (await localDb.business.toCollection().first()) ?? null;
    }
  },

  async changePin(currentPin: string, newPin: string): Promise<void> {
    await apiRequest("/auth/change-pin", { method: "POST", body: { currentPin, newPin } });
  },
};

/** Recupera la sesión persistida al arrancar (para el gate de la app). */
export async function restoreSession(): Promise<boolean> {
  const token = await loadSession();
  return Boolean(token);
}

function applyLocalInventoryDelta(deltas: { flavorId: string; delta: number }[]): Promise<void> {
  return localDb.transaction("rw", localDb.inventory, async () => {
    for (const d of deltas) {
      const cached = await localDb.inventory.get(d.flavorId);
      if (!cached) continue;
      await localDb.inventory.put({
        ...cached,
        available: cached.available + d.delta,
        lowStock: cached.available + d.delta <= cached.flavor.minStock,
      });
    }
  });
}

export const flavorsApi = {
  async list(_includeInactive = false): Promise<Flavor[]> {
    try {
      const flavors = await apiRequest<Flavor[]>("/flavors");
      await localDb.flavors.bulkPut(flavors);
      return flavors;
    } catch (err) {
      if (isNetworkError(err)) return localDb.flavors.toArray();
      throw err;
    }
  },

  async create(input: { name: string; emoji?: string; color?: string; costPrice?: number; salePrice?: number; minStock?: number }): Promise<Flavor> {
    if (!isOnline()) {
      const flavor: Flavor = {
        id: newId(),
        businessId: "",
        name: input.name,
        slug: "",
        emoji: input.emoji ?? null,
        color: input.color ?? null,
        costPrice: input.costPrice ?? null,
        salePrice: input.salePrice ?? null,
        minStock: input.minStock ?? 10,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await localDb.flavors.put(flavor);
      await enqueue("flavor", { ...input, id: flavor.id });
      syncEngine.requestSync();
      return flavor;
    }
    try {
      const flavor = await apiRequest<Flavor>("/flavors", { method: "POST", body: input });
      await localDb.flavors.put(flavor);
      return flavor;
    } catch (err) {
      if (isNetworkError(err)) return this.create(input);
      throw err;
    }
  },

  async update(id: string, input: Partial<{ name: string; emoji: string; color: string; costPrice: number; salePrice: number; minStock: number; active: boolean }>): Promise<Flavor> {
    const flavor = await apiRequest<Flavor>(`/flavors/${id}`, { method: "PATCH", body: input });
    await localDb.flavors.put(flavor);
    return flavor;
  },
};

export const suppliersApi = {
  async list(_includeInactive = false): Promise<Supplier[]> {
    try {
      const suppliers = await apiRequest<Supplier[]>("/suppliers");
      await localDb.suppliers.bulkPut(suppliers);
      return suppliers;
    } catch (err) {
      if (isNetworkError(err)) return localDb.suppliers.toArray();
      throw err;
    }
  },

  async create(input: { name: string; contact?: string; notes?: string }): Promise<Supplier> {
    if (!isOnline()) {
      const supplier: Supplier = {
        id: newId(),
        businessId: "",
        name: input.name,
        contact: input.contact ?? null,
        notes: input.notes ?? null,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await localDb.suppliers.put(supplier);
      await enqueue("supplier", { ...input, id: supplier.id });
      syncEngine.requestSync();
      return supplier;
    }
    try {
      const supplier = await apiRequest<Supplier>("/suppliers", { method: "POST", body: input });
      await localDb.suppliers.put(supplier);
      return supplier;
    } catch (err) {
      if (isNetworkError(err)) return this.create(input);
      throw err;
    }
  },

  async update(id: string, input: Partial<{ name: string; contact: string | null; notes: string | null; active: boolean }>): Promise<Supplier> {
    const supplier = await apiRequest<Supplier>(`/suppliers/${id}`, { method: "PATCH", body: input });
    await localDb.suppliers.put(supplier);
    return supplier;
  },
};

export const locationsApi = {
  async list(_includeInactive = false): Promise<Location[]> {
    try {
      const locations = await apiRequest<Location[]>("/locations");
      await localDb.locations.bulkPut(locations);
      return locations;
    } catch (err) {
      if (isNetworkError(err)) return localDb.locations.toArray();
      throw err;
    }
  },

  async create(input: { name: string }): Promise<Location> {
    const location = await apiRequest<Location>("/locations", { method: "POST", body: input });
    await localDb.locations.bulkPut(await this.list().catch(() => []));
    return location;
  },

  async update(id: string, input: { name?: string; active?: boolean }): Promise<Location> {
    const location = await apiRequest<Location>(`/locations/${id}`, { method: "PATCH", body: input });
    await localDb.locations.bulkPut(await this.list().catch(() => []));
    return location;
  },
};

export const businessApi = {
  async get(): Promise<Business> {
    try {
      const business = await apiRequest<Business>("/business");
      await localDb.business.put(business);
      return business;
    } catch (err) {
      if (isNetworkError(err)) {
        const cached = await localDb.business.toCollection().first();
        if (cached) return cached;
      }
      throw err;
    }
  },

  async update(input: Partial<Business>): Promise<Business> {
    const business = await apiRequest<Business>("/business", { method: "PATCH", body: input });
    await localDb.business.put(business);
    return business;
  },
};

export const inventoryApi = {
  async list(): Promise<FlavorInventory[]> {
    try {
      const inventory = await apiRequest<FlavorInventory[]>("/inventory");
      await localDb.inventory.bulkPut(toCachedInventory(inventory));
      return inventory;
    } catch (err) {
      if (isNetworkError(err)) return localDb.inventory.toArray();
      throw err;
    }
  },

  async getByFlavor(flavorId: string): Promise<FlavorInventoryDetail | null> {
    try {
      const detail = await apiRequest<FlavorInventoryDetail>(`/inventory/${flavorId}`);
      await localDb.inventory.put({
        ...detail.summary,
        flavorId: detail.summary.flavor.id,
      });
      await localDb.movements.bulkPut(detail.movements);
      return detail;
    } catch (err) {
      if (isNetworkError(err)) {
        const summary = await localDb.inventory.get(flavorId);
        if (!summary) return null;
        const movements = await localDb.movements
          .where("flavorId")
          .equals(flavorId)
          .reverse()
          .sortBy("date");
        return { summary, movements };
      }
      throw err;
    }
  },

  async registerMovement(input: NewMovementInput): Promise<InventoryMovement> {
    const payload = { ...input, id: newId() };
    if (!isOnline()) {
      const movement: InventoryMovement = {
        ...payload,
        businessId: "",
        quantity: isInbound(input.movementType) ? input.quantity : -input.quantity,
        unitCost: null,
        referenceId: null,
        notes: payload.notes ?? null,
        createdAt: new Date().toISOString(),
      };
      await localDb.movements.put(movement);
      await applyLocalInventoryDelta([
        { flavorId: input.flavorId, delta: movement.quantity },
      ]);
      await enqueue("movement", payload);
      syncEngine.requestSync();
      return movement;
    }
    try {
      const movement = await apiRequest<InventoryMovement>("/inventory/movements", {
        method: "POST",
        body: payload,
      });
      await localDb.movements.put(movement);
      await applyLocalInventoryDelta([
        { flavorId: input.flavorId, delta: movement.quantity },
      ]);
      return movement;
    } catch (err) {
      if (isNetworkError(err)) return this.registerMovement(input);
      throw err;
    }
  },
};

function isInbound(type: MovementType): boolean {
  return type === "PURCHASE" || type === "RETURN";
}

export const salesApi = {
  async list(from?: string, to?: string): Promise<Sale[]> {
    try {
      const sales = await apiRequest<Sale[]>("/sales", { query: { from, to } });
      await localDb.sales.bulkPut(sales);
      return sales;
    } catch (err) {
      if (isNetworkError(err)) {
        const sales = await localDb.sales.toArray();
        return sales.sort((a, b) => (a.saleDate < b.saleDate ? 1 : -1));
      }
      throw err;
    }
  },

  async getById(id: string): Promise<Sale | null> {
    try {
      return await apiRequest<Sale>(`/sales/${id}`);
    } catch (err) {
      if (isNetworkError(err)) return (await localDb.sales.get(id)) ?? null;
      throw err;
    }
  },

  async create(input: NewSaleInput): Promise<Sale> {
    const id = newId();
    const payload = { ...input, id };

    if (!isOnline()) {
      const sale = await createLocalSale(payload);
      await enqueue("sale", payload);
      syncEngine.requestSync();
      return sale;
    }

    try {
      const sale = await apiRequest<Sale>("/sales", { method: "POST", body: input });
      await localDb.sales.put(sale);
      await refreshInventoryCache();
      return sale;
    } catch (err) {
      if (isNetworkError(err)) {
        const sale = await createLocalSale(payload);
        await enqueue("sale", payload);
        syncEngine.requestSync();
        return sale;
      }
      throw err;
    }
  },

  async update(id: string, input: Partial<NewSaleInput>): Promise<Sale> {
    const sale = await apiRequest<Sale>(`/sales/${id}`, { method: "PATCH", body: input });
    await localDb.sales.put(sale);
    await refreshInventoryCache();
    return sale;
  },

  async delete(id: string): Promise<Sale> {
    const sale = await apiRequest<Sale>(`/sales/${id}`, { method: "DELETE" });
    await localDb.sales.delete(id);
    await refreshInventoryCache();
    return sale;
  },
};

/** Crea la venta local (offline) con totales estimados para la UI. */
async function createLocalSale(payload: NewSaleInput & { id: string }): Promise<Sale> {
  const inventory = await localDb.inventory.toArray();
  const byFlavor = new Map(inventory.map((i) => [i.flavor.id, i]));
  const items = payload.items.map((it) => {
    const cached = byFlavor.get(it.flavorId);
    return {
      id: newId(),
      saleId: payload.id,
      flavorId: it.flavorId,
      flavorName: cached?.flavor.name,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      unitCostSnapshot: cached?.lastCost ?? 0,
      subtotal: it.quantity * it.unitPrice,
    };
  });
  const total = items.reduce((acc, i) => acc + i.subtotal, 0);
  const sale: Sale = {
    id: payload.id,
    businessId: "",
    saleDate: payload.saleDate,
    location: payload.location,
    notes: payload.notes ?? null,
    total,
    profit: total - items.reduce((acc, i) => acc + i.quantity * i.unitCostSnapshot, 0),
    items,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await localDb.sales.put(sale);
  await applyLocalInventoryDelta(
    payload.items.map((i) => ({ flavorId: i.flavorId, delta: -i.quantity })),
  );
  return sale;
}

export const purchasesApi = {
  async list(from?: string, to?: string): Promise<Purchase[]> {
    try {
      const purchases = await apiRequest<Purchase[]>("/purchases", { query: { from, to } });
      await localDb.purchases.bulkPut(purchases);
      return purchases;
    } catch (err) {
      if (isNetworkError(err)) {
        const purchases = await localDb.purchases.toArray();
        return purchases.sort((a, b) => (a.purchaseDate < b.purchaseDate ? 1 : -1));
      }
      throw err;
    }
  },

  async create(input: NewPurchaseInput): Promise<Purchase> {
    const payload = { ...input, id: newId() };
    if (!isOnline()) {
      const items = input.items.map((it) => ({
        id: newId(),
        purchaseId: payload.id,
        flavorId: it.flavorId,
        quantity: it.quantity,
        unitCost: it.unitCost,
        subtotal: it.quantity * it.unitCost,
      }));
      const purchase: Purchase = {
        ...payload,
        businessId: "",
        notes: input.notes ?? null,
        totalCost: items.reduce((acc, i) => acc + i.subtotal, 0),
        items,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await localDb.purchases.put(purchase);
      await applyLocalInventoryDelta(
        input.items.map((i) => ({ flavorId: i.flavorId, delta: i.quantity })),
      );
      await enqueue("purchase", payload);
      syncEngine.requestSync();
      return purchase;
    }
    try {
      const purchase = await apiRequest<Purchase>("/purchases", { method: "POST", body: input });
      await localDb.purchases.put(purchase);
      await refreshInventoryCache();
      return purchase;
    } catch (err) {
      if (isNetworkError(err)) return this.create(input);
      throw err;
    }
  },
};

export const reportsApi = {
  async sales(from: string, to: string): Promise<SalesReport> {
    return apiRequest<SalesReport>("/reports/sales", { query: { from, to } });
  },

  async purchases(from: string, to: string): Promise<PurchasesReport> {
    return apiRequest<PurchasesReport>("/reports/purchases", { query: { from, to } });
  },

  async inventory(): Promise<FlavorInventory[]> {
    return inventoryApi.list();
  },
};

/** Refresca el caché de inventario tras una escritura exitosa. */
export async function refreshInventoryCache(): Promise<void> {
  try {
    const inventory = await apiRequest<FlavorInventory[]>("/inventory");
    await localDb.inventory.bulkPut(toCachedInventory(inventory));
  } catch {
    // Si falla la red, el caché local sigue siendo la mejor aproximación.
  }
}

/**
 * La tabla IndexedDB usa `flavorId` como clave; la API lo expone dentro de
 * `flavor.id`. Normalizamos en la frontera de persistencia para que el
 * almacenamiento local no dependa de la forma de la API.
 */
function toCachedInventory(inventory: FlavorInventory[]): CachedInventory[] {
  return inventory.map((i) => ({ ...i, flavorId: i.flavor.id }));
}

/** Envía operaciones del outbox al servidor (endpoint de sync). */
export async function syncOperationsApi(
  operations: { type: string; payload: Record<string, unknown> }[],
): Promise<{ results: SyncOperationResult[] }> {
  return apiRequest("/sync/operations", { method: "POST", body: { operations } });
}

export { ApiClientError };
