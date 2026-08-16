import type { Db } from "../db/types";
import type { Location } from "../domain/types";
import { createLocationRepository } from "../repositories/location.repository";

export function createLocationService(deps: { db: Db; getBusinessId: () => Promise<string> }) {
  const { db, getBusinessId } = deps;
  const locationRepo = createLocationRepository(db);

  async function list(includeInactive = false): Promise<Location[]> {
    return locationRepo.list(await getBusinessId(), includeInactive);
  }

  async function create(input: { name: string }): Promise<Location> {
    return locationRepo.create(await getBusinessId(), { name: input.name.trim() });
  }

  async function update(
    id: string,
    input: { name?: string; active?: boolean },
  ): Promise<Location> {
    const updated = await locationRepo.update(await getBusinessId(), id, input);
    if (!updated) {
      throw new Error(`Ubicación no encontrada: ${id}`);
    }
    return updated;
  }

  return { list, create, update };
}
