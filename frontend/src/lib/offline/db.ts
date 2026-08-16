import Dexie, { type Table } from "dexie";
import type {
  Business,
  Flavor,
  FlavorInventory,
  InventoryMovement,
  Location,
  Purchase,
  Sale,
  Supplier,
} from "@/types";

// ---------------------------------------------------------------------
// IndexedDB (Dexie): almacén local de datos de negocio para el modo
// offline. localStorage SOLO se usa para preferencias simples.
// ---------------------------------------------------------------------

export type OutboxStatus = "pending" | "synced" | "failed";

/** Sesión persistida (token de larga duración). Una sola fila clave "current". */
export interface SessionRecord {
  key: string;
  token: string;
  expiresAt: string;
}

export interface OutboxOp {
  /** ID de operación = UUID de la entidad (deduplicación en el servidor). */
  opId: string;
  type: "sale" | "purchase" | "movement" | "flavor" | "supplier";
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  lastError?: string;
  createdAt: string;
}

/**
 * Inventario cacheado: la API devuelve { flavor, ... } sin id a nivel raíz,
 * pero la tabla IndexedDB usa `flavorId` como clave. Añadimos la clave
 * derivada al persistir para que bulkPut/put funcionen (ver services/api).
 */
export type CachedInventory = FlavorInventory & { flavorId: string };

export class NaluDatabase extends Dexie {
  flavors!: Table<Flavor, string>;
  suppliers!: Table<Supplier, string>;
  locations!: Table<Location, string>;
  business!: Table<Business, string>;
  inventory!: Table<CachedInventory, string>;
  sales!: Table<Sale, string>;
  purchases!: Table<Purchase, string>;
  movements!: Table<InventoryMovement, string>;
  outbox!: Table<OutboxOp, string>;
  session!: Table<SessionRecord, string>;

  constructor() {
    super("nalu");
    this.version(1).stores({
      flavors: "id, name, active",
      suppliers: "id, name",
      locations: "id, name",
      business: "id",
      inventory: "flavorId",
      sales: "id, saleDate",
      purchases: "id, purchaseDate",
      movements: "id, flavorId, date",
      outbox: "opId, status, createdAt",
      session: "key",
    });
  }
}

export const localDb = new NaluDatabase();
