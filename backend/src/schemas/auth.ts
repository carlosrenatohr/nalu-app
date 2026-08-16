import { z } from "zod";

// ---------------------------------------------------------------------
// Validación de autenticación. El PIN es de 4 a 6 dígitos numéricos.
// ---------------------------------------------------------------------

export const loginSchema = z.object({
  pin: z
    .string({ message: "El PIN es obligatorio." })
    .regex(/^\d{4,6}$/, "El PIN debe tener entre 4 y 6 dígitos."),
});

export const changePinSchema = z.object({
  currentPin: z.string({ message: "El PIN actual es obligatorio." }),
  newPin: z
    .string({ message: "El nuevo PIN es obligatorio." })
    .regex(/^\d{4,6}$/, "El nuevo PIN debe tener entre 4 y 6 dígitos."),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePinInput = z.infer<typeof changePinSchema>;
