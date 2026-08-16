import { useEffect, useState } from "react";
import { syncEngine, type SyncState } from "@/lib/offline/syncEngine";

/** Estado de sincronización en React (En línea / Sin conexión / Sincronizando…). */
export function useSyncStatus(): SyncState {
  const [state, setState] = useState<SyncState>(syncEngine.getState());

  useEffect(() => syncEngine.subscribe(setState), []);

  return state;
}
