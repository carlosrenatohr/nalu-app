import { useMemo, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAsync } from "@/hooks/useAsync";
import { useBusiness } from "@/hooks/useBusiness";
import { flavorsApi, inventoryApi, locationsApi, salesApi } from "@/services/api";
import { formatMoney, localToday } from "@/lib/formatting/currency";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { PageLoader } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { EmojiPicker } from "@/components/ui/EmojiPicker";
import { FlavorQuantityRow } from "@/components/ui/FlavorQuantityRow";
import { SearchInput } from "@/components/ui/SearchInput";
import { matchesSearch } from "@/lib/utils/search";
import { DraftBanner } from "@/components/ui/DraftBanner";
import { clearDraft, draftKey, loadDraft, saveDraft } from "@/lib/drafts";
import { PaymentSelect } from "@/components/ui/PaymentSelect";
import { IconArrowLeft, IconCheck, IconPlus } from "@/components/ui/icons";
import { cn } from "@/lib/utils/cn";
import type { PaymentType } from "@/types";

// ---------------------------------------------------------------------
// Venta rápida: una sola pantalla para registrar en segundos.
// Flujo: ubicación → sabores → cantidades → precio → total y ganancia
// estimada → confirmar. Se guarda un borrador si el operador abandona.
// El picker de emoji del sabor rápido vive en un modal aparte.
// ---------------------------------------------------------------------

const QUICK_PRICES = [40, 50, 60];

interface SaleDraft {
  saleDate: string;
  location: string;
  customLocation: string;
  quantities: Record<string, number>;
  unitPrice: number;
  customPrice: string;
  paymentType: PaymentType;
  notes: string;
}

