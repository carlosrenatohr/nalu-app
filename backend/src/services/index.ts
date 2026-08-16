import type { Db } from "../db/types";
import { createAuthService } from "./auth.service";
import { createBusinessService } from "./business.service";
import { createFlavorService } from "./flavor.service";
import { createInventoryService } from "./inventory.service";
import { createLocationService } from "./location.service";
import { createPurchaseService } from "./purchase.service";
import { createReportService } from "./report.service";
import { createSaleService } from "./sale.service";
import { createSupplierService } from "./supplier.service";
import { createSyncService } from "./sync.service";

export function createServices(deps: { db: Db; getBusinessId: () => Promise<string> }) {
  const { db, getBusinessId } = deps;

  const auth = createAuthService({ db, getBusinessId });
  const business = createBusinessService({ db, getBusinessId });
  const flavors = createFlavorService({ db, getBusinessId });
  const suppliers = createSupplierService({ db, getBusinessId });
  const locations = createLocationService({ db, getBusinessId });
  const inventory = createInventoryService({ db, getBusinessId });
  const sales = createSaleService({ db, getBusinessId });
  const purchases = createPurchaseService({ db, getBusinessId });
  const reports = createReportService({
    db,
    getBusinessId,
    getInventory: () => inventory.getInventory(),
  });
  const sync = createSyncService({
    db,
    applySale: (payload) => sales.create(payload as never),
    applyPurchase: (payload) => purchases.create(payload as never),
    applyMovement: (payload) => inventory.registerMovement(payload as never),
    applyFlavor: (payload) => flavors.create(payload as never),
    applySupplier: (payload) => suppliers.create(payload as never),
  });

  return { auth, business, flavors, suppliers, locations, inventory, sales, purchases, reports, sync };
}

export type Services = ReturnType<typeof createServices>;
