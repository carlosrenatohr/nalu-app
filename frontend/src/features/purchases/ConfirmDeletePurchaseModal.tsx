import { useState } from "react";
import { purchasesApi } from "@/services/api";
import { formatMoney, formatRelativeDay } from "@/lib/formatting/currency";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { IconAlert } from "@/components/ui/icons";
import { useBusiness } from "@/hooks/useBusiness";
import type { Purchase } from "@/types";

// ---------------------------------------------------------------------
// Confirmación para eliminar una compra: advertencia sobre el efecto en
// el inventario y confirmación explícita antes de proceder.
// ---------------------------------------------------------------------

interface ConfirmDeletePurchaseModalProps {
  open: boolean;
  purchase: Purchase | null;
  onClose: () => void;
  onDeleted: () => void;
}

export function ConfirmDeletePurchaseModal({
  open,
  purchase,
  onClose,
  onDeleted,
}: ConfirmDeletePurchaseModalProps) {
  const { toast } = useToast();
  const { currency } = useBusiness();
  const [confirmed, setConfirmed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!purchase) return;
    setDeleting(true);
    try {
      await purchasesApi.delete(purchase.id);
      toast("Compra eliminada");
      setConfirmed(false);
      onDeleted();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo eliminar la compra", "error");
    } finally {
      setDeleting(false);
    }
  }

  function handleClose() {
    setConfirmed(false);
    onClose();
  }

  if (!purchase) return null;

  return (
    <Modal open={open} onClose={handleClose} title="Eliminar compra">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-2xl bg-strawberry/10 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-strawberry/20 text-strawberry">
            <IconAlert className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-extrabold text-strawberry">Acción irreversible</p>
            <p className="mt-0.5 text-sm text-cocoa">
              Esta compra será eliminada permanentemente y el inventario se verá afectado.
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-cream p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-extrabold text-cocoa">{purchase.supplierName ?? "Proveedor"}</p>
            <p className="text-xs font-bold text-cocoa-soft">
              {formatRelativeDay(purchase.purchaseDate)}
            </p>
          </div>
          <p className="mb-2 line-clamp-1 text-sm text-cocoa-soft">
            {purchase.items
              .map((i) => `${i.flavorName ?? "Sabor"} ×${i.quantity}`)
              .join(" · ")}
          </p>
          <p className="text-lg font-black text-cocoa">{formatMoney(purchase.totalCost, currency)}</p>
        </div>

        <div className="space-y-2 rounded-2xl bg-strawberry/5 p-4">
          <p className="text-xs font-bold text-strawberry">¿Qué pasa al eliminar?</p>
          <ul className="space-y-1 text-xs text-cocoa">
            <li className="flex items-start gap-2">
              <span className="text-strawberry">•</span>
              Las paletas compradas dejarán de sumar al inventario.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-strawberry">•</span>
              Si el inventario quedaría insuficiente, la operación se bloqueará.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-strawberry">•</span>
              Esta acción no se puede deshacer.
            </li>
          </ul>
        </div>

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