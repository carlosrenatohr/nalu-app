import type { Db } from "../db/types";
import {
  calculateLineSubtotal,
  calculateSaleProfit,
  calculateSaleTotal,
} from "../domain/calculations/sales";
import type { Sale, SaleItem } from "../domain/types";
import { createFlavorRepository } from "../repositories/flavor.repository";
import { createMovementRepository } from "../repositories/movement.repository";
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

export function createSaleService(deps: { db: Db; getBusinessId: () => Promise<string> }) {
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
    const movements = items.map((it) => ({
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
    await db.batch([
      ...saleRepo.buildCreateStatements(sale, items),
      ...movementRepo.buildCreateStatements(movements),
    ]);
    return sale;
  }

  async function list(from?: string, to?: string): Promise<Sale[]> {
    return saleRepo.list(await getBusinessId(), from, to);
  }

  async function getById(id: string): Promise<Sale | null> {
    return saleRepo.getById(await getBusinessId(), id);
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

  return { create, list, getById, estimateProfit };
}
