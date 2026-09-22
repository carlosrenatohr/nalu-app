import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select, Input } from "@/components/ui/Input";
import { Stepper } from "@/components/ui/Stepper";
import { useToast } from "@/components/ui/Toast";
import { inventoryApi } from "@/services/api";
import { localToday } from "@/lib/formatting/currency";
import type { FlavorInventory, MovementType } from "@/types";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------
// Salidas/entradas de inventario SIN venta: regalar, consumo propio,
// pérdida, ajuste (± con motivo) y devolución. Crean el movimiento y
// NUNCA generan ingresos. El ajuste es bidireccional y exige motivo.
// ---------------------------------------------------------------------

const EXIT_TYPES: { value: MovementType; label: string; emoji: string }[] = [
  { value: "GIFT", label: "Regalar", emoji: "🎁" },
  { value: "PERSONAL_USE", label: "Consumo propio", emoji: "🍧" },
  { value: "LOSS", label: "Pérdida", emoji: "💧" },
  { value: "ADJUSTMENT", label: "Ajuste", emoji: "⚖️" },
  { value: "RETURN", label: "Devolución", emoji: "↩️" },
];

function titleFor(type: MovementType): string {
  if (type === "RETURN") return "Registrar devolución";
  if (type === "ADJUSTMENT") return "Ajuste de stock";
  return "Registrar salida";
}

export function ExitModal({
  open,
  onClose,
  inventory,
  presetFlavorId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  inventory: FlavorInventory[];
  presetFlavorId?: string;
  onSaved?: () => void;
}) {
  const { toast } = useToast();
  // Solo sabores activos para nuevas salidas; el preseleccionado se mantiene
  // aunque esté archivado para poder corregir sus existencias.
  const options = inventory.filter(
    (i) => i.flavor.active || i.flavor.id === presetFlavorId,
  );
  const [flavorId, setFlavorId] = useState(presetFlavorId ?? options[0]?.flavor.id ?? "");
  const [movementType, setMovementType] = useState<MovementType>("GIFT");
  const [direction, setDirection] = useState<"in" | "out">("out");
  const [quantity, setQuantity] = useState(1);
  const [date, setDate] = useState(localToday());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && presetFlavorId) setFlavorId(presetFlavorId);
  }, [open, presetFlavorId]);

  const selected = inventory.find((i) => i.flavor.id === flavorId);
  const isReturn = movementType === "RETURN";
  const isAdjustment = movementType === "ADJUSTMENT";
  const increasing = isReturn || (isAdjustment && direction === "in");
  const isAdjustmentIn = isAdjustment && direction === "in";
  const max = increasing ? undefined : Math.max(0, selected?.available ?? 0);

  async function handleSave() {
    if (!flavorId || quantity <= 0) return;
    setSaving(true);
    try {
      await inventoryApi.registerMovement({
        flavorId,
        movementType,
        quantity,
        date,
        notes: notes.trim() || undefined,
        direction: isAdjustment ? direction : undefined,
      });
      const label = EXIT_TYPES.find((t) => t.value === movementType)?.label;
      toast(
        isReturn
          ? "Devolución registrada"
          : isAdjustmentIn
            ? "Ajuste de stock registrado"
            : `${label} registrado`,
      );
      onSaved?.();
      onClose();
      setQuantity(1);
      setDate(localToday());
      setNotes("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo registrar", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={titleFor(movementType)}
      footer={
        <Button
          onClick={handleSave}
          disabled={saving || !flavorId || quantity <= 0}
          className="w-full"
          size="lg"
        >
          {saving ? "Guardando…" : "Guardar movimiento"}
        </Button>
      }
    >
      <div className="space-y-4">
        <Select label="Sabor" value={flavorId} onChange={(e) => setFlavorId(e.target.value)}>
          {options.map((i) => (
            <option key={i.flavor.id} value={i.flavor.id}>
              {i.flavor.emoji ?? ""} {i.flavor.name} · {i.available} disponibles
            </option>
          ))}
        </Select>

        <div>
          <span className="mb-1.5 block text-sm font-bold text-cocoa-soft">Tipo de salida</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Tipo de salida">
            {EXIT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={movementType === t.value}
                onClick={() => {
                  setMovementType(t.value);
                  setDirection("out");
                }}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-2 py-2 text-sm font-bold transition-colors",
                  movementType === t.value
                    ? "border-turquoise bg-turquoise/10 text-turquoise-deep"
                    : "border-cocoa/10 bg-cream text-cocoa-soft",
                )}
              >
                <span className="text-xl" aria-hidden="true">{t.emoji}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dirección del ajuste: puede aumentar o disminuir stock */}
        {isAdjustment && (
          <div>
            <span className="mb-1.5 block text-sm font-bold text-cocoa-soft">Sentido del ajuste</span>
            <div className="flex gap-2" role="radiogroup" aria-label="Sentido del ajuste">
              <button
                type="button"
                role="radio"
                aria-checked={direction === "out"}
                onClick={() => setDirection("out")}
                className={cn(
                  "min-h-11 flex-1 rounded-full px-4 text-sm font-bold transition-colors",
                  direction === "out"
                    ? "bg-strawberry text-white shadow-pop"
                    : "bg-white text-cocoa-soft ring-1 ring-cocoa/10",
                )}
              >
                Disminuir (−)
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={direction === "in"}
                onClick={() => setDirection("in")}
                className={cn(
                  "min-h-11 flex-1 rounded-full px-4 text-sm font-bold transition-colors",
                  direction === "in"
                    ? "bg-kiwi text-cocoa shadow-pop"
                    : "bg-white text-cocoa-soft ring-1 ring-cocoa/10",
                )}
              >
                Aumentar (+)
              </button>
            </div>
          </div>
        )}

        <div>
          <span className="mb-1.5 block text-sm font-bold text-cocoa-soft">Fecha (por defecto hoy)</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-cocoa ring-1 ring-cocoa/10 focus:ring-2 focus:ring-turquoise focus:outline-none"
          />
        </div>

        <div className="flex items-end justify-between gap-4">
          <div>
            <span className="mb-1.5 block text-sm font-bold text-cocoa-soft">Cantidad</span>
            <Stepper
              value={quantity}
              onChange={setQuantity}
              min={1}
              max={max}
              disabled={!increasing && max === 0}
            />
          </div>
          {!increasing && selected ? (
            <p className="pb-2 text-sm font-semibold text-cocoa-soft">
              Disponible: <span className="font-extrabold text-cocoa">{selected.available}</span>
            </p>
          ) : null}
        </div>

        <Input
          label={isAdjustment ? "Motivo (obligatorio)" : "Notas (opcional)"}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={isAdjustment ? "Ej. producto dañado, conteo físico…" : "¿Para quién o por qué?"}
          maxLength={300}
        />
      </div>
    </Modal>
  );
}