import type { DrizzleDb } from "../db/drizzle-types";
import { sales, saleItems, inventoryMovements } from "../db/schema";
import {
  calculateLineSubtotal,
  calculateSaleProfit,
  calculateSaleTotal,
} from "../domain/calculations/sales";
import type { Sale, SaleItem } from "../domain/types";
import { createFlavorRepository } from "../repositories/flavor.repository";
import { createMovementRepository, type NewMovement } from "../repositories/movement.repository";
import { createSaleRepository } from "../repositories/sale.repository";
import { ApiError } from "../utils/http-error";
import { newId } from "../utils/ids";

export interface CreateSaleInput {
  /** Opcional: el cliente lo envía al sincronizar desde offline. */
  id?: string;
  saleDate: string;
  location: string;
  notes?: string;
  items: { flavorId: string; quantity: number; unitPrice: number }[];
}

export function createSaleService(deps: { db: DrizzleDb; getBusinessId: () => Promise<string> }) {
  const { db, getBusinessId } = deps;
  const saleRepo = createSaleRepository(db);
  const movementRepo = createMovementRepository(db);
  const flavorRepo = createFlavorRepository(db);

  async function create(input: CreateSaleInput): Promise<Sale> {
    const businessId = await getBusinessId();
    const saleId = input.id ?? newId();
    const flavorIds = [...new Set(input.items.map((i) => i.flavorId))];

    // 1. Verificamos que todos los sabores existan
    const flavors = await flavorRepo.getByIds(businessId, flavorIds);
    const flavorMap = new Map(flavors.map((f) => [f.id, f]));
    for (const flavorId of flavorIds) {
      if (!flavorMap.has(flavorId)) {
        throw ApiError.notFound("Uno de los sabores de la venta no existe.");
      }
    }

    // 2. Disponibilidad actual y costo promedio por sabor
    const [availability, avgCosts] = await Promise.all([
      movementRepo.availabilityByFlavor(businessId, flavorIds),
      movementRepo.avgCostByFlavor(businessId),
    ]);

    // 3. Construimos los ítems con costo histórico congelado y validamos stock
    const items: SaleItem[] = input.items.map((it) => {
      const flavor = flavorMap.get(it.flavorId)!;
      const available = availability.get(it.flavorId) ?? 0;
      if (available < it.quantity) {
        throw new ApiError(
          409,
          "INSUFFICIENT_INVENTORY",
          `No hay suficientes paletas de ${flavor.name} disponibles.`,
        );
      }
      return {
        id: newId(),
        saleId,
        flavorId: it.flavorId,
        flavorName: flavor.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        // Regla crítica: el costo histórico se congela al momento de vender.
        unitCostSnapshot: avgCosts.get(it.flavorId) ?? 0,
        subtotal: calculateLineSubtotal(it),
      };
    });

    // 4. Totales calculados por el servidor (autoritativo)
    const total = calculateSaleTotal(items);
    const sale: Sale = {
      id: saleId,
      businessId,
      saleDate: input.saleDate,
      location: input.location,
      notes: input.notes?.trim() || null,
      total,
      items,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 5. Creación atómica: venta + ítems + movimientos de salida
    const movements: NewMovement[] = items.map((it) => ({
      id: newId(),
      businessId,
      flavorId: it.flavorId,
      movementType: "SALE" as const,
      quantity: -it.quantity,
      unitCost: it.unitCostSnapshot,
      referenceId: saleId,
      date: input.saleDate,
      notes: null,
    }));
    await db.transaction(async (tx: DrizzleDb) => {
      await tx.insert(sales).values({
        id: sale.id,
        businessId: sale.businessId,
        saleDate: sale.saleDate,
        location: sale.location,
        notes: sale.notes,
        total: sale.total,
        createdAt: sale.createdAt,
        updatedAt: sale.updatedAt,
      });
      if (items.length > 0) {
        await tx.insert(saleItems).values(
          items.map((it) => ({
            id: it.id,
            saleId: it.saleId,
            flavorId: it.flavorId,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            unitCostSnapshot: it.unitCostSnapshot,
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
    return sale;
  }

  async function list(from?: string, to?: string): Promise<Sale[]> {
    return saleRepo.list(await getBusinessId(), from, to);
  }

  async function getById(id: string): Promise<Sale | null> {
    return saleRepo.getById(await getBusinessId(), id);
  }

  async function deleteSale(id: string): Promise<Sale> {
    const businessId = await getBusinessId();
    const sale = await saleRepo.delete(businessId, id);
    if (!sale) {
      throw ApiError.notFound("La venta no existe.");
    }
    return sale;
  }

  async function update(
    id: string,
    input: {
      saleDate?: string;
      location?: string;
      notes?: string | null;
      items?: { flavorId: string; quantity: number; unitPrice: number }[];
    },
  ): Promise<Sale> {
    const businessId = await getBusinessId();
    const existing = await saleRepo.getById(businessId, id);
    if (!existing) {
      throw ApiError.notFound("La venta no existe.");
    }

    // Si se proveen items nuevos, recalcular todo
    if (input.items && input.items.length > 0) {
      const flavorIds = [...new Set(input.items.map((i) => i.flavorId))];

      // Verificar que todos los sabores existan
      const flavorsList = await flavorRepo.getByIds(businessId, flavorIds);
      const flavorMap = new Map(flavorsList.map((f) => [f.id, f]));
      for (const flavorId of flavorIds) {
        if (!flavorMap.has(flavorId)) {
          throw ApiError.notFound("Uno de los sabores de la venta no existe.");
        }
      }

      // Obtener disponibilidad y costo promedio actual
      const [availability, avgCosts] = await Promise.all([
        movementRepo.availabilityByFlavor(businessId, flavorIds),
        movementRepo.avgCostByFlavor(businessId),
      ]);

      // Calcular diferencia de inventario (restar lo que ya estaba, sumar lo nuevo)
      const oldQuantities = new Map<string, number>();
      for (const item of existing.items) {
        oldQuantities.set(item.flavorId, (oldQuantities.get(item.flavorId) ?? 0) + item.quantity);
      }
      const newQuantities = new Map<string, number>();
      for (const item of input.items) {
        newQuantities.set(item.flavorId, (newQuantities.get(item.flavorId) ?? 0) + item.quantity);
      }

      // Verificar inventario suficiente para la diferencia neta
      for (const [flavorId, newQty] of newQuantities) {
        const oldQty = oldQuantities.get(flavorId) ?? 0;
        const netChange = newQty - oldQty;
        if (netChange > 0) {
          const available = availability.get(flavorId) ?? 0;
          if (available < netChange) {
            const flavor = flavorMap.get(flavorId)!;
            throw new ApiError(
              409,
              "INSUFFICIENT_INVENTORY",
              `No hay suficientes paletas de ${flavor.name} disponibles.`,
            );
          }
        }
      }

      // Construir nuevos items con costo histórico congelado
      const newItems: SaleItem[] = input.items.map((it) => {
        const flavor = flavorMap.get(it.flavorId)!;
        return {
          id: newId(),
          saleId: id,
          flavorId: it.flavorId,
          flavorName: flavor.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          unitCostSnapshot: avgCosts.get(it.flavorId) ?? 0,
          subtotal: calculateLineSubtotal(it),
        };
      });

      const total = calculateSaleTotal(newItems);

      // Transacción atómica: eliminar viejos items/movimientos, crear nuevos, actualizar venta
      await saleRepo.deleteItems(businessId, id);
      await saleRepo.insertItems(businessId, id, newItems);

      // Crear nuevos movimientos de inventario
      const movements = newItems.map((it) => ({
        id: newId(),
        flavorId: it.flavorId,
        movementType: "SALE" as const,
        quantity: -it.quantity,
        unitCost: it.unitCostSnapshot,
        referenceId: id,
        date: input.saleDate ?? existing.saleDate,
        notes: null,
      }));
      await saleRepo.insertMovements(businessId, movements);

      // Actualizar la venta
      const updated = await saleRepo.update(businessId, id, {
        saleDate: input.saleDate,
        location: input.location,
        notes: input.notes,
        total,
      });

      if (!updated) {
        throw ApiError.notFound("La venta no existe.");
      }
      return updated;
    }

    // Sin cambios de items: solo actualizar metadatos
    const updated = await saleRepo.update(businessId, id, {
      saleDate: input.saleDate,
      location: input.location,
      notes: input.notes,
    });

    if (!updated) {
      throw ApiError.notFound("La venta no existe.");
    }
    return updated;
  }

  /** Ganancia estimada de una venta (para el resumen del frontend). */
  function estimateProfit(sale: Sale): number {
    // Los ítems guardan el costo histórico como unitCostSnapshot;
    // lo mapeamos al campo que esperan los cálculos puros.
    return calculateSaleProfit(
      sale.items.map((i) => ({
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        unitCost: i.unitCostSnapshot,
      })),
    );
  }

  return { create, list, getById, delete: deleteSale, update, estimateProfit };
}
