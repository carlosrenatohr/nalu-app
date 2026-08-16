import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------
// Schema de Drizzle ORM para Nalu.
// Refleja exactamente el esquema de las migraciones SQL existentes.
// ---------------------------------------------------------------------

export const businesses = sqliteTable("businesses", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  currency: text("currency").notNull().default("NIO"),
  defaultPurchaseCost: real("default_purchase_cost").notNull().default(28),
  defaultHomePrice: real("default_home_price").notNull().default(60),
  primaryColor: text("primary_color").notNull().default("#36C9C6"),
  secondaryColor: text("secondary_color").notNull().default("#FF6F91"),
  contact: text("contact"),
  reportFooter: text("report_footer"),
  alertEmail: text("alert_email"),
  pinHash: text("pin_hash"),
  pinSalt: text("pin_salt"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const flavors = sqliteTable("flavors", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .references(() => businesses.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  emoji: text("emoji"),
  color: text("color"),
  minStock: integer("min_stock").notNull().default(10),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const suppliers = sqliteTable("suppliers", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .references(() => businesses.id),
  name: text("name").notNull(),
  contact: text("contact"),
  notes: text("notes"),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const locations = sqliteTable("locations", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .references(() => businesses.id),
  name: text("name").notNull(),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const purchases = sqliteTable("purchases", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .references(() => businesses.id),
  supplierId: text("supplier_id")
    .notNull()
    .references(() => suppliers.id),
  purchaseDate: text("purchase_date").notNull(),
  notes: text("notes"),
  totalCost: real("total_cost").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const purchaseItems = sqliteTable("purchase_items", {
  id: text("id").primaryKey(),
  purchaseId: text("purchase_id")
    .notNull()
    .references(() => purchases.id),
  flavorId: text("flavor_id")
    .notNull()
    .references(() => flavors.id),
  quantity: integer("quantity").notNull(),
  unitCost: real("unit_cost").notNull(),
  subtotal: real("subtotal").notNull(),
});

export const sales = sqliteTable("sales", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .references(() => businesses.id),
  saleDate: text("sale_date").notNull(),
  location: text("location"),
  notes: text("notes"),
  total: real("total").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const saleItems = sqliteTable("sale_items", {
  id: text("id").primaryKey(),
  saleId: text("sale_id")
    .notNull()
    .references(() => sales.id),
  flavorId: text("flavor_id")
    .notNull()
    .references(() => flavors.id),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  unitCostSnapshot: real("unit_cost_snapshot").notNull(),
  subtotal: real("subtotal").notNull(),
});

export const inventoryMovements = sqliteTable("inventory_movements", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .references(() => businesses.id),
  flavorId: text("flavor_id")
    .notNull()
    .references(() => flavors.id),
  movementType: text("movement_type").notNull(),
  quantity: integer("quantity").notNull(),
  unitCost: real("unit_cost"),
  referenceId: text("reference_id"),
  date: text("date").notNull(),
  notes: text("notes"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const syncOperations = sqliteTable("sync_operations", {
  opId: text("op_id").primaryKey(),
  operationType: text("operation_type").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  status: text("status").notNull().default("applied"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const sessions = sqliteTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .references(() => businesses.id),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  expiresAt: text("expires_at").notNull(),
});
