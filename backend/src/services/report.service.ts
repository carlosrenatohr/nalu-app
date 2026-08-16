import type { DrizzleDb } from "../db/drizzle-types";
import { calculateProfitMargin } from "../domain/calculations/sales";
import { roundMoney } from "../domain/calculations/money";
import { createPurchaseRepository } from "../repositories/purchase.repository";
import { createReportRepository } from "../repositories/report.repository";
import type { Purchase } from "../domain/types";

export interface DateRange {
  from: string;
  to: string;
}

export function createReportService(deps: {
  db: DrizzleDb;
  getBusinessId: () => Promise<string>;
  getInventory: () => Promise<unknown>;
}) {
  const { db, getBusinessId, getInventory } = deps;
  const reportRepo = createReportRepository(db);
  const purchaseRepo = createPurchaseRepository(db);

  async function salesReport(range: DateRange) {
    const businessId = await getBusinessId();
    const [totals, byFlavor, byLocation, byPrice] = await Promise.all([
      reportRepo.salesTotals(businessId, range.from, range.to),
      reportRepo.salesByFlavor(businessId, range.from, range.to),
      reportRepo.salesByLocation(businessId, range.from, range.to),
      reportRepo.salesByPrice(businessId, range.from, range.to),
    ]);

    const profit = roundMoney(totals.total - totals.cost);
    return {
      range,
      totalSales: totals.total,
      unitsSold: totals.units,
      totalCost: totals.cost,
      profit,
      margin: calculateProfitMargin(profit, totals.total),
      byFlavor,
      byLocation,
      byPrice,
    };
  }

  async function purchasesReport(range: DateRange) {
    const purchases = await purchaseRepo.list(await getBusinessId(), range.from, range.to);

    // Análisis por proveedor calculado desde la lista (volumen pequeño)
    const bySupplier = new Map<
      string,
      { supplierId: string; supplierName: string; purchases: number; units: number; totalCost: number }
    >();
    let totalUnits = 0;
    let totalCost = 0;
    for (const purchase of purchases) {
      totalUnits += purchase.items.reduce((acc, i) => acc + i.quantity, 0);
      totalCost += purchase.totalCost;
      const entry = bySupplier.get(purchase.supplierId) ?? {
        supplierId: purchase.supplierId,
        supplierName: purchase.supplierName ?? "Desconocido",
        purchases: 0,
        units: 0,
        totalCost: 0,
      };
      entry.purchases += 1;
      entry.units += purchase.items.reduce((acc, i) => acc + i.quantity, 0);
      entry.totalCost = roundMoney(entry.totalCost + purchase.totalCost);
      bySupplier.set(purchase.supplierId, entry);
    }

    return {
      range,
      purchases,
      totalPurchases: purchases.length,
      totalUnits,
      totalCost: roundMoney(totalCost),
      bySupplier: [...bySupplier.values()].sort((a, b) => b.totalCost - a.totalCost),
    };
  }

  async function inventoryReport() {
    return getInventory();
  }

  return { salesReport, purchasesReport, inventoryReport };
}

export type { Purchase };
