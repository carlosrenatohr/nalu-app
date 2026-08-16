// ---------------------------------------------------------------------
// Tipos del frontend: espejo del contrato de la API REST.
// El backend es la fuente de verdad; estos tipos documentan la forma
// de los datos que viajan por HTTP.
// ---------------------------------------------------------------------

export type MovementType =
  | "PURCHASE"
  | "SALE"
  | "GIFT"
  | "PERSONAL_USE"
  | "LOSS"
  | "ADJUSTMENT"
  | "RETURN";

export interface Business {
  id: string;
  name: string;
  currency: string;
  defaultPurchaseCost: number;
  defaultHomePrice: number;
  primaryColor: string;
  secondaryColor: string;
  contact: string | null;
  reportFooter: string | null;
  /** Email para alertas (stock bajo, resumen diario). */
  alertEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Respuesta de /api/auth/login. */
export interface AuthSession {
  token: string;
  expiresAt: string;
  business: Business;
}

export interface Flavor {
  id: string;
  businessId: string;
  name: string;
  slug: string;
  emoji: string | null;
  color: string | null;
  minStock: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  businessId: string;
  name: string;
  contact: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Location {
  id: string;
  businessId: string;
  name: string;
  active: boolean;
}

export interface SaleItem {
  id: string;
  saleId: string;
  flavorId: string;
  flavorName?: string;
  quantity: number;
  unitPrice: number;
  unitCostSnapshot: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  businessId: string;
  saleDate: string;
  location: string | null;
  notes: string | null;
  total: number;
  profit?: number;
  items: SaleItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  flavorId: string;
  flavorName?: string;
  quantity: number;
  unitCost: number;
  subtotal: number;
}

export interface Purchase {
  id: string;
  businessId: string;
  supplierId: string;
  supplierName?: string;
  purchaseDate: string;
  notes: string | null;
  totalCost: number;
  items: PurchaseItem[];
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMovement {
  id: string;
  businessId: string;
  flavorId: string;
  flavorName?: string;
  movementType: MovementType;
  quantity: number;
  unitCost: number | null;
  referenceId: string | null;
  date: string;
  notes: string | null;
  createdAt: string;
}

export interface FlavorInventory {
  flavor: Flavor;
  available: number;
  lastCost: number | null;
  purchased: number;
  sold: number;
  gifted: number;
  personalUse: number;
  lost: number;
  adjusted: number;
  returned: number;
  value: number;
  lowStock: boolean;
}

export interface FlavorInventoryDetail {
  summary: FlavorInventory;
  movements: InventoryMovement[];
}

export interface SalesReport {
  range: { from: string; to: string };
  totalSales: number;
  unitsSold: number;
  totalCost: number;
  profit: number;
  margin: number;
  byFlavor: { flavorId: string; flavorName: string; units: number; revenue: number; cost: number }[];
  byLocation: { location: string | null; units: number; revenue: number }[];
  byPrice: { unitPrice: number; units: number; revenue: number; cost: number }[];
}

export interface PurchasesReport {
  range: { from: string; to: string };
  purchases: Purchase[];
  totalPurchases: number;
  totalUnits: number;
  totalCost: number;
  bySupplier: {
    supplierId: string;
    supplierName: string;
    purchases: number;
    units: number;
    totalCost: number;
  }[];
}

export interface NewSaleInput {
  saleDate: string;
  location: string;
  notes?: string;
  items: { flavorId: string; quantity: number; unitPrice: number }[];
}

export interface NewPurchaseInput {
  purchaseDate: string;
  supplierId: string;
  notes?: string;
  items: { flavorId: string; quantity: number; unitCost: number }[];
}

export interface NewMovementInput {
  flavorId: string;
  movementType: MovementType;
  quantity: number;
  date: string;
  notes?: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: { field: string; message: string }[];
}

export interface SyncOperationResult {
  opId: string;
  status: "applied" | "duplicate" | "failed";
  entityId?: string;
  message?: string;
}
