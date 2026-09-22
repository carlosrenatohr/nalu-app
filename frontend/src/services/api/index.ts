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
  NewMovementInput,
  NewPurchaseInput,
  NewSaleInput,
  Purchase,
  PurchasesReport,
  PaginatedSales,
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
  async list(includeInactive = false): Promise<Flavor[]> {
    try {
      const flavors = await apiRequest<Flavor[]>("/flavors", {
        query: includeInactive ? { includeInactive: "true" } : undefined,
      });
      await localDb.flavors.bulkPut(flavors);
      return flavors;
    } catch (err) {
      if (isNetworkError(err)) {
        // El caché guarda todos los sabores; sin includeInactive devolvemos
        // solo los activos, igual que el servidor (los archivados no deben
        // aparecer para nuevas ventas/compras).
        const cached = await localDb.flavors.toArray();
        return includeInactive ? cached : cached.filter((f) => f.active);
      }
      throw err;
    }
  },

  async create(input: { name: string; emoji?: string; color?: string; costPrice?: number; salePrice?: number; minStock?: number }): Promise<Flavor> {
    if (isOnline()) {
      try {
        const flavor = await apiRequest<Flavor>("/flavors", { method: "POST", body: input });
        await localDb.flavors.put(flavor);
        return flavor;
      } catch (err) {
        // La red cayó con la interfaz aún "en línea": NO reintentar el
        // servidor en bucle (antes `this.create()` recursaba sin fin);
        // caemos directo a la vía offline de abajo.
        if (!isNetworkError(err)) throw err;
      }
    }
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
  },

  async update(id: string, input: Partial<{ name: string; emoji: string; color: string; costPrice: number; salePrice: number; minStock: number; active: boolean }>): Promise<Flavor> {
    if (!isOnline()) {
      const existing = await localDb.flavors.get(id);
      const updated = existing
        ? { ...existing, ...input, updatedAt: new Date().toISOString() }
        : undefined;
      if (updated) await localDb.flavors.put(updated);
      await enqueue("flavor", { ...input, id }, "update");
      syncEngine.requestSync();
      return updated ?? ({ id } as Flavor);
    }
    const flavor = await apiRequest<Flavor>(`/flavors/${id}`, { method: "PATCH", body: input });
    await localDb.flavors.put(flavor);
    return flavor;
  },

  /**
   * Elimina un sabor. El servidor lo borra físicamente si no tiene
   * referencias, o lo archiva si conserva historial (archived = true).
   */
  async delete(id: string): Promise<{ flavor: Flavor; archived: boolean }> {
    if (!isOnline()) {
      await localDb.flavors.delete(id);
      await enqueue("flavor", { id }, "delete");
      syncEngine.requestSync();
      return { flavor: { id } as Flavor, archived: false };
    }
    const result = await apiRequest<{ flavor: Flavor; archived: boolean }>(`/flavors/${id}`, {
      method: "DELETE",
    });
    await localDb.flavors.delete(id);
    return result;
  },
};

