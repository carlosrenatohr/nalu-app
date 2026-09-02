import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAsync } from "@/hooks/useAsync";
import { useBusiness } from "@/hooks/useBusiness";
import { flavorsApi, inventoryApi, locationsApi, salesApi } from "@/services/api";
import { formatMoney, localToday } from "@/lib/formatting/currency";
import { Button } from "@/components/ui/Button";
import { Stepper } from "@/components/ui/Stepper";
import { useToast } from "@/components/ui/Toast";
import { PageLoader } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { EmojiPicker } from "@/components/ui/EmojiPicker";
import { IconArrowLeft, IconCheck, IconPlus } from "@/components/ui/icons";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------
// Venta rápida: una sola pantalla para registrar en segundos.
// Flujo: ubicación → sabores → cantidades → precio → total y ganancia
// estimada → confirmar.
// ---------------------------------------------------------------------

const QUICK_PRICES = [40, 50, 60];

export function NewSalePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { defaultHomePrice, currency } = useBusiness();

  const inventory = useAsync(() => inventoryApi.list(), []);
  const locations = useAsync(() => locationsApi.list(), []);

  const [location, setLocation] = useState("");
  const [customLocation, setCustomLocation] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [unitPrice, setUnitPrice] = useState<number>(defaultHomePrice);
  const [customPrice, setCustomPrice] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Modal crear sabor rápido
  const [flavorModalOpen, setFlavorModalOpen] = useState(false);
  const [newFlavorName, setNewFlavorName] = useState("");
  const [newFlavorEmoji, setNewFlavorEmoji] = useState<string | null>(null);
  const [newFlavorSaving, setNewFlavorSaving] = useState(false);

  const available = useMemo(
    () => new Map((inventory.data ?? []).map((i) => [i.flavor.id, i])),
    [inventory.data],
  );

  const effectivePrice = customPrice !== "" ? Number(customPrice) : unitPrice;

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
        saleDate: localToday(),
        location: effectiveLocation,
        items: selectedLines.map((l) => ({
          flavorId: l.flavorId,
          quantity: l.qty,
          unitPrice: effectivePrice,
        })),
      });
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
      setNewFlavorEmoji(null);
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

      {/* Ubicación */}
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

      {/* Sabores */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold text-cocoa-soft">Sabores</span>
          <button
            type="button"
            onClick={() => setFlavorModalOpen(true)}
            className="flex items-center gap-1 text-xs font-bold text-turquoise-deep hover:underline"
          >
            <IconPlus className="h-4 w-4" />
            Nuevo
          </button>
        </div>
        <ul className="space-y-2.5">
          {inventory.data.map((inv) => (
            <li
              key={inv.flavor.id}
              className={cn(
                "flex items-center justify-between gap-3 rounded-[1.25rem] bg-white p-3 ring-1 transition-all",
                (quantities[inv.flavor.id] ?? 0) > 0
                  ? "ring-turquoise shadow-soft"
                  : "ring-cocoa/5",
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="text-3xl" aria-hidden="true">
                  {inv.flavor.emoji ?? "🍦"}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-extrabold text-cocoa">{inv.flavor.name}</p>
                  <p className="text-xs font-semibold text-cocoa-soft">
                    {inv.available} disponibles
                  </p>
                </div>
              </div>
              <Stepper
                value={quantities[inv.flavor.id] ?? 0}
                onChange={(v) => setQty(inv.flavor.id, v)}
                max={Math.max(0, inv.available)}
              />
            </li>
          ))}
        </ul>
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
              className="min-h-11 w-28 rounded-full bg-white px-4 text-base font-extrabold text-cocoa ring-1 ring-cocoa/10 focus:ring-2 focus:ring-turquoise focus:outline-none"
            />
          </label>
        </div>
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

      <Button
        size="lg"
        className="w-full"
        onClick={handleSave}
        disabled={saving || selectedLines.length === 0 || !effectiveLocation}
      >
        <IconCheck className="h-6 w-6" />
        {saving ? "Guardando…" : "Confirmar venta"}
      </Button>

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
            <EmojiPicker value={newFlavorEmoji} onChange={setNewFlavorEmoji} />
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
      </Modal>
    </div>
  );
}
