// ---------------------------------------------------------------------
// Estado de conexión con sonda de conectividad real.
// navigator.onLine solo indica que hay interfaz de red, no que haya
// internet. Hacemos HEAD periódico al health endpoint para confirmar.
// ---------------------------------------------------------------------

type NetworkListener = (online: boolean) => void;

const listeners = new Set<NetworkListener>();
let online = typeof navigator !== "undefined" ? navigator.onLine : true;
let probeTimer: ReturnType<typeof setInterval> | null = null;
let probeAbort: AbortController | null = null;

const PROBE_INTERVAL = 30_000;
const PROBE_TIMEOUT = 5_000;

export function isOnline(): boolean {
  return online;
}

export function subscribeNetwork(listener: NetworkListener): () => void {
  listeners.add(listener);
  if (listeners.size === 1) startProbe();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopProbe();
  };
}

function setOnline(value: boolean): void {
  if (online === value) return;
  online = value;
  listeners.forEach((l) => l(value));
}

/** HEAD rápido al health endpoint para confirmar conectividad real. */
export async function checkConnectivity(): Promise<boolean> {
  try {
    probeAbort?.abort();
    probeAbort = new AbortController();
    const res = await fetch("/api/health", {
      method: "HEAD",
      cache: "no-store",
      signal: probeAbort.signal,
    });
    const ok = res.ok;
    setOnline(ok);
    return ok;
  } catch {
    setOnline(false);
    return false;
  }
}

function startProbe(): void {
  if (probeTimer) return;
  probeTimer = setInterval(checkConnectivity, PROBE_INTERVAL);
}

function stopProbe(): void {
  if (probeTimer) {
    clearInterval(probeTimer);
    probeTimer = null;
  }
  probeAbort?.abort();
  probeAbort = null;
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    checkConnectivity();
  });
  window.addEventListener("offline", () => setOnline(false));
}

/** Un error de red (fetch fallido) suele ser TypeError "Failed to fetch". */
export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError || (err instanceof Error && err.name === "TypeError");
}
