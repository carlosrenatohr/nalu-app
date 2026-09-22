// ---------------------------------------------------------------------
// Búsqueda flexible de texto (una sola implementación para toda la app).
// Ignora acentos y mayúsculas/minúsculas: "mango con chile" encuentra
// "Mangó con Chile" y "MANGÓ". Evita duplicar la lógica en cada pantalla.
// ---------------------------------------------------------------------

/** Normaliza texto para comparar: sin acentos, minúsculas y sin espacios sobrantes. */
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * ¿El texto contiene la búsqueda? Búsqueda vacía = todo coincide.
 * `text` null/undefined se trata como vacío (nunca lanza).
 */
export function matchesSearch(query: string, text: string | null | undefined): boolean {
  const q = normalizeSearch(query);
  if (q === "") return true;
  return normalizeSearch(text ?? "").includes(q);
}
