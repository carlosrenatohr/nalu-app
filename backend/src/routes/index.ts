import { Router } from "express";
import type { DrizzleDb } from "../db/drizzle-types";
import { createServices } from "../services";
import { createHealthController } from "../controllers/health.controller";
import { createFlavorControllers } from "../controllers/flavor.controller";
import { createSupplierControllers } from "../controllers/supplier.controller";
import { createSaleControllers } from "../controllers/sale.controller";
import { createPurchaseControllers } from "../controllers/purchase.controller";
import { createInventoryControllers } from "../controllers/inventory.controller";
import { createReportControllers } from "../controllers/report.controller";
import { createBusinessControllers } from "../controllers/business.controller";
import { createSyncControllers } from "../controllers/sync.controller";
import { createAuthControllers } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth";
import { validate, validateQuery } from "../middleware/validate";
import { createSaleSchema, saleListQuerySchema, updateSaleSchema } from "../schemas/sale";
import { createPurchaseSchema, purchaseListQuerySchema } from "../schemas/purchase";
import { createMovementSchema } from "../schemas/inventory";
import { createFlavorSchema, updateFlavorSchema } from "../schemas/flavor";
import { createSupplierSchema, updateSupplierSchema } from "../schemas/supplier";
import { updateBusinessSchema, createLocationSchema, updateLocationSchema } from "../schemas/business";
import { dateRangeQuerySchema } from "../schemas/reports";
import { syncRequestSchema } from "../schemas/sync";
import { loginSchema, changePinSchema } from "../schemas/auth";

export function createApiRouter(deps: {
  db: DrizzleDb;
  getBusinessId: () => Promise<string>;
}): Router {
  const services = createServices(deps);
  const router = Router();

  // Salud y autenticación: rutas PÚBLICAS (antes del middleware requireAuth)
  const health = createHealthController(services);
  router.get("/health", health.check);

  const auth = createAuthControllers(services);
  router.post("/auth/login", validate(loginSchema), auth.login);
  router.post("/auth/logout", auth.logout);
  router.get("/auth/me", auth.me);
  router.post("/auth/change-pin", validate(changePinSchema), auth.changePin);

  // Todo lo demás exige sesión válida (Bearer token de larga duración)
  router.use(requireAuth(services.auth));

  // Sabores
  const flavors = createFlavorControllers(services);
  router.get("/flavors", flavors.list);
  router.post("/flavors", validate(createFlavorSchema), flavors.create);
  router.patch("/flavors/:id", validate(updateFlavorSchema), flavors.update);

  // Proveedores
  const suppliers = createSupplierControllers(services);
  router.get("/suppliers", suppliers.list);
  router.post("/suppliers", validate(createSupplierSchema), suppliers.create);
  router.patch("/suppliers/:id", validate(updateSupplierSchema), suppliers.update);

  // Ventas
  const sales = createSaleControllers(services);
  router.get("/sales", validateQuery(saleListQuerySchema), sales.list);
  router.post("/sales", validate(createSaleSchema), sales.create);
  router.get("/sales/:id", sales.getById);
  router.patch("/sales/:id", validate(updateSaleSchema), sales.update);
  router.delete("/sales/:id", sales.delete);

  // Compras
  const purchases = createPurchaseControllers(services);
  router.get("/purchases", validateQuery(purchaseListQuerySchema), purchases.list);
  router.post("/purchases", validate(createPurchaseSchema), purchases.create);
  router.get("/purchases/:id", purchases.getById);

  // Inventario
  const inventory = createInventoryControllers(services);
  router.get("/inventory", inventory.list);
  router.get("/inventory/:flavorId", inventory.getByFlavor);
  router.post("/inventory/movements", validate(createMovementSchema), inventory.registerMovement);

  // Reportes
  const reports = createReportControllers(services);
  router.get("/reports/sales", validateQuery(dateRangeQuerySchema), reports.sales);
  router.get("/reports/purchases", validateQuery(dateRangeQuerySchema), reports.purchases);
  router.get("/reports/inventory", reports.inventory);

  // Ajustes del negocio y ubicaciones
  const business = createBusinessControllers(services);
  router.get("/business", business.getSettings);
  router.patch("/business", validate(updateBusinessSchema), business.updateSettings);
  router.get("/locations", business.listLocations);
  router.post("/locations", validate(createLocationSchema), business.createLocation);
  router.patch("/locations/:id", validate(updateLocationSchema), business.updateLocation);

  // Sincronización offline (outbox)
  const sync = createSyncControllers(services);
  router.post("/sync/operations", validate(syncRequestSchema), sync.apply);

  return router;
}
