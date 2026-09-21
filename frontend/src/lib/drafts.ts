// ---------------------------------------------------------------------
// Borradores (drafts) de formularios de negocio.
// Guardan en localStorage (preferencias/recuperación, no datos
// transaccionales) el estado en curso de una venta/compra para no
// perderlo si el operador abandona el flujo a mitad de camino.
// ---------------------------------------------------------------------

const DRAFT_PREFIX = "nalu:draft:";

export function saveDraft<T>(key: string, data: T): void {
  try {
    localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify({ data, updatedAt: Date.now() }));
  } catch {
    // Almacenamiento lleno o bloqueado: el borrador es best-effort.
  }
}

export function loadDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data?: T } | null;
    return parsed?.data ?? null;
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(DRAFT_PREFIX + key);
  } catch {
    // noop
  }
}

export function draftKey(businessId: string | undefined, type: "sale" | "purchase"): string {
  return `${businessId ?? "default"}:${type}`;
}