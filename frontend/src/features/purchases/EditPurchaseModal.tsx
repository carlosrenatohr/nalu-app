import { useEffect, useMemo, useState } from "react";
import { flavorsApi, purchasesApi, suppliersApi } from "@/services/api";
import { formatMoney } from "@/lib/formatting/currency";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Stepper } from "@/components/ui/Stepper";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { PageLoader } from "@/components/ui/Spinner";
import { useBusiness } from "@/hooks/useBusiness";
import { useAsync } from "@/hooks/useAsync";
import { PaymentSelect } from "@/components/ui/PaymentSelect";
import type { PaymentType, Purchase } from "@/types";

// ---------------------------------------------------------------------
// Modal para editar una compra existente: proveedor, fecha, tipo de pago,
// notas y líneas por sabor (cantidad + costo unitario). El total lo
// recalcula el servidor; aquí se muestra una estimación para la UX.
// ---------------------------------------------------------------------

interface Line {
  flavorId: string;
  quantity: number;
  unitCost: number;
}

interface EditPurchaseModalProps {
  open: boolean;
  purchase: Purchase | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EditPurchaseModal({ open, purchase, onClose, onSaved }: EditPurchaseModalProps) {
  const { toast } = useToast();
  const { defaultPurchaseCost, currency } = useBusiness();

  const suppliers = useAsync(() => suppliersApi.list(), []);
  const flavors = useAsync(() => flavorsApi.list(), []);

  const [supplierId, setSupplierId] = useState("");
  const [date, setDate] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [saving, setSaving] = useState(false);

  // Inicializar desde la compra existente
  useEffect(() => {
    if (purchase && open) {
      setSupplierId(purchase.supplierId);
      setDate(purchase.purchaseDate);
      setNotes(purchase.notes ?? "");
      setPaymentType(purchase.paymentType ?? "cash");
      const grouped = new Map<string, { quantity: number; unitCost: number }>();
      for (const it of purchase.items) {
        const cur = grouped.get(it.flavorId);
        grouped.set(it.flavorId, {
          quantity: (cur?.quantity ?? 0) + it.quantity,
          unitCost: it.unitCost,
        });
      }
      setLines(
        Array.from(grouped.entries()).map(([flavorId, v]) => ({ flavorId, ...v })),
      );
    }
  }, [purchase, open]);

  function setLine(flavorId: string, patch: Partial<Line>) {
    setLines((prev) => {
      const existing = prev.find((l) => l.flavorId === flavorId);
      if (!existing) {
        return [...prev, { flavorId, quantity: 1, unitCost: defaultPurchaseCost, ...patch }];
      }
      return prev.map((l) => (l.flavorId === flavorId ? { ...l, ...patch } : l));
    });
  }

  function removeLine(flavorId: string) {
    setLines((prev) => prev.filter((l) => l.flavorId !== flavorId));
  }

  const total = useMemo(() => lines.reduce((acc, l) => acc + l.quantity * l.unitCost, 0), [lines]);
  const totalUnits = useMemo(() => lines.reduce((acc, l) => acc + l.quantity, 0), [lines]);

  async function handleSave() {
    if (lines.length === 0 || lines.every((l) => l.quantity === 0)) {
      toast("Agrega al menos un sabor con cantidad", "error");
      return;
    }
    if (!supplierId) {
      toast("Elige un proveedor", "error");
      return;
    }
    if (!purchase) return;
    setSaving(true);
    try {
      await purchasesApi.update(purchase.id, {
        purchaseDate: date,
        supplierId,
        notes: notes.trim() || undefined,
        paymentType,
        items: lines
          .filter((l) => l.quantity > 0)
          .map((l) => ({ flavorId: l.flavorId, quantity: l.quantity, unitCost: l.unitCost })),
      });
      toast("Compra actualizada");
      onSaved();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo actualizar la compra", "error");
    } finally {
      setSaving(false);
    }
  }

  if (suppliers.loading || flavors.loading) return <PageLoader label="Cargando…" />;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Editar compra"
      footer={
        <Button
          className="w-full"
          variant="mango"
          onClick={handleSave}
          disabled={saving || lines.length === 0}
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Proveedor" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Elige un proveedor…</option>
            {(suppliers.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Input
            label="Fecha de compra"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div>
          <span className="mb-2 block text-sm font-bold text-cocoa-soft">Sabores comprados</span>
          <ul className="space-y-2.5">
            {(flavors.data ?? []).map((flavor) => {
              const line = lines.find((l) => l.flavorId === flavor.id);
              return (
                <li
                  key={flavor.id}
                  className="flex items-center justify-between gap-2 rounded-[1.25rem] bg-white p-3 ring-1 ring-cocoa/5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="text-3xl" aria-hidden="true">
                      {flavor.emoji ?? "🍦"}
                    </span>
                    <p className="min-w-0 truncate font-extrabold text-cocoa">{flavor.name}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {line && line.quantity > 0 ? (
                      <label className="flex items-center gap-1">
                        <span className="sr-only">Costo unitario de {flavor.name}</span>
                        <span className="text-xs font-bold text-cocoa-soft">C$</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.5"
                          value={line.unitCost}
                          onChange={(e) =>
                            setLine(flavor.id, {
                              unitCost: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="h-9 w-16 rounded-xl bg-cream px-1 text-center text-xs font-extrabold text-cocoa ring-1 ring-cocoa/10 focus:ring-2 focus:ring-turquoise focus:outline-none"
                        />
                      </label>
                    ) : null}
                    <Stepper
                      value={line?.quantity ?? 0}
                      onChange={(v) => {
                        if (v === 0) removeLine(flavor.id);
                        else setLine(flavor.id, { quantity: v });
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <Textarea
          label="Notas (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ej. entrega, condiciones…"
          maxLength={500}
        />

        {/* Tipo de pago */}
        <PaymentSelect value={paymentType} onChange={setPaymentType} />

        <div className="rounded-[1.25rem] bg-gradient-to-br from-mango to-orange p-5 text-cocoa shadow-soft">
          <div className="flex items-center justify-between text-sm font-bold text-cocoa/75">
            <span>{totalUnits} paletas</span>
          </div>
          <div className="mt-1 flex items-end justify-between">
            <div>
              <p className="text-sm font-bold text-cocoa/75">Total de la compra</p>
              <p className="text-4xl font-black tracking-tight">{formatMoney(total, currency)}</p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}