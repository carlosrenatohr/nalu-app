import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAsync } from "@/hooks/useAsync";
import { useBusiness } from "@/hooks/useBusiness";
import { flavorsApi, purchasesApi, suppliersApi } from "@/services/api";
import { formatMoney, localToday } from "@/lib/formatting/currency";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { PageLoader } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { DraftBanner } from "@/components/ui/DraftBanner";
import { PaymentSelect } from "@/components/ui/PaymentSelect";
import { FlavorModal } from "@/features/flavors/FlavorModal";
import { FlavorQuantityRow } from "@/components/ui/FlavorQuantityRow";
import { SearchInput } from "@/components/ui/SearchInput";
import { matchesSearch } from "@/lib/utils/search";
import { isSelectableFlavor } from "@/lib/utils/flavors";
import { clearDraft, draftKey, loadDraft, saveDraft } from "@/lib/drafts";
import { IconArrowLeft, IconCheck, IconPlus } from "@/components/ui/icons";
import type { PaymentType } from "@/types";

// ---------------------------------------------------------------------
// Nueva compra: proveedor, fecha, sabores con cantidades y costos.
// Al guardar: compra + ítems + movimientos de inventario (entrada).
// Se guarda un borrador si el operador abandona el flujo.
// ---------------------------------------------------------------------

interface Line {
  flavorId: string;
  quantity: number;
  unitCost: number;
}

interface PurchaseDraft {
  supplierId: string;
  date: string;
  lines: Line[];
  notes: string;
  paymentType: PaymentType;
}

