// ---------------------------------------------------------------------
// Estado de conexión. El motor de sincronización reacciona a los
// eventos online/offline del navegador.
// ---------------------------------------------------------------------

type NetworkListener = (online: boolean) => void;

const listeners = new Set<NetworkListener>();
let online = typeof navigator !== "undefined" ? navigator.onLine : true;

export function isOnline(): boolean {
  return online;
}

export function subscribeNetwork(listener: NetworkListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setOnline(value: boolean): void {
  if (online === value) return;
  online = value;
  listeners.forEach((l) => l(value));
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => setOnline(true));
  window.addEventListener("offline", () => setOnline(false));
}

/** Un error de red (fetch fallido) suele ser TypeError "Failed to fetch". */
export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError || (err instanceof Error && err.name === "TypeError");
}
