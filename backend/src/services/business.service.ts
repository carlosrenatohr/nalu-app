import type { DrizzleDb } from "../db/drizzle-types";
import type { Business } from "../domain/types";
import {
  createBusinessRepository,
  type BusinessUpdate,
} from "../repositories/business.repository";
import { ApiError } from "../utils/http-error";

export function createBusinessService(deps: { db: DrizzleDb; getBusinessId: () => Promise<string> }) {
  const { db, getBusinessId } = deps;
  const businessRepo = createBusinessRepository(db);

  async function get(): Promise<Business> {
    const business = await businessRepo.getDefault();
    if (!business) {
      throw new ApiError(
        500,
        "BUSINESS_NOT_CONFIGURED",
        "El negocio no está configurado. Ejecuta las migraciones y el seed.",
      );
    }
    return business;
  }

  async function update(input: BusinessUpdate): Promise<Business> {
    const business = await businessRepo.update(await getBusinessId(), input);
    if (!business) {
      throw new ApiError(
        500,
        "BUSINESS_NOT_CONFIGURED",
        "El negocio no está configurado.",
      );
    }
    return business;
  }

  return { get, update };
}
