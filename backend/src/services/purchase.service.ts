import type { Db } from "../db/types";
import { calculateLineSubtotal, calculateSaleCost } from "../domain/calculations/sales";
import type { Purchase, PurchaseItem } from "../domain/types";
import { createFlavorRepository } from "../repositories/flavor.repository";
import { createMovementRepository } from "../repositories/movement.repository";
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

export function createPurchaseService(deps: { db: Db; getBusinessId: () => Promise<string> }) {
  const { db, getBusinessId } = deps;
  const purchaseRepo = createPurchaseRepository(db);
  const movementRepo = createMovementRepository(db);
  const flavorRepo = createFlavorRepository(db);
  const supplierRepo = createSupplierRepository(db);

  async function create(input: CreatePurchaseInput): Promise<Purchase> {
    const businessId = await getBusinessId();
    const purchaseId = input.id ?? newId();

    // 1. El proveedor debe existir
    const supplier = await supplierRepo.getById(businessId, input.supplierId);
    if (!supplier) {
      throw ApiError.notFound("El proveedor no existe.");
    }

    // 2. Los sabores deben existir
    const flavorIds = [...new Set(input.items.map((i) => i.flavorId))];
    const flavors = await flavorRepo.getByIds(businessId, flavorIds);
    const flavorMap = new Map(flavors.map((f) => [f.id, f]));
    for (const flavorId of flavorIds) {
      if (!flavorMap.has(flavorId)) {
        throw ApiError.notFound("Uno de los sabores de la compra no existe.");
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
    await db.batch([
      ...purchaseRepo.buildCreateStatements(purchase, items),
      ...movementRepo.buildCreateStatements(movements),
    ]);
    return purchase;
  }

  async function list(from?: string, to?: string): Promise<Purchase[]> {
    return purchaseRepo.list(await getBusinessId(), from, to);
  }

  async function getById(id: string): Promise<Purchase | null> {
    return purchaseRepo.getById(await getBusinessId(), id);
  }

  return { create, list, getById };
}
