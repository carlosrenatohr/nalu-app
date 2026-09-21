import { useState } from "react";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { syncEngine } from "@/lib/offline/syncEngine";
import { IconSync, IconWifi, IconWifiOff } from "../ui/icons";
import { PendingChangesModal } from "./PendingChangesModal";

// ---------------------------------------------------------------------
// Indicador de sincronización SIEMPRE visible. Al hacer clic abre el
// detalle de los cambios pendientes (qué, estado y opción de descartar).
// Estados: En línea · Sin conexión · Cambios pendientes · Sincronizando…
// ---------------------------------------------------------------------
export function SyncChip() {
  const state = useSyncStatus();
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (state.syncing) {
    return (
      <button
        type="button"
        onClick={() => void syncEngine.sync()}
        className="flex min-h-9 items-center gap-1.5 rounded-full bg-turquoise/15 px-3 text-xs font-bold text-turquoise-deep"
      >
        <IconSync className="h-4 w-4 animate-spin" />
        Sincronizando…
      </button>
    );
  }

  if (!state.online) {
    return (
      <>
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          className="flex min-h-9 items-center gap-1.5 rounded-full bg-strawberry/15 px-3 text-xs font-bold text-strawberry"
        >
          <IconWifiOff className="h-4 w-4" />
          Sin conexión{state.pending > 0 ? ` · ${state.pending} pendientes` : ""}
        </button>
        <PendingChangesModal open={detailsOpen} onClose={() => setDetailsOpen(false)} />
      </>
    );
  }

  if (state.pending > 0) {
    return (
      <>
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          className="flex min-h-9 items-center gap-1.5 rounded-full bg-mango-soft px-3 text-xs font-bold text-[#8a6d00]"
        >
          <IconSync className="h-4 w-4" />
          {state.pending} cambios pendientes
        </button>
        <PendingChangesModal open={detailsOpen} onClose={() => setDetailsOpen(false)} />
      </>
    );
  }

  return (
    <>
      <span className="flex min-h-9 items-center gap-1.5 rounded-full bg-mint px-3 text-xs font-bold text-[#3e7d1f]">
        <IconWifi className="h-4 w-4" />
        En línea
      </span>
    </>
  );
}