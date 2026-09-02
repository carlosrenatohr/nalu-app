import { useState } from "react";
import { useAsync } from "@/hooks/useAsync";
import { useBusiness } from "@/hooks/useBusiness";
import { flavorsApi } from "@/services/api";
import { formatMoney } from "@/lib/formatting/currency";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageLoader } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { IconPlus, IconEdit } from "@/components/ui/icons";
import { FlavorModal } from "./FlavorModal";
import type { Flavor } from "@/types";

// ---------------------------------------------------------------------
// Página de gestión de sabores: crear, editar y desactivar sabores
// con emoji, nombre, precios de referencia y color.
// ---------------------------------------------------------------------

export function FlavorsPage() {
  const { toast } = useToast();
  const { currency } = useBusiness();
  const { data: flavors, loading, reload } = useAsync(() => flavorsApi.list(true), []);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingFlavor, setEditingFlavor] = useState<Flavor | null>(null);
  const [toggleModal, setToggleModal] = useState<Flavor | null>(null);
  const [toggling, setToggling] = useState(false);

  function handleCreate() {
    setEditingFlavor(null);
    setModalOpen(true);
  }

  function handleEdit(flavor: Flavor) {
    setEditingFlavor(flavor);
    setModalOpen(true);
  }

  async function handleToggleActive(flavor: Flavor) {
    setToggling(true);
    try {
      await flavorsApi.update(flavor.id, { active: !flavor.active });
      toast(flavor.active ? "Sabor desactivado" : "Sabor activado");
      setToggleModal(null);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo actualizar", "error");
    } finally {
      setToggling(false);
    }
  }

  if (loading) return <PageLoader label="Cargando sabores…" />;

  return (
    <div className="animate-fade-up space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-cocoa">Sabores 🍦</h1>
          <p className="text-sm font-semibold text-cocoa-soft">
            {flavors ? `${flavors.length} sabores en tu catálogo` : "Cargando…"}
          </p>
        </div>
        <Button onClick={handleCreate}>
          <IconPlus className="h-5 w-5" />
          <span className="hidden sm:inline">Nuevo sabor</span>
          <span className="sm:hidden">Agregar</span>
        </Button>
      </div>

      {flavors && flavors.length > 0 ? (
        <ul className="space-y-3">
          {flavors.map((flavor) => (
            <li key={flavor.id}>
              <Card className="transition-shadow hover:shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
                      style={{ backgroundColor: flavor.color ? `${flavor.color}20` : undefined }}
                      aria-hidden="true"
                    >
                      {flavor.emoji ?? "🍦"}
                    </span>
                    <div>
                      <p className="font-extrabold text-cocoa">
                        {flavor.name}
                        {!flavor.active && (
                          <Badge tone="gray" className="ml-2">inactivo</Badge>
                        )}
                      </p>
                      <div className="flex gap-3 text-xs font-semibold text-cocoa-soft">
                        {flavor.costPrice != null && (
                          <span>Costo: {formatMoney(flavor.costPrice, currency)}</span>
                        )}
                        {flavor.salePrice != null && (
                          <span>Venta: {formatMoney(flavor.salePrice, currency)}</span>
                        )}
                        {flavor.costPrice != null && flavor.salePrice != null && (
                          <span className="text-turquoise-deep">
                            +{formatMoney(flavor.salePrice - flavor.costPrice, currency)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(flavor)}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-cocoa-soft hover:bg-cocoa/5"
                      aria-label={`Editar ${flavor.name}`}
                    >
                      <IconEdit className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setToggleModal(flavor)}
                      className={`min-h-10 rounded-full px-3 text-xs font-bold transition-colors ${
                        flavor.active
                          ? "bg-strawberry/10 text-strawberry"
                          : "bg-kiwi/15 text-kiwi"
                      }`}
                    >
                      {flavor.active ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          emoji="🍦"
          title="No tienes sabores todavía"
          description="Agrega tu primer sabor para empezar a vender."
          action={
            <Button onClick={handleCreate}>
              <IconPlus className="h-5 w-5" /> Agregar sabor
            </Button>
          }
        />
      )}

      {/* Modal crear/editar */}
      <FlavorModal
        key={editingFlavor?.id ?? "new"}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={reload}
        flavor={editingFlavor}
      />

      {/* Modal confirmar desactivar/activar */}
      <Modal
        open={Boolean(toggleModal)}
        onClose={() => setToggleModal(null)}
        title={toggleModal?.active ? "Desactivar sabor" : "Activar sabor"}
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setToggleModal(null)}>
              Cancelar
            </Button>
            <Button
              variant={toggleModal?.active ? "danger" : "primary"}
              className="flex-1"
              onClick={() => toggleModal && handleToggleActive(toggleModal)}
              disabled={toggling}
            >
              {toggling ? "Guardando…" : toggleModal?.active ? "Desactivar" : "Activar"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-cocoa">
          {toggleModal?.active
            ? `¿Desactivar "${toggleModal?.name}"? No aparecerá en las listas de ventas ni compras.`
            : `¿Reactivar "${toggleModal?.name}"? Volverá a estar disponible.`}
        </p>
      </Modal>
    </div>
  );
}
