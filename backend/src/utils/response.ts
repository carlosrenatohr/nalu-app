/** Envoltura de respuesta exitosa consistente: { success: true, data }. */
export function ok<T>(data: T): { success: true; data: T } {
  return { success: true, data };
}
