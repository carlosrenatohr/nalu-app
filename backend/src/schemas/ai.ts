import { z } from "zod";

// ---------------------------------------------------------------------
// Esquemas de la feature IA: query de entrada y validación de la
// respuesta System One (Jev). No se confía en el contenido del modelo.
// ---------------------------------------------------------------------

export const aiRecommendationQuerySchema = z.object({
  days: z.coerce
    .number("Los días deben ser un número.")
    .int("Los días deben ser un número entero.")
    .min(1, "Los días deben estar entre 1 y 365.")
    .max(365, "Los días deben estar entre 1 y 365.")
    .optional(),
});

/** Respuesta tipada de una pregunta Choice (System One). */
export const choiceAnswerSchema = z.object({
  type: z.literal("choice"),
  choice: z.string(),
  confidence: z.number().min(0).max(1),
  probabilities: z.record(z.string(), z.number()),
});

/** Forma de la respuesta completa de System One. */
export const systemOneResponseSchema = z.object({
  model: z.string().optional(),
  answers: z.object({
    flavor: choiceAnswerSchema,
    priority: choiceAnswerSchema,
  }),
  usage: z
    .object({
      input_tokens: z.number().optional(),
      output_tokens: z.number().optional(),
    })
    .optional(),
});

export type SystemOneResponse = z.infer<typeof systemOneResponseSchema>;
export type AiRecommendationQuery = z.infer<typeof aiRecommendationQuerySchema>;
