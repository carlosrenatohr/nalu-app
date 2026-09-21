import type { DrizzleDb } from "../db/drizzle-types";
import { purchases } from "../db/schema";
import { runAtomic } from "../db/atomic";
import { calculateLineSubtotal, calculateSaleCost } from "../domain/calculations/sales";
import type { Purchase, PurchaseItem } from "../domain/types";
import { createFlavorRepository } from "../repositories/flavor.repository";
import { createMovementRepository, type NewMovement } from "../repositories/movement.repository";
import { createPurchaseRepository } from "../repositories/purchase.repository";
import { createSupplierRepository } from "../repositories/supplier.repository";
import { ApiError } from "../utils/http-error";
import { newId } from "../utils/ids";

export interface CreatePurchaseInput {
  id?: string;
  purchaseDate: string;
  supplierId: string;
  notes?: string;
  items: { flavorId: string; quantity: number; unitCost: number }[];
}

export interface UpdatePurchaseInput {
  purchaseDate?: string;
  supplierId?: string;
  notes?: string | null;
  items?: { flavorId: string; quantity: number; unitCost: number }[];
}

export function createPurchaseService(deps: { db: DrizzleDb; getBusinessId: () => Promise<string> }) {
  const { db, getBusinessId } = deps;
  const purchaseRepo = createPurchaseRepository(db);
  const flavorRepo = createFlavorRepository(db);
  const supplierRepo = createSupplierRepository(db);
  const movementRepo = createMovementRepository(db);

  async function create(input: CreatePurchaseInput): Promise<Purchase> {
    const businessId = await getBusinessId();
    const purchaseId = input.id ?? newId();

    // 1. El proveedor debe existir
    const supplier = await supplierRepo.getById(businessId, input.supplierId);
    if (!supplier) {
      throw ApiError.notFound("El proveedor no existe.");
    }

    // 2. Los sabores deben existir y estar activos
    const flavorIds = [...new Set(input.items.map((i) => i.flavorId))];
    const flavors = await flavorRepo.getByIds(businessId, flavorIds);
    const flavorMap = new Map(flavors.map((f) => [f.id, f]));
    for (const flavorId of flavorIds) {
      const flavor = flavorMap.get(flavorId);
      if (!flavor) {
        throw ApiError.notFound("Uno de los sabores de la compra no existe.");
      }
      if (!flavor.active) {
        throw ApiError.badRequest(
          "FLAVOR_INACTIVE",
          `El sabor "${flavor.name}" está desactivado y no puede usarse en una nueva compra.`,
        );
      }
    }

    // 3. Ítems con subtotales calculados por el servidor
    const items: PurchaseItem[] = input.items.map((it) => {
      const flavor = flavorMap.get(it.flavorId)!;
      return {
        id: newId(),
        purchaseId,
        flavorId: it.flavorId,
        flavorName: flavor.name,
        quantity: it.quantity,
        unitCost: it.unitCost,
        subtotal: calculateLineSubtotal({ quantity: it.quantity, unitPrice: it.unitCost }),
      };
    });

    const totalCost = calculateSaleCost(items);
    const purchase: Purchase = {
      id: purchaseId,
      businessId,
      supplierId: input.supplierId,
      supplierName: supplier.name,
      purchaseDate: input.purchaseDate,
      notes: input.notes?.trim() || null,
      totalCost,
      items,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 4. Creación atómica: compra + ítems + movimientos de entrada
    const movements = items.map((it) => ({
      id: newId(),
      businessId,
      flavorId: it.flavorId,
      movementType: "PURCHASE" as const,
      quantity: it.quantity,
      unitCost: it.unitCost,
      referenceId: purchaseId,
      date: input.purchaseDate,
      notes: null,
    }));
    await runAtomic(db, [
      db.insert(purchases).values({
        id: purchase.id,
        businessId: purchase.businessId,
        supplierId: purchase.supplierId,
        purchaseDate: purchase.purchaseDate,
        notes: purchase.notes,
        totalCost: purchase.totalCost,
        createdAt: purchase.createdAt,
        updatedAt: purchase.updatedAt,
      }),
      ...(await purchaseRepo.insertItemsStatements(businessId, purchaseId, items)),
      ...(await purchaseRepo.insertMovementsStatements(businessId, movements)),
    ]);
    return purchase;
  }

  async function list(from?: string, to?: string): Promise<Purchase[]> {
    return purchaseRepo.list(await getBusinessId(), from, to);
  }

  async function getById(id: string): Promise<Purchase | null> {
    return purchaseRepo.getById(await getBusinessId(), id);
  }

  async function update(id: string, input: UpdatePurchaseInput): Promise<Purchase> {
    const businessId = await getBusinessId();
    const existing = await purchaseRepo.getById(businessId, id);
    if (!existing) {
      throw ApiError.notFound("La compra no existe.");
    }

    // Si se proveen ítems nuevos, recalcular todo (movimientos + total)
    if (input.items && input.items.length > 0) {
      const supplierId = input.supplierId ?? existing.supplierId;
      const supplier = await supplierRepo.getById(businessId, supplierId);
      if (!supplier) {
        throw ApiError.notFound("El proveedor no existe.");
      }

      // Los sabores deben existir
      const flavorIds = [...new Set(input.items.map((i) => i.flavorId))];
      const flavorsList = await flavorRepo.getByIds(businessId, flavorIds);
      const flavorMap = new Map(flavorsList.map((f) => [f.id, f]));
      for (const flavorId of flavorIds) {
        if (!flavorMap.has(flavorId)) {
          throw ApiError.notFound("Uno de los sabores de la compra no existe.");
        }
      }

      // Cantidades viejas vs nuevas por sabor
      const oldQuantities = new Map<string, number>();
      for (const item of existing.items) {
        oldQuantities.set(item.flavorId, (oldQuantities.get(item.flavorId) ?? 0) + item.quantity);
      }
      const newQuantities = new Map<string, number>();
      for (const item of input.items) {
        newQuantities.set(item.flavorId, (newQuantities.get(item.flavorId) ?? 0) + item.quantity);
      }

      // El disponible actual ya incluye los movimientos PURCHASE de esta compra,
      // así que el resultado tras el cambio es: disponible + (nuevo − viejo).
      const availability = await movementRepo.availabilityByFlavor(businessId, flavorIds);
      for (const [flavorId, newQty] of newQuantities) {
        const oldQty = oldQuantities.get(flavorId) ?? 0;
        const available = availability.get(flavorId) ?? 0;
        if (available + (newQty - oldQty) < 0) {
          const flavor = flavorMap.get(flavorId)!;
          throw new ApiError(
            409,
            "INSUFFICIENT_INVENTORY",
            `No se puede reducir la compra de ${flavor.name}: el inventario quedaría negativo. Registra primero una entrada o ajusta el stock.`,
          );
        }
      }

      // Ítems con subtotales calculados por el servidor
      const items: PurchaseItem[] = input.items.map((it) => {
        const flavor = flavorMap.get(it.flavorId)!;
        return {
          id: newId(),
          purchaseId: id,
          flavorId: it.flavorId,
          flavorName: flavor.name,
          quantity: it.quantity,
          unitCost: it.unitCost,
          subtotal: calculateLineSubtotal({ quantity: it.quantity, unitPrice: it.unitCost }),
        };
      });
      const totalCost = calculateSaleCost(items);

      // Movimientos de entrada regenerados (trazabilidad a esta compra)
      const movements: NewMovement[] = items.map((it) => ({
        id: newId(),
        businessId,
        flavorId: it.flavorId,
        movementType: "PURCHASE" as const,
        quantity: it.quantity,
        unitCost: it.unitCost,
        referenceId: id,
        date: input.purchaseDate ?? existing.purchaseDate,
        notes: null,
      }));

      // Transacción atómica: eliminar viejos ítems/movimientos, crear nuevos, actualizar compra
      await runAtomic(db, [
        ...(await purchaseRepo.deleteItemsStatements(businessId, id)),
        ...(await purchaseRepo.insertItemsStatements(businessId, id, items)),
        ...(await purchaseRepo.insertMovementsStatements(businessId, movements)),
        purchaseRepo.updateStatements(businessId, id, {
          supplierId,
          purchaseDate: input.purchaseDate,
          notes: input.notes,
          totalCost,
        }),
      ]);

      const updated = await purchaseRepo.getById(businessId, id);
      if (!updated) {
        throw ApiError.notFound("La compra no existe.");
      }
      return updated;
    }

    // Sin cambios de ítems: solo actualizar metadatos
    if (input.supplierId) {
      const supplier = await supplierRepo.getById(businessId, input.supplierId);
      if (!supplier) {
        throw ApiError.notFound("El proveedor no existe.");
      }
    }
    await runAtomic(db, [
      purchaseRepo.updateStatements(businessId, id, {
        supplierId: input.supplierId,
        purchaseDate: input.purchaseDate,
        notes: input.notes,
      }),
    ]);
    const updated = await purchaseRepo.getById(businessId, id);

    if (!updated) {
      throw ApiError.notFound("La compra no existe.");
    }
    return updated;
  }

  async function deletePurchase(id: string): Promise<Purchase> {
    const businessId = await getBusinessId();
    const existing = await purchaseRepo.getById(businessId, id);
    if (!existing) {
      throw ApiError.notFound("La compra no existe.");
    }

    // Tras eliminar la compra, el disponible de cada sabor baja en lo comprado.
    // Bloqueamos si algún sabor quedaría con inventario negativo.
    const flavorIds = [...new Set(existing.items.map((i) => i.flavorId))];
    const [availability, flavorsList] = await Promise.all([
      movementRepo.availabilityByFlavor(businessId, flavorIds),
      flavorRepo.getByIds(businessId, flavorIds),
    ]);
    const flavorMap = new Map(flavorsList.map((f) => [f.id, f]));

    const oldQuantities = new Map<string, number>();
    for (const item of existing.items) {
      oldQuantities.set(item.flavorId, (oldQuantities.get(item.flavorId) ?? 0) + item.quantity);
    }
    for (const [flavorId, oldQty] of oldQuantities) {
      const available = availability.get(flavorId) ?? 0;
      if (available - oldQty < 0) {
        const flavor = flavorMap.get(flavorId);
        throw new ApiError(
          409,
          "INSUFFICIENT_INVENTORY",
          `No se puede eliminar la compra: el inventario de ${flavor?.name ?? "un sabor"} quedaría negativo. Registra primero una entrada o ajusta el stock.`,
        );
      }
    }

    await runAtomic(db, await purchaseRepo.deleteStatements(businessId, id));

    return existing;
  }

  return { create, list, getById, update, delete: deletePurchase };
}
