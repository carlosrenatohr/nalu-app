import { useState } from "react";
import { suppliersApi } from "@/services/api";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import type { Supplier } from "@/types";

// ---------------------------------------------------------------------
// Modal reutilizable para crear o editar un proveedor.
// ---------------------------------------------------------------------

interface SupplierModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  supplier?: Supplier | null;
}

export function SupplierModal({ open, onClose, onSaved, supplier }: SupplierModalProps) {
  const { toast } = useToast();
  const isEditing = Boolean(supplier);

  const [name, setName] = useState(supplier?.name ?? "");
  const [contact, setContact] = useState(supplier?.contact ?? "");
  const [notes, setNotes] = useState(supplier?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      toast("Escribe el nombre del proveedor", "error");
      return;
    }
    setSaving(true);
    try {
      const input = {
        name: name.trim(),
        contact: contact.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (isEditing && supplier) {
        await suppliersApi.update(supplier.id, input);
        toast("Proveedor actualizado");
      } else {
        await suppliersApi.create(input);
        toast("Proveedor agregado");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo guardar", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? "Editar proveedor" : "Nuevo proveedor"}
      footer={
        <Button className="w-full" onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? "Guardando…" : isEditing ? "Guardar cambios" : "Guardar proveedor"}
        </Button>
      }
    >
      <div className="space-y-4">
        <Input
          label="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Distribuidora La Tropical"
          autoFocus
        />
        <Input
          label="Contacto"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Teléfono, persona…"
        />
        <Textarea
          label="Notas"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Horarios, condiciones…"
        />
      </div>
    </Modal>
  );
}
