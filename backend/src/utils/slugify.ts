/**
 * Genera un slug a partir de un nombre en español:
 * "Fresa Kiwi" → "fresa-kiwi", "Guanábana" → "guanabana".
 */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita tildes
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
