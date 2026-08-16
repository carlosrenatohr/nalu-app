import type { DrizzleDb } from "../db/drizzle-types";
import { purchases, purchaseItems, inventoryMovements } from "../db/schema";
import { calculateLineSubtotal, calculateSaleCost } from "../domain/calculations/sales";
import type { Purchase, PurchaseItem } from "../domain/types";
import { createFlavorRepository } from "../repositories/flavor.repository";
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

export function createPurchaseService(deps: { db: DrizzleDb; getBusinessId: () => Promise<string> }) {
  const { db, getBusinessId } = deps;
  const purchaseRepo = createPurchaseRepository(db);
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
    const movements: NewMovement[] = items.map((it) => ({
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
    await db.transaction(async (tx: DrizzleDb) => {
      await tx.insert(purchases).values({
        id: purchase.id,
        businessId: purchase.businessId,
        supplierId: purchase.supplierId,
        purchaseDate: purchase.purchaseDate,
        notes: purchase.notes,
        totalCost: purchase.totalCost,
        createdAt: purchase.createdAt,
        updatedAt: purchase.updatedAt,
      });
      if (items.length > 0) {
        await tx.insert(purchaseItems).values(
          items.map((it) => ({
            id: it.id,
            purchaseId: it.purchaseId,
            flavorId: it.flavorId,
            quantity: it.quantity,
            unitCost: it.unitCost,
            subtotal: it.subtotal,
          })),
        );
      }
      if (movements.length > 0) {
        await tx.insert(inventoryMovements).values(
          movements.map((m) => ({
            id: m.id,
            businessId: m.businessId,
            flavorId: m.flavorId,
            movementType: m.movementType,
            quantity: m.quantity,
            unitCost: m.unitCost,
            referenceId: m.referenceId,
            date: m.date,
            notes: m.notes,
            createdAt: new Date().toISOString(),
          })),
        );
      }
    });
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
