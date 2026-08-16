import type { Db } from "../db/types";
import type { Supplier } from "../domain/types";
import { createSupplierRepository } from "../repositories/supplier.repository";
import { ApiError } from "../utils/http-error";
import { newId } from "../utils/ids";

export interface CreateSupplierInput {
  id?: string;
  name: string;
  contact?: string;
  notes?: string;
}

export function createSupplierService(deps: { db: Db; getBusinessId: () => Promise<string> }) {
  const { db, getBusinessId } = deps;
  const supplierRepo = createSupplierRepository(db);

  async function create(input: CreateSupplierInput): Promise<Supplier> {
    return supplierRepo.create({
      id: input.id ?? newId(),
      businessId: await getBusinessId(),
      name: input.name.trim(),
      contact: input.contact?.trim() || null,
      notes: input.notes?.trim() || null,
    });
  }

  async function list(includeInactive = false): Promise<Supplier[]> {
    return supplierRepo.list(await getBusinessId(), includeInactive);
  }

  async function update(
    id: string,
    input: {
      name?: string;
      contact?: string | null;
      notes?: string | null;
      active?: boolean;
    },
  ): Promise<Supplier> {
    const businessId = await getBusinessId();
    const existing = await supplierRepo.getById(businessId, id);
    if (!existing) {
      throw ApiError.notFound("El proveedor no existe.");
    }
    const updated = await supplierRepo.update(businessId, id, input);
    if (!updated) {
      throw ApiError.notFound("El proveedor no existe.");
    }
    return updated;
  }

  return { create, list, update };
}
