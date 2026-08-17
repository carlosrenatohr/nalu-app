import { useState } from "react";
import { useBusiness } from "@/hooks/useBusiness";
import { flavorsApi } from "@/services/api";
import { formatMoney } from "@/lib/formatting/currency";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmojiPicker } from "@/components/ui/EmojiPicker";
import { useToast } from "@/components/ui/Toast";
import type { Flavor } from "@/types";

// ---------------------------------------------------------------------
// Modal para crear o editar un sabor con emoji, nombre, precios y color.
// ---------------------------------------------------------------------

interface FlavorModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  flavor?: Flavor | null;
}

export function FlavorModal({ open, onClose, onSaved, flavor }: FlavorModalProps) {
  const { toast } = useToast();
  const { currency } = useBusiness();
  const isEditing = Boolean(flavor);

  const [name, setName] = useState(flavor?.name ?? "");
  const [emoji, setEmoji] = useState<string | null>(flavor?.emoji ?? null);
  const [color, setColor] = useState(flavor?.color ?? "#36C9C6");
  const [costPrice, setCostPrice] = useState(String(flavor?.costPrice ?? ""));
  const [salePrice, setSalePrice] = useState(String(flavor?.salePrice ?? ""));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      toast("Escribe el nombre del sabor", "error");
      return;
    }
    setSaving(true);
    try {
      const input = {
        name: name.trim(),
        emoji: emoji ?? undefined,
        color,
        costPrice: costPrice !== "" ? Number(costPrice) : undefined,
        salePrice: salePrice !== "" ? Number(salePrice) : undefined,
      };
      if (isEditing && flavor) {
        await flavorsApi.update(flavor.id, input);
        toast("Sabor actualizado");
      } else {
        await flavorsApi.create(input);
        toast("Sabor agregado");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo guardar el sabor", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? "Editar sabor" : "Nuevo sabor"}
      footer={
        <Button className="w-full" onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? "Guardando…" : isEditing ? "Guardar cambios" : "Agregar sabor"}
        </Button>
      }
    >
      <div className="space-y-5">
        {/* Emoji */}
        <div>
          <span className="mb-1.5 block text-sm font-bold text-cocoa-soft">Emoji del sabor</span>
          <EmojiPicker value={emoji} onChange={setEmoji} />
        </div>

        {/* Nombre */}
        <Input
          label="Nombre del sabor"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Fresa con Crema"
          autoFocus
        />

        {/* Precios */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={`Precio costo (${currency})`}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.5"
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
            placeholder="0.00"
          />
          <Input
            label={`Precio venta (${currency})`}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.5"
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            placeholder="0.00"
          />
        </div>
        {costPrice !== "" && salePrice !== "" && Number(salePrice) > 0 && (
          <p className="-mt-2 text-xs font-semibold text-cocoa-soft">
            Ganancia estimada:{" "}
            <span className="font-extrabold text-turquoise-deep">
              {formatMoney((Number(salePrice) || 0) - (Number(costPrice) || 0), currency)}
            </span>
          </p>
        )}

        {/* Color */}
        <div>
          <span className="mb-1.5 block text-sm font-bold text-cocoa-soft">Color del sabor</span>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-11 w-full cursor-pointer rounded-2xl border-2 border-cocoa/10 bg-cream p-1"
            aria-label="Color del sabor"
          />
        </div>
      </div>
    </Modal>
  );
}
