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
// Salidas de inventario SIN venta: regalar, consumo propio, pérdida.
// Reducen inventario, crean el movimiento y NUNCA generan ingresos.
// ---------------------------------------------------------------------

const EXIT_TYPES: { value: MovementType; label: string; emoji: string }[] = [
  { value: "GIFT", label: "Regalar", emoji: "🎁" },
  { value: "PERSONAL_USE", label: "Consumo propio", emoji: "🍧" },
  { value: "LOSS", label: "Pérdida", emoji: "💧" },
  { value: "ADJUSTMENT", label: "Ajuste", emoji: "⚖️" },
  { value: "RETURN", label: "Devolución", emoji: "↩️" },
];

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
  const [flavorId, setFlavorId] = useState(presetFlavorId ?? inventory[0]?.flavor.id ?? "");
  const [movementType, setMovementType] = useState<MovementType>("GIFT");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && presetFlavorId) setFlavorId(presetFlavorId);
  }, [open, presetFlavorId]);

  const selected = inventory.find((i) => i.flavor.id === flavorId);
  const isReturn = movementType === "RETURN";
  const max = isReturn ? undefined : Math.max(0, selected?.available ?? 0);

  async function handleSave() {
    if (!flavorId || quantity <= 0) return;
    setSaving(true);
    try {
      await inventoryApi.registerMovement({
        flavorId,
        movementType,
        quantity,
        date: localToday(),
        notes: notes.trim() || undefined,
      });
      const label = EXIT_TYPES.find((t) => t.value === movementType)?.label;
      toast(isReturn ? "Devolución registrada" : `${label} registrado`);
      onSaved?.();
      onClose();
      setQuantity(1);
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
      title="Registrar salida"
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
          {inventory.map((i) => (
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
                onClick={() => setMovementType(t.value)}
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

        <div className="flex items-end justify-between gap-4">
          <div>
            <span className="mb-1.5 block text-sm font-bold text-cocoa-soft">Cantidad</span>
            <Stepper
              value={quantity}
              onChange={setQuantity}
              min={1}
              max={max}
              disabled={!isReturn && max === 0}
            />
          </div>
          {!isReturn && selected ? (
            <p className="pb-2 text-sm font-semibold text-cocoa-soft">
              Disponible: <span className="font-extrabold text-cocoa">{selected.available}</span>
            </p>
          ) : null}
        </div>

        <Input
          label="Notas (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="¿Para quién o por qué?"
          maxLength={200}
        />
      </div>
    </Modal>
  );
}
