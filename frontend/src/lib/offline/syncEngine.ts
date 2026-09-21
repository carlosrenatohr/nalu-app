import { localDb, type OutboxOp } from "./db";
import { countPending, listPending, markFailed, markSynced } from "./outbox";
import { isOnline, subscribeNetwork } from "./network";
import { syncOperationsApi, refreshInventoryCache } from "@/services/api";
import type { SyncOperationResult } from "@/types";

// ---------------------------------------------------------------------
// Motor de sincronización offline-first.
// Flujo: acción → guardado local → outbox → (vuelve la conexión) →
// sync → Express/D1 → marcado como sincronizado.
//
// Robustez: reintentos con backoff exponencial (las operaciones fallidas
// no se reenvían en bucle, esperan una ventana y se reintentan solas) y
// reintento programado tras un error de red.
// ---------------------------------------------------------------------

const BACKOFF_BASE_MS = 2_000;
const BACKOFF_MAX_MS = 60_000;

function backoffDelay(attempts: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** attempts, BACKOFF_MAX_MS);
}

function msUntilRetry(op: OutboxOp): number {
  if (op.status !== "failed" || !op.lastAttemptAt) return 0;
  return Math.max(0, backoffDelay(op.attempts) - (Date.now() - op.lastAttemptAt));
}

function isEligible(op: OutboxOp): boolean {
  return msUntilRetry(op) <= 0;
}

export interface SyncState {
  online: boolean;
  pending: number;
  syncing: boolean;
  lastSync: string | null;
  lastError: string | null;
}

type SyncListener = (state: SyncState) => void;

class SyncEngine {
  private listeners = new Set<SyncListener>();
  private state: SyncState = {
    online: isOnline(),
    pending: 0,
    syncing: false,
    lastSync: null,
    lastError: null,
  };
  private syncTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    subscribeNetwork((online) => {
      this.state = { ...this.state, online, lastError: null };
      this.emit();
      if (online) this.requestSync(0);
    });
    this.refreshPending();
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): SyncState {
    return this.state;
  }

  /** Recalcula el contador de pendientes y notifica (p. ej. tras descartar una op). */
  async refresh(): Promise<void> {
    await this.refreshPending();
    this.emit();
  }

  /** Pide una sincronización (debounced para no saturar el servidor). */
  requestSync(delayMs = 1500): void {
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      void this.sync();
    }, delayMs);
  }

  async sync(): Promise<void> {
    if (this.state.syncing || !this.state.online) return;
    const pending = await listPending();
    // Solo reenviamos las operaciones cuyo backoff ya expiró.
    const eligible = pending.filter(isEligible);

    if (eligible.length === 0) {
      this.state = { ...this.state, syncing: false, lastError: null };
      this.emit();
      // Hay pendientes pero todas en backoff → reintentamos pronto.
      if (pending.length > 0) {
        this.requestSync(Math.max(Math.min(...pending.map(msUntilRetry)), 1000));
      }
      return;
    }

    this.state = { ...this.state, syncing: true, lastError: null };
    this.emit();

    try {
      const { results } = await syncOperationsApi(
        eligible.map((op) => ({ type: op.type, payload: op.payload })),
      );
      await this.applyResults(results, eligible);
    } catch (err) {
      // Error de red a mitad de sincronización: no perdemos nada (los ops
      // siguen en el outbox) y reintentamos con backoff.
      this.state = {
        ...this.state,
        syncing: false,
        lastError: err instanceof Error ? err.message : "Error de sincronización",
      };
      this.emit();
      this.requestSync(backoffDelay(1));
      return;
    }

    // Tras sincronizar, refrescamos el caché con datos del servidor
    await refreshInventoryCache().catch(() => undefined);

    this.state = {
      ...this.state,
      syncing: false,
      lastSync: new Date().toISOString(),
    };
    await this.refreshPending();

    // Reintento automático si quedaron operaciones por sincronizar.
    const remaining = await listPending();
    if (remaining.length > 0) {
      this.requestSync(Math.max(Math.min(...remaining.map(msUntilRetry)), 1000));
    }
    this.emit();
  }

  private async applyResults(
    results: SyncOperationResult[],
    pending: OutboxOp[],
  ): Promise<void> {
    for (const result of results) {
      const op = pending.find((o) => o.opId === result.opId);
      if (!op) continue;
      if (result.status === "applied" || result.status === "duplicate") {
        await markSynced(op.opId);
      } else if (result.status === "failed") {
        await markFailed(op.opId, result.message ?? "No se pudo sincronizar", op.attempts + 1);
      }
    }
  }

  private async refreshPending(): Promise<void> {
    this.state = { ...this.state, pending: await countPending() };
  }

  private emit(): void {
    this.listeners.forEach((l) => l(this.state));
  }
}

export const syncEngine = new SyncEngine();

/** Elimina operaciones sincronizadas antiguas (mantenimiento del outbox). */
export async function cleanupOutbox(): Promise<void> {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  await localDb.outbox
    .where("status")
    .equals("synced")
    .filter((op) => new Date(op.createdAt).getTime() < cutoff)
    .delete();
}
