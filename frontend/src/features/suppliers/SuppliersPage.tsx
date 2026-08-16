import { useState } from "react";
import { useAsync } from "@/hooks/useAsync";
import { suppliersApi } from "@/services/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { PageLoader } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconPlus, IconStore } from "@/components/ui/icons";
import type { Supplier } from "@/types";

export function SuppliersPage() {
  const { toast } = useToast();
  const { data: suppliers, loading, error, reload } = useAsync(() => suppliersApi.list(true), []);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name.trim()) {
      toast("Escribe el nombre del proveedor", "error");
      return;
    }
    setSaving(true);
    try {
      await suppliersApi.create({ name, contact, notes });
      toast("Proveedor agregado");
      setOpen(false);
      setName("");
      setContact("");
      setNotes("");
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo agregar", "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(supplier: Supplier) {
    try {
      await suppliersApi.update(supplier.id, { active: !supplier.active });
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo actualizar", "error");
    }
  }

  return (
    <div className="animate-fade-up space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-cocoa">Proveedores 🏭</h1>
          <p className="text-sm font-semibold text-cocoa-soft">
            De dónde llegan tus paletas
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <IconPlus className="h-5 w-5" /> <span className="hidden sm:inline">Agregar</span>
        </Button>
      </div>

      {loading ? (
        <PageLoader />
      ) : error ? (
        <EmptyState emoji="😅" title="No pudimos cargar los proveedores" description={error} />
      ) : suppliers && suppliers.length > 0 ? (
        <ul className="space-y-3">
          {suppliers.map((s) => (
            <li key={s.id}>
              <Card>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-grape/15 text-grape">
                      <IconStore className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="flex items-center gap-2 font-extrabold text-cocoa">
                        {s.name}
                        {!s.active ? <Badge tone="gray">Inactivo</Badge> : null}
                      </p>
                      <p className="text-xs text-cocoa-soft">
                        {s.contact || "Sin contacto"}
                        {s.notes ? ` · ${s.notes}` : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleActive(s)}
                    className="min-h-11 rounded-full px-4 text-sm font-bold text-turquoise-deep hover:bg-turquoise/10"
                  >
                    {s.active ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          emoji="🏭"
          title="No tienes proveedores"
          description="Agrega tu primer proveedor para registrar compras."
          action={<Button onClick={() => setOpen(true)}>Agregar proveedor</Button>}
        />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nuevo proveedor"
        footer={
          <Button className="w-full" onClick={handleCreate} disabled={saving}>
            {saving ? "Guardando…" : "Guardar proveedor"}
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
    </div>
  );
}
