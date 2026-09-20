import type { DrizzleDb } from "../db/drizzle-types";
import type { Flavor } from "../domain/types";
import { createFlavorRepository, type NewFlavor } from "../repositories/flavor.repository";
import { ApiError } from "../utils/http-error";
import { newId } from "../utils/ids";
import { slugify } from "../utils/slugify";

export interface CreateFlavorInput {
  id?: string;
  name: string;
  emoji?: string;
  color?: string;
  costPrice?: number;
  salePrice?: number;
  minStock?: number;
}

export function createFlavorService(deps: { db: DrizzleDb; getBusinessId: () => Promise<string> }) {
  const { db, getBusinessId } = deps;
  const flavorRepo = createFlavorRepository(db);

  function toNewFlavor(businessId: string, input: CreateFlavorInput): NewFlavor {
    return {
      id: input.id ?? newId(),
      businessId,
      name: input.name.trim(),
      slug: slugify(input.name),
      emoji: input.emoji?.trim() || null,
      color: input.color ?? null,
      costPrice: input.costPrice ?? null,
      salePrice: input.salePrice ?? null,
      minStock: input.minStock ?? 10,
    };
  }

  async function create(input: CreateFlavorInput): Promise<Flavor> {
    return flavorRepo.create(toNewFlavor(await getBusinessId(), input));
  }

  async function list(includeInactive = false): Promise<Flavor[]> {
    return flavorRepo.list(await getBusinessId(), includeInactive);
  }

  async function update(
    id: string,
    input: Partial<CreateFlavorInput> & { active?: boolean },
  ): Promise<Flavor> {
    const businessId = await getBusinessId();
    const existing = await flavorRepo.getById(businessId, id);
    if (!existing) {
      throw ApiError.notFound("El sabor no existe.");
    }
    const name = input.name !== undefined ? input.name.trim() : existing.name;
    const updated = await flavorRepo.update(businessId, id, {
      ...input,
      name,
      // Si cambia el nombre, el slug se regenera para mantener unicidad
      slug: name !== existing.name ? slugify(name) : existing.slug,
    });
    if (!updated) {
      throw ApiError.notFound("El sabor no existe.");
    }
    return updated;
  }

  /**
   * Elimina un sabor de forma segura para el historial:
   * - Si no tiene referencias (movimientos/ventas/compras), lo borra físicamente.
   * - Si tiene referencias históricas, lo archiva (active = false) para no
   *   romper datos; el historial sigue mostrando el sabor.
   * Devuelve el sabor (eliminado o archivado) y si quedó archivado.
   */
  async function deleteFlavor(
    id: string,
  ): Promise<{ flavor: Flavor; archived: boolean }> {
    const businessId = await getBusinessId();
    const existing = await flavorRepo.getById(businessId, id);
    if (!existing) {
      throw ApiError.notFound("El sabor no existe.");
    }

    const referenced = await flavorRepo.hasReferences(businessId, id);
    if (!referenced) {
      await flavorRepo.delete(businessId, id);
      return { flavor: existing, archived: false };
    }

    // Archivado: oculto de ventas/compras nuevas, pero el historial lo conserva.
    const archived = await flavorRepo.update(businessId, id, { active: false });
    if (!archived) {
      throw ApiError.notFound("El sabor no existe.");
    }
    return { flavor: archived, archived: true };
  }

  return { create, list, update, delete: deleteFlavor };
}
