import { useState } from "react";
import { useBusiness } from "@/hooks/useBusiness";
import { salesApi } from "@/services/api";
import { formatMoney, formatRelativeDay } from "@/lib/formatting/currency";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { IconAlert } from "@/components/ui/icons";
import type { Sale } from "@/types";

// ---------------------------------------------------------------------
// Modal de confirmación colorido para eliminar una venta.
// Muestra una advertencia clara sobre las consecuencias irreversibles
// y requiere confirmación explícita antes de proceder.
// ---------------------------------------------------------------------

interface ConfirmDeleteModalProps {
  open: boolean;
  sale: Sale | null;
  onClose: () => void;
  onDeleted: () => void;
}

export function ConfirmDeleteModal({ open, sale, onClose, onDeleted }: ConfirmDeleteModalProps) {
  const { toast } = useToast();
  const { currency } = useBusiness();
  const [confirmed, setConfirmed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!sale) return;
    setDeleting(true);
    try {
      await salesApi.delete(sale.id);
      toast("Venta eliminada permanentemente");
      setConfirmed(false);
      onDeleted();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo eliminar la venta", "error");
    } finally {
      setDeleting(false);
    }
  }

  function handleClose() {
    setConfirmed(false);
    onClose();
  }

  if (!sale) return null;

  return (
    <Modal open={open} onClose={handleClose} title="Eliminar venta">
      <div className="space-y-4">
        {/* Banner de advertencia */}
        <div className="flex items-start gap-3 rounded-2xl bg-strawberry/10 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-strawberry/20 text-strawberry">
            <IconAlert className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-extrabold text-strawberry">Acción irreversble</p>
            <p className="mt-0.5 text-sm text-cocoa">
              Esta venta será eliminada permanentemente. Los números actuales se verán afectados.
            </p>
          </div>
        </div>

        {/* Resumen de la venta */}
        <div className="rounded-2xl bg-cream p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-extrabold text-cocoa">{sale.location ?? "Sin ubicación"}</p>
            <p className="text-xs font-bold text-cocoa-soft">{formatRelativeDay(sale.saleDate)}</p>
          </div>
          <p className="mb-2 line-clamp-1 text-sm text-cocoa-soft">
            {sale.items
              .map((i) => `${i.flavorName ?? "Sabor"} ×${i.quantity}`)
              .join(" · ")}
          </p>
          <div className="flex items-center justify-between border-t border-cocoa/10 pt-2">
            <p className="text-lg font-black text-cocoa">{formatMoney(sale.total, currency)}</p>
            <p className="text-sm font-bold text-turquoise-deep">
              Ganancia: +{formatMoney(sale.profit ?? 0, currency)}
            </p>
          </div>
        </div>

        {/* Consecuencias */}
        <div className="space-y-2 rounded-2xl bg-strawberry/5 p-4">
          <p className="text-xs font-bold text-strawberry">¿Qué pasa al eliminar?</p>
          <ul className="space-y-1 text-xs text-cocoa">
            <li className="flex items-start gap-2">
              <span className="text-strawberry">•</span>
              El inventario se restaurará (las paletas volverán a estar disponibles).
            </li>
            <li className="flex items-start gap-2">
              <span className="text-strawberry">•</span>
              Los ingresos y ganancias registrados se reducirán.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-strawberry">•</span>
              Esta acción no se puede deshacer.
            </li>
          </ul>
        </div>

        {/* Checkbox de confirmación */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-5 w-5 rounded-lg border-2 border-cocoa/20 text-strawberry accent-strawberry"
          />
          <span className="text-sm font-semibold text-cocoa">
            Entiendo que esta acción no se puede deshacer
          </span>
        </label>

        {/* Botones */}
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={handleDelete}
            disabled={!confirmed || deleting}
          >
            {deleting ? "Eliminando…" : "Eliminar permanentemente"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
