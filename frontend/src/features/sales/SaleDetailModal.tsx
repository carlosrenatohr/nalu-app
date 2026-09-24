import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { PAYMENT_OPTIONS } from "@/components/ui/PaymentSelect";
import { formatMoney, formatDateLong } from "@/lib/formatting/currency";
import { useBusiness } from "@/hooks/useBusiness";
import type { Sale } from "@/types";

// ---------------------------------------------------------------------
// Detalle de una venta: ubicación, fecha, tipo de pago, cada línea con
// su precio unitario y subtotal, total, ganancia y notas. Abre al tocar
// la fila de la lista (espejo del detalle de compras; antes no había
// forma de ver qué se vendió sin editar). La factura queda para después.
// ---------------------------------------------------------------------

interface SaleDetailModalProps {
  open: boolean;
  sale: Sale | null;
  onClose: () => void;
  /** Abre la edición desde el detalle. */
  onEdit?: () => void;
}

export function SaleDetailModal({ open, sale, onClose, onEdit }: SaleDetailModalProps) {
  const { currency } = useBusiness();
  if (!sale) return null;

  const payment = PAYMENT_OPTIONS.find((o) => o.value === sale.paymentType);
  const units = sale.items.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Detalle de venta"
      footer={
        <div className="flex w-full gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cerrar
          </Button>
          {onEdit ? (
            <Button className="flex-1" onClick={onEdit}>
              Editar venta
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Encabezado: ubicación, fecha, pago y unidades */}
        <div className="rounded-2xl bg-turquoise/12 p-4">
          <p className="font-extrabold text-cocoa">{sale.location ?? "Sin ubicación"}</p>
          <p className="text-sm font-semibold text-cocoa-soft">
            {formatDateLong(sale.saleDate)}
          </p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-cocoa-soft">
              {payment?.emoji} {payment?.label ?? "Efectivo"}
            </span>
            <span className="text-sm font-bold text-cocoa-soft">{units} paletas</span>
          </div>
        </div>

        {/* Líneas: sabor, cantidad × precio y subtotal */}
        <ul className="space-y-2">
          {sale.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-cream px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-cocoa">
                  {item.flavorName ?? "Sabor"}
                </p>
                <p className="text-xs font-semibold text-cocoa-soft">
                  {item.quantity} × {formatMoney(item.unitPrice, currency)}
                </p>
              </div>
              <span className="text-sm font-black text-cocoa">
                {formatMoney(item.subtotal, currency)}
              </span>
            </li>
          ))}
        </ul>

        {/* Total + ganancia (costo histórico congelado en el servidor) */}
        <div className="flex items-center justify-between rounded-2xl bg-gradient-to-br from-turquoise to-turquoise-deep p-4 text-white shadow-pop">
          <div>
            <span className="block text-sm font-bold text-white/85">Total de la venta</span>
            {sale.profit !== undefined ? (
              <span className="block text-xs font-bold text-white/85">
                Ganancia +{formatMoney(sale.profit, currency)}
              </span>
            ) : null}
          </div>
          <span className="text-xl font-black">{formatMoney(sale.total, currency)}</span>
        </div>

        {/* Notas */}
        {sale.notes ? (
          <div>
            <p className="mb-1 text-xs font-bold text-cocoa-soft">Notas</p>
            <p className="rounded-2xl bg-cream p-3 text-sm font-semibold text-cocoa">
              {sale.notes}
            </p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