export const suppliersApi = {
  async list(includeInactive = false): Promise<Supplier[]> {
    try {
      const suppliers = await apiRequest<Supplier[]>("/suppliers", {
        query: includeInactive ? { includeInactive: "true" } : undefined,
      });
      await localDb.suppliers.bulkPut(suppliers);
      return suppliers;
    } catch (err) {
      if (isNetworkError(err)) return localDb.suppliers.toArray();
      throw err;
    }
  },

  async create(input: { name: string; contact?: string; notes?: string }): Promise<Supplier> {
    if (isOnline()) {
      try {
        const supplier = await apiRequest<Supplier>("/suppliers", { method: "POST", body: input });
        await localDb.suppliers.put(supplier);
        return supplier;
      } catch (err) {
        // Red cayó en caliente: sin recursión (antes `this.create()`
        // podía reintentar el servidor indefinidamente) → cola offline.
        if (!isNetworkError(err)) throw err;
      }
    }
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
  },

  async update(id: string, input: Partial<{ name: string; contact: string | null; notes: string | null; active: boolean }>): Promise<Supplier> {
    if (isOnline()) {
      try {
        const supplier = await apiRequest<Supplier>(`/suppliers/${id}`, { method: "PATCH", body: input });
        await localDb.suppliers.put(supplier);
        return supplier;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
      }
    }
    // Cola offline: refleja el cambio local y lo encola para después.
    const existing = await localDb.suppliers.get(id);
    const updated = existing
      ? { ...existing, ...input, updatedAt: new Date().toISOString() }
      : undefined;
    if (updated) await localDb.suppliers.put(updated);
    await enqueue("supplier", { ...input, id }, "update");
    syncEngine.requestSync();
    return updated ?? ({ id } as Supplier);
  },

  /**
   * Elimina un proveedor: lo borra físicamente si no tiene compras, o lo
   * archiva si conserva historial. Offline encola el borrado (el servidor
   * decide al sincronizar) y oculta la fila localmente.
   */
  async delete(id: string): Promise<{ supplier: Supplier; archived: boolean }> {
    if (isOnline()) {
      try {
        const result = await apiRequest<{ supplier: Supplier; archived: boolean }>(`/suppliers/${id}`, {
          method: "DELETE",
        });
        await localDb.suppliers.delete(id);
        return result;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
      }
    }
    const existing = await localDb.suppliers.get(id);
    await localDb.suppliers.delete(id);
    await enqueue("supplier", { id }, "delete");
    syncEngine.requestSync();
    return { supplier: existing ?? ({ id } as Supplier), archived: false };
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
    const isIn =
      input.movementType === "PURCHASE" ||
      input.movementType === "RETURN" ||
      (input.movementType === "ADJUSTMENT" && input.direction === "in");
    const signedQuantity = isIn ? input.quantity : -input.quantity;
    if (isOnline()) {
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
        // Red cayó en caliente: caemos a la vía offline sin recursar
        // (antes `this.registerMovement()` podía reintentar sin fin).
        if (!isNetworkError(err)) throw err;
      }
    }
    const movement: InventoryMovement = {
      ...payload,
      businessId: "",
      quantity: signedQuantity,
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
  },
};

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

  /**
   * Lista paginada (page 1-based) para "Cargar más".
   * Sin conexión: slice local sobre el caché con el mismo orden del
   * servidor (venta más reciente primero) y total real del rango.
   */
  async listPage(
    from: string | undefined,
    to: string | undefined,
    page: number,
    limit: number,
  ): Promise<PaginatedSales> {
    try {
      return await apiRequest<PaginatedSales>("/sales", {
        query: { from, to, page: String(page), limit: String(limit) },
      });
    } catch (err) {
      if (isNetworkError(err)) {
        const all = (await localDb.sales.toArray())
          .filter((s) => (!from || s.saleDate >= from) && (!to || s.saleDate <= to))
          .sort(
            (a, b) =>
              b.saleDate.localeCompare(a.saleDate) ||
              b.createdAt.localeCompare(a.createdAt),
          );
        const start = (page - 1) * limit;
        return { items: all.slice(start, start + limit), total: all.length, page, limit };
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
    if (!isOnline()) {
      await enqueue("sale", { ...input, id }, "update");
      await updateLocalSale(id, input);
      syncEngine.requestSync();
      return (await localDb.sales.get(id)) ?? ({} as Sale);
    }
    const sale = await apiRequest<Sale>(`/sales/${id}`, { method: "PATCH", body: input });
    await localDb.sales.put(sale);
    await refreshInventoryCache();
    return sale;
  },

  async delete(id: string): Promise<Sale> {
    if (!isOnline()) {
      const existing = await localDb.sales.get(id);
      if (existing) {
        await applyLocalInventoryDelta(
          existing.items.map((i) => ({ flavorId: i.flavorId, delta: i.quantity })),
        );
        await localDb.sales.delete(id);
      }
      await enqueue("sale", { id }, "delete");
      syncEngine.requestSync();
      return existing ?? ({} as Sale);
    }
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
    paymentType: payload.paymentType ?? "cash",
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

/**
 * Aplica localmente (offline) una edición de venta: revierte las salidas
 * viejas, aplica las nuevas y actualiza el registro local. Es una
 * estimación para la UI; el servidor recalcula al sincronizar.
 */
async function updateLocalSale(id: string, input: Partial<NewSaleInput>): Promise<void> {
  const existing = await localDb.sales.get(id);
  if (!existing) return;

  if (input.items) {
    // Corrige el inventario: devolver la venta vieja (+) y descontar la
    // nueva (−). Neto = vieja − nueva por sabor.
    const oldDeltas = existing.items.map((i) => ({ flavorId: i.flavorId, delta: i.quantity }));
    const newDeltas = input.items.map((i) => ({ flavorId: i.flavorId, delta: -i.quantity }));
    const map = new Map<string, number>();
    for (const d of [...oldDeltas, ...newDeltas]) {
      map.set(d.flavorId, (map.get(d.flavorId) ?? 0) + d.delta);
    }
    await applyLocalInventoryDelta(
      Array.from(map.entries()).map(([flavorId, delta]) => ({ flavorId, delta })),
    );

    const existingById = new Map(existing.items.map((i) => [i.flavorId, i]));
    const items = input.items.map((it) => {
      const prev = existingById.get(it.flavorId);
      return {
        id: prev?.id ?? newId(),
        saleId: id,
        flavorId: it.flavorId,
        flavorName: prev?.flavorName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        unitCostSnapshot: prev?.unitCostSnapshot ?? 0,
        subtotal: it.quantity * it.unitPrice,
      };
    });
    const total = items.reduce((acc, i) => acc + i.subtotal, 0);
    await localDb.sales.put({
      ...existing,
      ...(input.saleDate !== undefined ? { saleDate: input.saleDate } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.paymentType !== undefined ? { paymentType: input.paymentType } : {}),
      items,
      total,
      profit: total - items.reduce((acc, i) => acc + i.quantity * i.unitCostSnapshot, 0),
      updatedAt: new Date().toISOString(),
    });
  } else {
    await localDb.sales.put({
      ...existing,
      ...(input.saleDate !== undefined ? { saleDate: input.saleDate } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.paymentType !== undefined ? { paymentType: input.paymentType } : {}),
      updatedAt: new Date().toISOString(),
    });
  }
}

/** Aplica la edición de compra offline: delta de inventario (neto = nuevo − viejo) y documento local. */
async function updateLocalPurchase(id: string, input: Partial<NewPurchaseInput>): Promise<void> {
  const existing = await localDb.purchases.get(id);
  if (!existing) return;

  const scalars: Partial<Pick<Purchase, "purchaseDate" | "supplierId" | "notes" | "paymentType">> = {};
  if (input.purchaseDate !== undefined) scalars.purchaseDate = input.purchaseDate;
  if (input.supplierId !== undefined) scalars.supplierId = input.supplierId;
  if (input.notes !== undefined) scalars.notes = input.notes;
  if (input.paymentType !== undefined) scalars.paymentType = input.paymentType;

  if (input.items && input.items.length > 0) {
    // La compra aportaba stock (+viejo); al editar: quitar lo viejo (−)
    // y sumar lo nuevo (+). Neto = nuevo − viejo por sabor.
    const oldDeltas = existing.items.map((i) => ({ flavorId: i.flavorId, delta: -i.quantity }));
    const newDeltas = input.items.map((i) => ({ flavorId: i.flavorId, delta: i.quantity }));
    const map = new Map<string, number>();
    for (const d of [...oldDeltas, ...newDeltas]) {
      map.set(d.flavorId, (map.get(d.flavorId) ?? 0) + d.delta);
    }
    await applyLocalInventoryDelta(
      Array.from(map.entries()).map(([flavorId, delta]) => ({ flavorId, delta })),
    );

    const existingById = new Map(existing.items.map((i) => [i.flavorId, i]));
    const items = input.items.map((it) => {
      const prev = existingById.get(it.flavorId);
      return {
        id: prev?.id ?? newId(),
        purchaseId: id,
        flavorId: it.flavorId,
        flavorName: prev?.flavorName,
        quantity: it.quantity,
        unitCost: it.unitCost,
        subtotal: it.quantity * it.unitCost,
      };
    });
    const totalCost = items.reduce((acc, i) => acc + i.subtotal, 0);
    await localDb.purchases.put({
      ...existing,
      ...scalars,
      items,
      totalCost,
      updatedAt: new Date().toISOString(),
    });
  } else {
    await localDb.purchases.put({
      ...existing,
      ...scalars,
      updatedAt: new Date().toISOString(),
    });
  }
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
    if (isOnline()) {
      try {
        const purchase = await apiRequest<Purchase>("/purchases", { method: "POST", body: input });
        await localDb.purchases.put(purchase);
        await refreshInventoryCache();
        return purchase;
      } catch (err) {
        // Red cayó en caliente: caemos a la cola offline SIN recursar
        // (antes `this.create()` podía reintentar el servidor sin fin).
        if (!isNetworkError(err)) throw err;
      }
    }
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
      paymentType: payload.paymentType ?? "cash",
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
  },

  async update(id: string, input: Partial<NewPurchaseInput>): Promise<Purchase> {
    if (isOnline()) {
      try {
        const purchase = await apiRequest<Purchase>(`/purchases/${id}`, {
          method: "PATCH",
          body: input,
        });
        await localDb.purchases.put(purchase);
        await refreshInventoryCache();
        return purchase;
      } catch (err) {
        // Red cayó en caliente → misma cola que el modo offline.
        if (!isNetworkError(err)) throw err;
      }
    }
    // Cola offline: refleja el cambio localmente (con su delta de
    // inventario si cambiaron los ítems) y lo encola; el servidor es la
    // fuente de verdad al sincronizar.
    await enqueue("purchase", { ...input, id }, "update");
    await updateLocalPurchase(id, input);
    syncEngine.requestSync();
    return (await localDb.purchases.get(id)) ?? ({ id } as Purchase);
  },

  /**
   * Elimina la compra. Offline replica el servidor: baja del stock lo que
   * la compra había sumado y encola el borrado; si el servidor la
   * rechaza (INSUFFICIENT_INVENTORY) la op queda fallida y visible en
   * "Cambios pendientes".
   */
  async delete(id: string): Promise<Purchase> {
    if (isOnline()) {
      try {
        const purchase = await apiRequest<Purchase>(`/purchases/${id}`, { method: "DELETE" });
        await localDb.purchases.delete(id);
        await refreshInventoryCache();
        return purchase;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
      }
    }
    const existing = await localDb.purchases.get(id);
    if (existing) {
      await applyLocalInventoryDelta(
        existing.items.map((i) => ({ flavorId: i.flavorId, delta: -i.quantity })),
      );
      await localDb.purchases.delete(id);
    }
    await enqueue("purchase", { id }, "delete");
    syncEngine.requestSync();
    return existing ?? ({ id } as Purchase);
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
  operations: {
    opId: string;
    type: string;
    verb?: string;
    payload: Record<string, unknown>;
  }[],
): Promise<{ results: SyncOperationResult[] }> {
  return apiRequest("/sync/operations", { method: "POST", body: { operations } });
}

export { ApiClientError };
