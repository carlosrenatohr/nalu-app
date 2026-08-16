import { localDb } from "./db";
import { countPending, listPending, markFailed, markSynced } from "./outbox";
import { isOnline, subscribeNetwork } from "./network";
import { syncOperationsApi, refreshInventoryCache } from "@/services/api";
import type { SyncOperationResult } from "@/types";

// ---------------------------------------------------------------------
// Motor de sincronización offline-first.
// Flujo: acción → guardado local → outbox → (vuelve la conexión) →
// sync → Express/D1 → marcado como sincronizado.
// ---------------------------------------------------------------------

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
    if (pending.length === 0) {
      this.state = { ...this.state, syncing: false };
      this.emit();
      return;
    }

    this.state = { ...this.state, syncing: true, lastError: null };
    this.emit();

    try {
      const { results } = await syncOperationsApi(
        pending.map((op) => ({ type: op.type, payload: op.payload })),
      );
      await this.applyResults(results, pending);
    } catch (err) {
      this.state = {
        ...this.state,
        syncing: false,
        lastError: err instanceof Error ? err.message : "Error de sincronización",
      };
      this.emit();
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
    this.emit();
  }

  private async applyResults(
    results: SyncOperationResult[],
    pending: Awaited<ReturnType<typeof listPending>>,
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
