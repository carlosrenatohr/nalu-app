import { useEffect, useMemo, useState } from "react";
import { useBusiness } from "@/hooks/useBusiness";
import { inventoryApi, locationsApi, salesApi } from "@/services/api";
import { formatMoney } from "@/lib/formatting/currency";
import { useAsync } from "@/hooks/useAsync";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { PageLoader } from "@/components/ui/Spinner";
import { PaymentSelect } from "@/components/ui/PaymentSelect";
import { FlavorQuantityRow } from "@/components/ui/FlavorQuantityRow";
import { SearchInput } from "@/components/ui/SearchInput";
import { matchesSearch } from "@/lib/utils/search";
import { isSelectableFlavor } from "@/lib/utils/flavors";
import { cn } from "@/lib/utils/cn";
import type { PaymentType, Sale } from "@/types";

// ---------------------------------------------------------------------
// Modal para editar una venta existente: fecha, ubicación, sabores,
// cantidades, precio y tipo de pago. Recalcula el total y la ganancia.
// ---------------------------------------------------------------------

const QUICK_PRICES = [40, 50, 60];

interface EditSaleModalProps {
  open: boolean;
  sale: Sale | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EditSaleModal({ open, sale, onClose, onSaved }: EditSaleModalProps) {
  const { toast } = useToast();
  const { defaultHomePrice, currency } = useBusiness();

  const inventory = useAsync(() => inventoryApi.list(), []);
  const locations = useAsync(() => locationsApi.list(), []);

  const [saleDate, setSaleDate] = useState(sale?.saleDate ?? "");
  const [location, setLocation] = useState(sale?.location ?? "");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [unitPrice, setUnitPrice] = useState<number>(defaultHomePrice);
  const [customPrice, setCustomPrice] = useState<string>("");
  const [notes, setNotes] = useState(sale?.notes ?? "");
  const [paymentType, setPaymentType] = useState<PaymentType>(sale?.paymentType ?? "cash");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  // Inicializar cantidades desde la venta existente
  useEffect(() => {
    if (sale && open) {
      const qtyMap: Record<string, number> = {};
      for (const item of sale.items) {
        qtyMap[item.flavorId] = (qtyMap[item.flavorId] ?? 0) + item.quantity;
      }
      setQuantities(qtyMap);
      setSaleDate(sale.saleDate);
      setLocation(sale.location ?? "");
      setNotes(sale.notes ?? "");
      setPaymentType(sale.paymentType ?? "cash");
      // Usar el precio de la venta si todos los items tienen el mismo precio
      const prices = new Set(sale.items.map((i) => i.unitPrice));
      const firstItem = sale.items[0];
      if (prices.size === 1 && firstItem) {
        const p = firstItem.unitPrice;
        if (QUICK_PRICES.includes(p)) {
          setUnitPrice(p);
          setCustomPrice("");
        } else {
          setUnitPrice(defaultHomePrice);
          setCustomPrice(String(p));
        }
      }
    }
  }, [sale, open, defaultHomePrice]);

  const available = useMemo(
    () => new Map((inventory.data ?? []).map((i) => [i.flavor.id, i])),
    [inventory.data],
  );

  const effectivePrice = customPrice !== "" ? Number(customPrice) : unitPrice;

  // Sabores seleccionables: activos (o ya incluidos en la venta), filtrables
  // por nombre sin acentos y ordenados del más escaso al más disponible.
  const visibleFlavors = useMemo(
    () =>
      (inventory.data ?? [])
        .filter(
          (inv) =>
            isSelectableFlavor(inv.flavor, quantities[inv.flavor.id] ?? 0) &&
            matchesSearch(query, inv.flavor.name),
        )
        .sort((a, b) => a.available - b.available),
    [inventory.data, query, quantities],
  );

  const selectedLines = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, qty]) => qty > 0)
        .map(([flavorId, qty]) => ({ flavorId, qty, inv: available.get(flavorId) })),
    [quantities, available],
  );

  const total = useMemo(
    () => selectedLines.reduce((acc, l) => acc + l.qty * effectivePrice, 0),
    [selectedLines, effectivePrice],
  );

  const estimatedCost = useMemo(
    () =>
      selectedLines.reduce(
        (acc, l) => acc + l.qty * (l.inv?.lastCost ?? 0),
        0,
      ),
    [selectedLines],
  );

  const profit = total - estimatedCost;
  const totalUnits = selectedLines.reduce((acc, l) => acc + l.qty, 0);

  function setQty(flavorId: string, qty: number) {
    setQuantities((prev) => ({ ...prev, [flavorId]: qty }));
  }

  async function handleSave() {
    if (selectedLines.length === 0) {
      toast("Agrega al menos un sabor", "error");
      return;
    }
    if (!location) {
      toast("Elige una ubicación", "error");
      return;
    }
    if (!sale) return;
    setSaving(true);
    try {
      await salesApi.update(sale.id, {
        saleDate,
        location,
        notes: notes.trim() || undefined,
        paymentType,
        items: selectedLines.map((l) => ({
          flavorId: l.flavorId,
          quantity: l.qty,
          unitPrice: effectivePrice,
        })),
      });
      toast("Venta actualizada");
      onSaved();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo actualizar la venta", "error");
    } finally {
      setSaving(false);
    }
  }

  if (inventory.loading) return <PageLoader label="Cargando sabores…" />;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Editar venta"
      footer={
        <Button
          className="w-full"
          onClick={handleSave}
          disabled={saving || selectedLines.length === 0}
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
      }
    >
      <div className="space-y-5">
        {/* Ubicación */}
        <div>
          <span className="mb-1.5 block text-sm font-bold text-cocoa-soft">¿Dónde vendes?</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Ubicación">
            {(locations.data ?? []).map((loc) => (
              <button
                key={loc.id}
                type="button"
                role="radio"
                aria-checked={location === loc.name}
                onClick={() => setLocation(loc.name)}
                className={cn(
                  "min-h-11 rounded-full px-5 text-sm font-bold transition-colors",
                  location === loc.name
                    ? "bg-turquoise text-white shadow-pop"
                    : "bg-white text-cocoa-soft ring-1 ring-cocoa/10",
                )}
              >
                {loc.name}
              </button>
            ))}
          </div>
        </div>

        {/* Fecha */}
        <div>
          <span className="mb-1.5 block text-sm font-bold text-cocoa-soft">Fecha de la venta</span>
          <input
            type="date"
            value={saleDate}
            onChange={(e) => setSaleDate(e.target.value)}
            className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-cocoa ring-1 ring-cocoa/10 focus:ring-2 focus:ring-turquoise focus:outline-none"
          />
        </div>

        {/* Tipo de pago */}
        <PaymentSelect value={paymentType} onChange={setPaymentType} />

        {/* Sabores */}
        <div>
          <span className="mb-2 block text-sm font-bold text-cocoa-soft">Sabores</span>
          <SearchInput value={query} onChange={setQuery} className="mb-3" />
          <ul className="space-y-2.5">
            {visibleFlavors.map((inv) => (
              <FlavorQuantityRow
                key={inv.flavor.id}
                id={inv.flavor.id}
                name={inv.flavor.name}
                emoji={inv.flavor.emoji}
                meta={`${inv.available} disponibles`}
                quantity={quantities[inv.flavor.id] ?? 0}
                onChange={(v) => setQty(inv.flavor.id, v)}
                max={Math.max(0, inv.available + (quantities[inv.flavor.id] ?? 0))}
              />
            ))}
          </ul>
        </div>

        {/* Precio */}
        <div>
          <span className="mb-1.5 block text-sm font-bold text-cocoa-soft">Precio por paleta</span>
          <div className="flex flex-wrap items-center gap-2">
            {QUICK_PRICES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setUnitPrice(p);
                  setCustomPrice("");
                }}
                className={cn(
                  "min-h-11 rounded-full px-5 text-base font-extrabold transition-colors",
                  customPrice === "" && unitPrice === p
                    ? "bg-mango text-cocoa shadow-soft"
                    : "bg-white text-cocoa-soft ring-1 ring-cocoa/10",
                )}
              >
                {formatMoney(p, currency)}
              </button>
            ))}
            <label className="relative">
              <span className="sr-only">Precio personalizado</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                placeholder={formatMoney(unitPrice, currency)}
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                className="min-h-11 w-28 rounded-full bg-white px-4 text-base font-extrabold text-cocoa ring-1 ring-cocoa/10 focus:ring-2 focus:ring-turquoise focus:outline-none"
              />
            </label>
          </div>
        </div>

        {/* Notas */}
        <div>
          <span className="mb-1.5 block text-sm font-bold text-cocoa-soft">Notas (opcional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Detalles de la venta…"
            rows={2}
            className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-cocoa ring-1 ring-cocoa/10 focus:ring-2 focus:ring-turquoise focus:outline-none"
          />
        </div>

        {/* Resumen */}
        <div className="rounded-[1.25rem] bg-gradient-to-br from-turquoise to-turquoise-deep p-5 text-white shadow-pop">
          <div className="flex items-center justify-between text-sm font-bold text-white/85">
            <span>{totalUnits} paletas</span>
            <span>Costo est. {formatMoney(estimatedCost, currency)}</span>
          </div>
          <div className="mt-1 flex items-end justify-between">
            <div>
              <p className="text-sm font-bold text-white/85">Total</p>
              <p className="text-4xl font-black tracking-tight">{formatMoney(total, currency)}</p>
            </div>
            <p className="text-right">
              <span className="text-xs font-bold text-white/85">Ganancia est.</span>
              <br />
              <span className="text-xl font-black">+{formatMoney(profit, currency)}</span>
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