export function NewSalePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { defaultHomePrice, currency, business } = useBusiness();

  const inventory = useAsync(() => inventoryApi.list(), []);
  const locations = useAsync(() => locationsApi.list(), []);

  const [saleDate, setSaleDate] = useState(localToday());
  const [location, setLocation] = useState("");
  const [customLocation, setCustomLocation] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [unitPrice, setUnitPrice] = useState<number>(defaultHomePrice);
  const [customPrice, setCustomPrice] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [query, setQuery] = useState("");
  const [onlyIncluded, setOnlyIncluded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Borrador: recupera uno guardado o crea uno nuevo mientras se edita.
  const draftKeySale = draftKey(business?.id, "sale");
  const [draftNotice, setDraftNotice] = useState<SaleDraft | null>(null);

  useEffect(() => {
    setDraftNotice(loadDraft<SaleDraft>(draftKeySale));
  }, [draftKeySale]);

  useEffect(() => {
    if (draftNotice) return;
    const t = setTimeout(() => {
      saveDraft(draftKeySale, {
        saleDate,
        location,
        customLocation,
        quantities,
        unitPrice,
        customPrice,
        paymentType,
        notes,
      });
    }, 400);
    return () => clearTimeout(t);
  }, [
    draftKeySale,
    saleDate,
    location,
    customLocation,
    quantities,
    unitPrice,
    customPrice,
    paymentType,
    notes,
    draftNotice,
  ]);

  function handleContinueDraft() {
    if (!draftNotice) return;
    setSaleDate(draftNotice.saleDate ?? localToday());
    setLocation(draftNotice.location ?? "");
    setCustomLocation(draftNotice.customLocation ?? "");
    setQuantities(draftNotice.quantities ?? {});
    setUnitPrice(draftNotice.unitPrice ?? defaultHomePrice);
    setCustomPrice(draftNotice.customPrice ?? "");
    setPaymentType(draftNotice.paymentType ?? "cash");
    setNotes(draftNotice.notes ?? "");
    clearDraft(draftKeySale);
    setDraftNotice(null);
  }

  function handleDiscardDraft() {
    clearDraft(draftKeySale);
    setDraftNotice(null);
  }

  // Modal crear sabor rápido
  const [flavorModalOpen, setFlavorModalOpen] = useState(false);
  const [newFlavorName, setNewFlavorName] = useState("");
  const [newFlavorEmoji, setNewFlavorEmoji] = useState<string | null>("🍧");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [newFlavorSaving, setNewFlavorSaving] = useState(false);

  const available = useMemo(
    () => new Map((inventory.data ?? []).map((i) => [i.flavor.id, i])),
    [inventory.data],
  );

  // Solo sabores ACTIVOS y con stock, filtrables por nombre (sin acentos).
  // Orden: menor stock primero (lo más al límite se ve antes).
  // «Solo incluidos» deja únicamente los que ya tienen cantidad (> 0),
  // idéntico al comportamiento del formulario de compras.
  const visibleFlavors = useMemo(
    () =>
      (inventory.data ?? [])
        .filter(
          (inv) =>
            inv.flavor.active &&
            inv.available > 0 &&
            (!onlyIncluded || (quantities[inv.flavor.id] ?? 0) > 0) &&
            matchesSearch(query, inv.flavor.name),
        )
        .sort((a, b) => a.available - b.available),
    [inventory.data, query, quantities, onlyIncluded],
  );

  const parsedCustom = customPrice !== "" ? Number(customPrice) : null;
  const isPriceValid = parsedCustom === null || (parsedCustom > 0 && Number.isFinite(parsedCustom));
  const effectivePrice = isPriceValid ? (parsedCustom ?? unitPrice) : unitPrice;

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
  const unitsText = totalUnits === 1 ? "1 paleta" : `${totalUnits} paletas`;

  function setQty(flavorId: string, qty: number) {
    setQuantities((prev) => ({ ...prev, [flavorId]: qty }));
  }

  // Ubicaciones ordenadas: "Otro" siempre al final
  const sortedLocations = useMemo(() => {
    const list = locations.data ?? [];
    const other = list.filter((l) => l.name === "Otro");
    const rest = list.filter((l) => l.name !== "Otro");
    return [...rest, ...other];
  }, [locations.data]);

  const isOtherSelected = location === "Otro";
  const effectiveLocation = isOtherSelected ? customLocation.trim() : location;

  async function handleSave() {
    if (selectedLines.length === 0) {
      toast("Agrega al menos un sabor", "error");
      return;
    }
    if (!effectiveLocation) {
      toast(isOtherSelected ? "Escribe el nombre de la ubicación" : "Elige una ubicación", "error");
      return;
    }
    setSaving(true);
    try {
      // Si es "Otro" y es una ubicación nueva, crearla primero
      if (isOtherSelected && customLocation.trim()) {
        const exists = (locations.data ?? []).some(
          (l) => l.name.toLowerCase() === customLocation.trim().toLowerCase(),
        );
        if (!exists) {
          await locationsApi.create({ name: customLocation.trim() });
        }
      }

      const sale = await salesApi.create({
        saleDate,
        location: effectiveLocation,
        notes: notes.trim() || undefined,
        paymentType,
        items: selectedLines.map((l) => ({
          flavorId: l.flavorId,
          quantity: l.qty,
          unitPrice: effectivePrice,
        })),
      });
      clearDraft(draftKeySale);
      toast(`Venta registrada: ${formatMoney(sale.total, currency)}`);
      navigate("/sales");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo registrar la venta", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateFlavor() {
    if (!newFlavorName.trim()) return;
    setNewFlavorSaving(true);
    try {
      const flavor = await flavorsApi.create({
        name: newFlavorName.trim(),
        emoji: newFlavorEmoji ?? undefined,
      });
      toast(`Sabor "${flavor.name}" creado`);
      setFlavorModalOpen(false);
      setNewFlavorName("");
      setNewFlavorEmoji("🍧");
      inventory.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo crear el sabor", "error");
    } finally {
      setNewFlavorSaving(false);
    }
  }

  if (inventory.loading) return <PageLoader label="Cargando sabores…" />;
  if (!inventory.data || inventory.data.length === 0) {
    return (
      <EmptyState
        emoji="🍦"
        title="Tu inventario está esperando su primera compra"
        description="Registra una compra para tener paletas que vender."
        action={<Button onClick={() => navigate("/purchases/new")}>Registrar compra</Button>}
      />
    );
  }

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
          <h1 className="text-2xl font-black text-cocoa">Venta rápida ⚡</h1>
          <p className="text-sm font-semibold text-cocoa-soft">Elige, suma y guarda</p>
        </div>
      </div>

      {draftNotice ? (
        <DraftBanner onContinue={handleContinueDraft} onDiscard={handleDiscardDraft} />
      ) : null}

      {/* Ubicación + fecha en una fila en pantallas grandes */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className="mb-1.5 block text-sm font-bold text-cocoa-soft">¿Dónde vendes?</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Ubicación">
            {sortedLocations.map((loc) => (
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
          {isOtherSelected && (
            <input
              type="text"
              value={customLocation}
              onChange={(e) => setCustomLocation(e.target.value)}
              placeholder="Escribe la ubicación…"
              autoFocus
              maxLength={60}
              className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-cocoa ring-1 ring-cocoa/10 focus:ring-2 focus:ring-turquoise focus:outline-none"
            />
          )}
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-bold text-cocoa-soft">
            Fecha de la venta
          </span>
          <input
            type="date"
            value={saleDate}
            onChange={(e) => setSaleDate(e.target.value)}
            className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-cocoa ring-1 ring-cocoa/10 focus:ring-2 focus:ring-turquoise focus:outline-none"
          />
        </div>
      </div>

      {/* Sabores */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold text-cocoa-soft">Sabores</span>
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
            No hay sabores disponibles con ese nombre.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {visibleFlavors.map((inv) => (
              <FlavorQuantityRow
                key={inv.flavor.id}
                id={inv.flavor.id}
                name={inv.flavor.name}
                emoji={inv.flavor.emoji}
                meta={`${inv.available} disponibles`}
                quantity={quantities[inv.flavor.id] ?? 0}
                onChange={(v) => setQty(inv.flavor.id, v)}
                max={Math.max(0, inv.available)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Precio */}
      <div>
        <span className="mb-1.5 block text-sm font-bold text-cocoa-soft">
          Precio por paleta
        </span>
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
              className={cn(
                "min-h-11 w-28 rounded-full bg-white px-4 text-base font-extrabold text-cocoa ring-1 focus:ring-2 focus:outline-none",
                customPrice !== "" && !isPriceValid
                  ? "ring-fresa focus:ring-fresa"
                  : "ring-cocoa/10 focus:ring-turquoise",
              )}
            />
          </label>
        </div>
        {customPrice !== "" && !isPriceValid && (
          <p className="mt-1 text-xs font-semibold text-fresa">Ingresa un precio válido (mayor a 0)</p>
        )}
      </div>

      {/* Comentario */}
      <div>
        <span className="mb-1.5 block text-sm font-bold text-cocoa-soft">
          Comentario (opcional)
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ej. entrega, cliente especial, nota de la venta…"
          rows={2}
          maxLength={500}
          className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-cocoa ring-1 ring-cocoa/10 focus:ring-2 focus:ring-turquoise focus:outline-none"
        />
      </div>

      {/* Tipo de pago */}
      <PaymentSelect value={paymentType} onChange={setPaymentType} />

      {/* Resumen + confirmar: barra inferior fija para ver el total siempre */}
      <div className="sticky bottom-0 z-10 -mx-4 space-y-3 bg-cream/90 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <div className="rounded-[1.25rem] bg-gradient-to-br from-turquoise to-turquoise-deep p-5 text-white shadow-pop">
          <div className="flex items-center justify-between text-sm font-bold text-white/85">
            {totalUnits > 1 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-mango px-2.5 py-0.5 text-xs font-extrabold text-cocoa shadow-soft">
                {unitsText}
              </span>
            ) : (
              <span>{unitsText}</span>
            )}
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

        <Button
          size="lg"
          className="w-full"
          onClick={handleSave}
          disabled={saving || selectedLines.length === 0}
        >
          <IconCheck className="h-6 w-6" />
          {saving ? "Guardando…" : "Confirmar venta"}
        </Button>
      </div>

      {/* Modal crear sabor rápido */}
      <Modal
        open={flavorModalOpen}
        onClose={() => setFlavorModalOpen(false)}
        title="Nuevo sabor"
        footer={
          <Button
            className="w-full"
            onClick={handleCreateFlavor}
            disabled={newFlavorSaving || !newFlavorName.trim()}
          >
            {newFlavorSaving ? "Creando…" : "Crear sabor"}
          </Button>
        }
      >
        <div className="space-y-4">
          <div>
            <span className="mb-1.5 block text-sm font-bold text-cocoa-soft">Emoji del sabor</span>
            {/* Botón compacto: el picker vive en su propio modal para no
                consumir espacio del formulario (igual que FlavorModal). */}
            <button
              type="button"
              onClick={() => setEmojiPickerOpen(true)}
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cream text-4xl ring-1 ring-cocoa/10 transition-transform hover:scale-105"
              aria-label="Cambiar emoji del sabor"
            >
              {newFlavorEmoji ?? "🍧"}
            </button>
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-bold text-cocoa-soft">Nombre</span>
            <input
              type="text"
              value={newFlavorName}
              onChange={(e) => setNewFlavorName(e.target.value)}
              placeholder="Ej. Mango con Chile"
              autoFocus
              maxLength={60}
              className="w-full rounded-2xl bg-cream px-4 py-3 text-sm font-semibold text-cocoa ring-1 ring-cocoa/10 focus:ring-2 focus:ring-turquoise focus:outline-none"
            />
          </div>
        </div>

        {/* Selector de emoji: solo en modal aparte */}
        <Modal
          open={emojiPickerOpen}
          onClose={() => setEmojiPickerOpen(false)}
          title="Elegir emoji"
          footer={
            <Button className="w-full" variant="mango" onClick={() => setEmojiPickerOpen(false)}>
              Listo
            </Button>
          }
        >
          <EmojiPicker value={newFlavorEmoji} onChange={setNewFlavorEmoji} />
        </Modal>
      </Modal>
    </div>
  );
}
