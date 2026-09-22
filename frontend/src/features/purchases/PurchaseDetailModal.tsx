import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { PAYMENT_OPTIONS } from "@/components/ui/PaymentSelect";
import { formatMoney, formatDateLong } from "@/lib/formatting/currency";
import { useBusiness } from "@/hooks/useBusiness";
import type { Purchase } from "@/types";

// ---------------------------------------------------------------------
// Detalle de una compra: proveedor, fecha, tipo de pago, cada línea con
// su costo unitario y subtotal, total y notas. Abre al tocar la fila de
// la lista (antes no había forma de ver el desglose sin editar).
// ---------------------------------------------------------------------

interface PurchaseDetailModalProps {
  open: boolean;
  purchase: Purchase | null;
  onClose: () => void;
  /** Abre la edición desde el detalle. */
  onEdit?: () => void;
}

export function PurchaseDetailModal({
  open,
  purchase,
  onClose,
  onEdit,
}: PurchaseDetailModalProps) {
  const { currency } = useBusiness();
  if (!purchase) return null;

  const payment = PAYMENT_OPTIONS.find((o) => o.value === purchase.paymentType);
  const units = purchase.items.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Detalle de compra"
      footer={
        <div className="flex w-full gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cerrar
          </Button>
          {onEdit ? (
            <Button className="flex-1" onClick={onEdit}>
              Editar compra
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Encabezado: proveedor, fecha, pago y unidades */}
        <div className="rounded-2xl bg-mango/15 p-4">
          <p className="font-extrabold text-cocoa">{purchase.supplierName ?? "Proveedor"}</p>
          <p className="text-sm font-semibold text-cocoa-soft">
            {formatDateLong(purchase.purchaseDate)}
          </p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-cocoa-soft">
              {payment?.emoji} {payment?.label ?? "Efectivo"}
            </span>
            <span className="text-sm font-bold text-cocoa-soft">{units} paletas</span>
          </div>
        </div>

        {/* Líneas: sabor, cantidad × costo y subtotal */}
        <ul className="space-y-2">
          {purchase.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-cream px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-cocoa">
                  {item.flavorName ?? "Sabor"}
                </p>
                <p className="text-xs font-semibold text-cocoa-soft">
                  {item.quantity} × {formatMoney(item.unitCost, currency)}
                </p>
              </div>
              <span className="text-sm font-black text-cocoa">
                {formatMoney(item.subtotal, currency)}
              </span>
            </li>
          ))}
        </ul>

        {/* Total */}
        <div className="flex items-center justify-between rounded-2xl bg-gradient-to-br from-mango to-orange p-4 text-cocoa">
          <span className="text-sm font-bold">Total de la compra</span>
          <span className="text-xl font-black">{formatMoney(purchase.totalCost, currency)}</span>
        </div>

        {/* Notas */}
        {purchase.notes ? (
          <div>
            <p className="mb-1 text-xs font-bold text-cocoa-soft">Notas</p>
            <p className="rounded-2xl bg-cream p-3 text-sm font-semibold text-cocoa">
              {purchase.notes}
            </p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