export function NewPurchasePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { defaultPurchaseCost, currency, business } = useBusiness();

  const suppliers = useAsync(() => suppliersApi.list(), []);
  const flavors = useAsync(() => flavorsApi.list(), []);

  const [supplierId, setSupplierId] = useState("");
  const [date, setDate] = useState(localToday());
  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [onlyIncluded, setOnlyIncluded] = useState(false);
  const [flavorModalOpen, setFlavorModalOpen] = useState(false);

  // Borrador: recupera uno guardado o crea uno nuevo mientras se edita.
  const draftKeyPurchase = draftKey(business?.id, "purchase");
  const [draftNotice, setDraftNotice] = useState<PurchaseDraft | null>(null);

  useEffect(() => {
    setDraftNotice(loadDraft<PurchaseDraft>(draftKeyPurchase));
  }, [draftKeyPurchase]);

  useEffect(() => {
    if (draftNotice) return;
    const t = setTimeout(() => {
      saveDraft(draftKeyPurchase, { supplierId, date, lines, notes, paymentType });
    }, 400);
    return () => clearTimeout(t);
  }, [draftKeyPurchase, supplierId, date, lines, notes, paymentType, draftNotice]);

  function handleContinueDraft() {
    if (!draftNotice) return;
    setSupplierId(draftNotice.supplierId ?? "");
    setDate(draftNotice.date ?? localToday());
    setLines(draftNotice.lines ?? []);
    setNotes(draftNotice.notes ?? "");
    setPaymentType(draftNotice.paymentType ?? "cash");
    clearDraft(draftKeyPurchase);
    setDraftNotice(null);
  }

  function handleDiscardDraft() {
    clearDraft(draftKeyPurchase);
    setDraftNotice(null);
  }

  // Modal crear proveedor rápido
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierContact, setNewSupplierContact] = useState("");
  const [newSupplierSaving, setNewSupplierSaving] = useState(false);

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

  // Sabores visibles: activos (el caché offline guarda archivados), filtrables
  // por nombre (sin acentos) y (si el switch está activo) solo los ya incluidos.
  const visibleFlavors = useMemo(() => {
    return (flavors.data ?? []).filter((flavor) => {
      const includedQty = lines.find((l) => l.flavorId === flavor.id)?.quantity ?? 0;
      if (!isSelectableFlavor(flavor, includedQty)) return false;
      if (onlyIncluded && includedQty <= 0) return false;
      return matchesSearch(query, flavor.name);
    });
  }, [flavors.data, query, onlyIncluded, lines]);

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
        paymentType,
        items: lines
          .filter((l) => l.quantity > 0)
          .map((l) => ({ flavorId: l.flavorId, quantity: l.quantity, unitCost: l.unitCost })),
      });
      clearDraft(draftKeyPurchase);
      toast(`Compra registrada: ${formatMoney(purchase.totalCost, currency)}`);
      navigate("/purchases");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo registrar la compra", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateSupplier() {
    if (!newSupplierName.trim()) return;
    setNewSupplierSaving(true);
    try {
      const supplier = await suppliersApi.create({
        name: newSupplierName.trim(),
        contact: newSupplierContact.trim() || undefined,
      });
      toast(`Proveedor "${supplier.name}" creado`);
      setSupplierModalOpen(false);
      setNewSupplierName("");
      setNewSupplierContact("");
      setSupplierId(supplier.id);
      suppliers.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo crear el proveedor", "error");
    } finally {
      setNewSupplierSaving(false);
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

      {draftNotice ? (
        <DraftBanner onContinue={handleContinueDraft} onDiscard={handleDiscardDraft} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
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
            </div>
            <button
              type="button"
              onClick={() => setSupplierModalOpen(true)}
              className="mb-0.5 flex h-11 items-center gap-1 rounded-2xl bg-turquoise/10 px-3 text-xs font-bold text-turquoise-deep transition-colors hover:bg-turquoise/20"
              aria-label="Crear proveedor"
            >
              <IconPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Nuevo</span>
            </button>
          </div>
        </div>
        <Input
          label="Fecha de compra"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold text-cocoa-soft">Sabores comprados</span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs font-bold text-cocoa-soft">
              <input
                type="checkbox"
                checked={onlyIncluded}
                onChange={(e) => setOnlyIncluded(e.target.checked)}
                className="h-4 w-4 rounded accent-turquoise"
              />
              Solo incluidos
            </label>
            <button
              type="button"
              onClick={() => setFlavorModalOpen(true)}
              className="flex items-center gap-1 text-xs font-bold text-turquoise-deep hover:underline"
            >
              <IconPlus className="h-4 w-4" />
              Nuevo
            </button>
          </div>
        </div>
        <SearchInput value={query} onChange={setQuery} className="mb-3" />
        {visibleFlavors.length === 0 ? (
          <p className="rounded-2xl bg-cream p-4 text-center text-sm font-semibold text-cocoa-soft">
            No hay sabores que coincidan con la búsqueda.
          </p>
        ) : (
        <ul className="space-y-2.5">
          {visibleFlavors.map((flavor) => {
            const line = lines.find((l) => l.flavorId === flavor.id);
            return (
              <FlavorQuantityRow
                key={flavor.id}
                id={flavor.id}
                name={flavor.name}
                emoji={flavor.emoji}
                quantity={line?.quantity ?? 0}
                onChange={(v) => {
                  if (v === 0) removeLine(flavor.id);
                  else setLine(flavor.id, { quantity: v });
                }}
                trailing={
                  line && line.quantity > 0 ? (
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
                          setLine(flavor.id, { unitCost: Math.max(0, Number(e.target.value) || 0) })
                        }
                        className="h-9 w-16 rounded-xl bg-cream px-1 text-center text-xs font-extrabold text-cocoa ring-1 ring-cocoa/10 focus:ring-2 focus:ring-turquoise focus:outline-none"
                      />
                    </label>
                  ) : null
                }
              />
            );
          })}
        </ul>
        )}
      </div>

      <Textarea
        label="Notas (opcional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Ej. entrega, condiciones, próximos pedidos…"
        maxLength={500}
      />

      {/* Tipo de pago */}
      <PaymentSelect value={paymentType} onChange={setPaymentType} />

      {/* Resumen + guardar: barra inferior fija para ver el total siempre */}
      <div className="sticky bottom-0 z-10 -mx-4 space-y-3 bg-cream/90 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6">
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

      {/* Modal crear proveedor rápido */}
      <Modal
        open={supplierModalOpen}
        onClose={() => setSupplierModalOpen(false)}
        title="Nuevo proveedor"
        footer={
          <Button
            className="w-full"
            onClick={handleCreateSupplier}
            disabled={newSupplierSaving || !newSupplierName.trim()}
          >
            {newSupplierSaving ? "Creando…" : "Crear proveedor"}
          </Button>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nombre"
            value={newSupplierName}
            onChange={(e) => setNewSupplierName(e.target.value)}
            placeholder="Ej. Distribuidora La Tropical"
            autoFocus
          />
          <Input
            label="Contacto (opcional)"
            value={newSupplierContact}
            onChange={(e) => setNewSupplierContact(e.target.value)}
            placeholder="Teléfono, persona…"
          />
        </div>
      </Modal>

      {/* Modal crear sabor rápido (mismo modal de la página de Sabores) */}
      <FlavorModal
        open={flavorModalOpen}
        onClose={() => setFlavorModalOpen(false)}
        onSaved={() => flavors.reload()}
      />
    </div>
  );
}
