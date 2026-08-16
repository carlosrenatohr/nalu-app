import { localDb } from "./db";

// ---------------------------------------------------------------------
// Sesión de acceso. El token vive en memoria (lectura síncrona por el
// cliente API) y se PERSISTE en IndexedDB (Dexie) para sobrevivir a
// recargas y al modo offline. NO se usa localStorage: el token es un
// dato transaccional de sesión, no una preferencia simple.
//
// Cuando el servidor responde 401 (sesión expirada), se notifica a los
// suscriptores para cerrar la sesión en la UI de inmediato.
// ---------------------------------------------------------------------

type UnauthorizedListener = () => void;

const SESSION_KEY = "current";

let token: string | null = null;
const listeners = new Set<UnauthorizedListener>();

/** Token actual (síncrono, para el header Authorization). */
export function getToken(): string | null {
  return token;
}

/** Carga la sesión persistida al arrancar la app. */
export async function loadSession(): Promise<string | null> {
  const record = await localDb.session.get(SESSION_KEY);
  token = record?.token ?? null;
  return token;
}

/** Guarda el token tras iniciar sesión. */
export async function persistSession(newToken: string, expiresAt: string): Promise<void> {
  token = newToken;
  await localDb.session.put({ key: SESSION_KEY, token: newToken, expiresAt });
}

/** Cierra la sesión local (logout o 401). */
export async function clearSession(): Promise<void> {
  token = null;
  await localDb.session.delete(SESSION_KEY);
}

/** Suscripción a "la sesión dejó de ser válida". Devuelve unsubscribe. */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Notifica un 401 recibido del servidor. */
export function notifyUnauthorized(): void {
  token = null;
  listeners.forEach((l) => l());
}
