import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAsync } from "@/hooks/useAsync";
import { useBusiness } from "@/hooks/useBusiness";
import { flavorsApi, purchasesApi, suppliersApi } from "@/services/api";
import { formatMoney, localToday } from "@/lib/formatting/currency";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Stepper } from "@/components/ui/Stepper";
import { useToast } from "@/components/ui/Toast";
import { PageLoader } from "@/components/ui/Spinner";
import { IconArrowLeft, IconCheck } from "@/components/ui/icons";

// ---------------------------------------------------------------------
// Nueva compra: proveedor, fecha, sabores con cantidades y costos.
// Al guardar: compra + ítems + movimientos de inventario (entrada).
// ---------------------------------------------------------------------

interface Line {
  flavorId: string;
  quantity: number;
  unitCost: number;
}

export function NewPurchasePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { defaultPurchaseCost, currency } = useBusiness();

  const suppliers = useAsync(() => suppliersApi.list(), []);
  const flavors = useAsync(() => flavorsApi.list(), []);

  const [supplierId, setSupplierId] = useState("");
  const [date, setDate] = useState(localToday());
  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const total = useMemo(
    () => lines.reduce((acc, l) => acc + l.quantity * l.unitCost, 0),
    [lines],
  );
  const totalUnits = useMemo(
    () => lines.reduce((acc, l) => acc + l.quantity, 0),
    [lines],
  );

  function setLine(flavorId: string, patch: Partial<Line>) {
    setLines((prev) => {
      const existing = prev.find((l) => l.flavorId === flavorId);
      if (!existing) {
        return [
          ...prev,
          { flavorId, quantity: 1, unitCost: defaultPurchaseCost, ...patch },
        ];
      }
      return prev.map((l) => (l.flavorId === flavorId ? { ...l, ...patch } : l));
    });
  }

  function removeLine(flavorId: string) {
    setLines((prev) => prev.filter((l) => l.flavorId !== flavorId));
  }

  async function handleSave() {
    if (lines.length === 0 || lines.every((l) => l.quantity === 0)) {
      toast("Agrega al menos un sabor con cantidad", "error");
      return;
    }
    if (!supplierId) {
      toast("Elige un proveedor", "error");
      return;
    }
    setSaving(true);
    try {
      const purchase = await purchasesApi.create({
        purchaseDate: date,
        supplierId,
        notes: notes.trim() || undefined,
        items: lines
          .filter((l) => l.quantity > 0)
          .map((l) => ({ flavorId: l.flavorId, quantity: l.quantity, unitCost: l.unitCost })),
      });
      toast(`Compra registrada: ${formatMoney(purchase.totalCost, currency)}`);
      navigate("/purchases");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo registrar la compra", "error");
    } finally {
      setSaving(false);
    }
  }

  if (suppliers.loading || flavors.loading) return <PageLoader label="Cargando…" />;

  return (
    <div className="animate-fade-up space-y-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Volver"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-cocoa ring-1 ring-cocoa/10"
        >
          <IconArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-cocoa">Nueva compra 📦</h1>
          <p className="text-sm font-semibold text-cocoa-soft">Registra lo que compraste al proveedor</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Proveedor"
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
        >
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
                className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] bg-white p-3 ring-1 ring-cocoa/5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="text-3xl" aria-hidden="true">
                    {flavor.emoji ?? "🍦"}
                  </span>
                  <p className="font-extrabold text-cocoa">{flavor.name}</p>
                </div>
                <div className="flex items-center gap-3">
                  {line && line.quantity > 0 ? (
                    <label className="flex items-center gap-2">
                      <span className="sr-only">Costo unitario de {flavor.name}</span>
                      <span className="text-sm font-bold text-cocoa-soft">C$</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.5"
                        value={line.unitCost}
                        onChange={(e) =>
                          setLine(flavor.id, { unitCost: Math.max(0, Number(e.target.value) || 0) })
                        }
                        className="h-10 w-20 rounded-xl bg-cream px-2 text-center text-sm font-extrabold text-cocoa ring-1 ring-cocoa/10 focus:ring-2 focus:ring-turquoise focus:outline-none"
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
        placeholder="Ej. entrega, condiciones, próximos pedidos…"
        maxLength={500}
      />

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

      <Button size="lg" className="w-full" variant="mango" onClick={handleSave} disabled={saving}>
        <IconCheck className="h-6 w-6" />
        {saving ? "Guardando…" : "Guardar compra"}
      </Button>
    </div>
  );
}
