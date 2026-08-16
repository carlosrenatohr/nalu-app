import type { Db } from "../db/types";
import {
  calculateInventory,
  calculateInventoryValue,
  isInbound,
  isLowStock,
} from "../domain/calculations/inventory";
import type { FlavorInventory, InventoryMovement, MovementType } from "../domain/types";
import { createFlavorRepository } from "../repositories/flavor.repository";
import { createMovementRepository } from "../repositories/movement.repository";
import type { NewMovement } from "../repositories/movement.repository";
import { ApiError } from "../utils/http-error";
import { newId } from "../utils/ids";

export interface RegisterMovementInput {
  id?: string;
  flavorId: string;
  movementType: MovementType;
  /** Cantidad positiva; el servicio aplica el signo según el tipo. */
  quantity: number;
  date: string;
  notes?: string;
}

export function createInventoryService(deps: { db: Db; getBusinessId: () => Promise<string> }) {
  const { db, getBusinessId } = deps;
  const movementRepo = createMovementRepository(db);
  const flavorRepo = createFlavorRepository(db);

  /**
   * Inventario completo, derivado SIEMPRE del modelo de movimientos.
   * No existen conteos paralelos: disponible = suma de cantidades firmadas.
   */
  async function getInventory(): Promise<FlavorInventory[]> {
    const businessId = await getBusinessId();
    const [flavors, byType, avgCosts, lastCosts] = await Promise.all([
      flavorRepo.list(businessId, true),
      movementRepo.totalsByType(businessId),
      movementRepo.avgCostByFlavor(businessId),
      movementRepo.lastPurchaseCost(businessId),
    ]);

    return flavors.map((flavor) => {
      const types = byType.get(flavor.id) ?? new Map<MovementType, number>();
      const movements = Array.from(types.entries()).map(([, total]) => ({
        quantity: total,
      }));
      const available = calculateInventory(movements);
      const avgCost = avgCosts.get(flavor.id) ?? 0;
      const value = calculateInventoryValue(available, avgCost);
      return {
        flavor,
        available,
        lastCost: lastCosts.get(flavor.id) ?? null,
        purchased: types.get("PURCHASE") ?? 0,
        sold: Math.abs(types.get("SALE") ?? 0),
        gifted: Math.abs(types.get("GIFT") ?? 0),
        personalUse: Math.abs(types.get("PERSONAL_USE") ?? 0),
        lost: Math.abs(types.get("LOSS") ?? 0),
        adjusted: Math.abs(types.get("ADJUSTMENT") ?? 0),
        returned: types.get("RETURN") ?? 0,
        value,
        lowStock: isLowStock(available, flavor.minStock),
      };
    });
  }

  /** Inventario de un solo sabor + historial de movimientos. */
  async function getFlavorInventory(
    flavorId: string,
  ): Promise<{ summary: FlavorInventory; movements: InventoryMovement[] } | null> {
    const businessId = await getBusinessId();
    const all = await getInventory();
    const summary = all.find((f) => f.flavor.id === flavorId);
    if (!summary) return null;
    const movements = await movementRepo.listByFlavor(businessId, flavorId);
    return { summary, movements };
  }

  /**
   * Registra una salida/entrada manual (regalo, consumo propio, pérdida,
   * ajuste, devolución). Nunca genera ingresos: solo crea el movimiento.
   */
  async function registerMovement(input: RegisterMovementInput): Promise<InventoryMovement> {
    const businessId = await getBusinessId();
    const flavor = await flavorRepo.getById(businessId, input.flavorId);
    if (!flavor) {
      throw ApiError.notFound("El sabor no existe.");
    }

    const outbound = !isInbound(input.movementType);
    if (outbound) {
      const available = (await movementRepo.availabilityByFlavor(businessId, [input.flavorId])).get(input.flavorId) ?? 0;
      if (available < input.quantity) {
        throw new ApiError(
          409,
          "INSUFFICIENT_INVENTORY",
          `No hay suficientes paletas de ${flavor.name} disponibles.`,
        );
      }
    }

    // La cantidad firmada: positiva en entradas, negativa en salidas.
    const quantity = outbound ? -input.quantity : input.quantity;
    const movement: NewMovement = {
      id: input.id ?? newId(),
      businessId,
      flavorId: input.flavorId,
      movementType: input.movementType,
      quantity,
      unitCost: null,
      referenceId: null,
      date: input.date,
      notes: input.notes?.trim() || null,
    };
    await movementRepo.create(movement);
    return { ...movement, createdAt: new Date().toISOString() };
  }

  return { getInventory, getFlavorInventory, registerMovement };
}
