import { z } from "zod";
import { isoDateSchema } from "./common";

export const dateRangeQuerySchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});
