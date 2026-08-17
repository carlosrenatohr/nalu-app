// ---------------------------------------------------------------------
// Tipos de dominio de Nalu.
// Las filas de la base se proyectan a camelCase mediante alias SQL en
// los repositorios, de modo que el dominio nunca ve snake_case.
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
  /** Email para alertas (stock bajo, resumen diario). Nunca el PIN. */
  alertEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Flavor {
  id: string;
  businessId: string;
  name: string;
  slug: string;
  emoji: string | null;
  color: string | null;
  costPrice: number | null;
  salePrice: number | null;
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

export interface SaleItem {
  id: string;
  saleId: string;
  flavorId: string;
  flavorName?: string;
  quantity: number;
  unitPrice: number;
  /** Costo histórico: se congela al momento de la venta. */
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
  items: SaleItem[];
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMovement {
  id: string;
  businessId: string;
  flavorId: string;
  flavorName?: string;
  movementType: MovementType;
  /** Cantidad CON SIGNO: positivo = entrada, negativo = salida. */
  quantity: number;
  unitCost: number | null;
  referenceId: string | null;
  date: string;
  notes: string | null;
  createdAt: string;
}

/** Resumen de inventario de un sabor, calculado desde movimientos. */
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
  /** Valor estimado = disponible × costo promedio. */
  value: number;
  lowStock: boolean;
}
