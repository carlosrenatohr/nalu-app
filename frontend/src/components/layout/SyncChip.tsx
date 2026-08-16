import { useSyncStatus } from "@/hooks/useSyncStatus";
import { syncEngine } from "@/lib/offline/syncEngine";
import { IconSync, IconWifi, IconWifiOff } from "../ui/icons";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------
// Indicador de sincronización SIEMPRE visible: nunca se ocultan los
// problemas de conexión. Estados: En línea · Sin conexión · Cambios
// pendientes · Sincronizando… · Sincronizado.
// ---------------------------------------------------------------------
export function SyncChip() {
  const state = useSyncStatus();

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
      <button
        type="button"
        onClick={() => void syncEngine.sync()}
        className={cn(
          "flex min-h-9 items-center gap-1.5 rounded-full bg-strawberry/15 px-3 text-xs font-bold text-strawberry",
        )}
      >
        <IconWifiOff className="h-4 w-4" />
        Sin conexión{state.pending > 0 ? ` · ${state.pending} pendientes` : ""}
      </button>
    );
  }

  if (state.pending > 0) {
    return (
      <button
        type="button"
        onClick={() => void syncEngine.sync()}
        className="flex min-h-9 items-center gap-1.5 rounded-full bg-mango-soft px-3 text-xs font-bold text-[#8a6d00]"
      >
        <IconSync className="h-4 w-4" />
        {state.pending} cambios pendientes
      </button>
    );
  }

  return (
    <span className="flex min-h-9 items-center gap-1.5 rounded-full bg-mint px-3 text-xs font-bold text-[#3e7d1f]">
      <IconWifi className="h-4 w-4" />
      En línea
    </span>
  );
}
