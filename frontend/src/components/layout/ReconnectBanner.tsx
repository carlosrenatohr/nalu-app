import { useEffect, useRef, useState } from "react";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { IconWifi } from "../ui/icons";

// ---------------------------------------------------------------------
// Banner de reconexión: avisa brevemente al recuperar la conexión para
// que el operador sepa que lo pendiente se está sincronizando (antes el
// chip volvía a "En línea" sin explicar qué pasaba con la cola).
// ---------------------------------------------------------------------

export function ReconnectBanner() {
  const state = useSyncStatus();
  const wasOffline = useRef(!state.online);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (wasOffline.current && state.online) {
      // Transición offline → online: muestra el aviso unos segundos.
      setVisible(true);
      wasOffline.current = false;
      const timer = setTimeout(() => setVisible(false), 4000);
      return () => clearTimeout(timer);
    }
    wasOffline.current = !state.online;
  }, [state.online]);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="mx-4 mt-3 flex items-center gap-2 rounded-2xl bg-turquoise/15 px-4 py-2.5 text-sm font-bold text-turquoise-deep"
    >
      <IconWifi className="h-4 w-4 shrink-0" />
      Conexión restablecida · sincronizando cambios pendientes…
    </div>
  );
}
