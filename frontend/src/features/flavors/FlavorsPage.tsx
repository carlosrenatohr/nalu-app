import { useMemo, useState } from "react";
import { useAsync } from "@/hooks/useAsync";
import { useBusiness } from "@/hooks/useBusiness";
import { flavorsApi, inventoryApi } from "@/services/api";
import { formatMoney } from "@/lib/formatting/currency";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageLoader } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { SearchInput } from "@/components/ui/SearchInput";
import { matchesSearch } from "@/lib/utils/search";
import { useToast } from "@/components/ui/Toast";
import { IconBox, IconEdit, IconPlus, IconTrash } from "@/components/ui/icons";
import { ExitModal } from "@/features/inventory/ExitModal";
import { FlavorModal } from "./FlavorModal";
import type { Flavor } from "@/types";

// ---------------------------------------------------------------------
// Página de gestión de sabores en una grilla compacta para ver muchos
// sabores sin scroll. Separa activos de inactivos/archivados y agrupa
// las acciones (editar, ajustar stock, activar/desactivar, eliminar)
// en un menú. El ajuste reutiliza ExitModal (motivo obligatorio).
// ---------------------------------------------------------------------

export function FlavorsPage() {
  const { toast } = useToast();
  const { currency } = useBusiness();
  const { data: flavors, loading, reload } = useAsync(() => flavorsApi.list(true), []);
  // Inventario para el ajuste de stock: disponible y sabor preseleccionado.
  const { data: inventory, reload: reloadInventory } = useAsync(() => inventoryApi.list(), []);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingFlavor, setEditingFlavor] = useState<Flavor | null>(null);
  const [toggleModal, setToggleModal] = useState<Flavor | null>(null);
  const [deleteModal, setDeleteModal] = useState<Flavor | null>(null);
  const [adjustFlavor, setAdjustFlavor] = useState<Flavor | null>(null);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [query, setQuery] = useState("");

  // Activos e inactivos, filtrables por nombre sin acentos ni mayúsculas.
  const { active, inactive } = useMemo(() => {
    const all = (flavors ?? []).filter((f) => matchesSearch(query, f.name));
    return {
      active: all.filter((f) => f.active),
      inactive: all.filter((f) => !f.active),
    };
  }, [flavors, query]);

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

  async function handleDeleteFlavor(flavor: Flavor) {
    setDeleting(true);
    try {
      const result = await flavorsApi.delete(flavor.id);
      toast(
        result.archived
          ? `"${flavor.name}" archivado (conserva su historial)`
          : `"${flavor.name}" eliminado`,
      );
      setDeleteModal(null);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo eliminar el sabor", "error");
    } finally {
      setDeleting(false);
    }
  }

  function renderFlavor(flavor: Flavor) {
    const prices =
      flavor.costPrice != null && flavor.salePrice != null
        ? `C ${formatMoney(flavor.costPrice, currency)} · V ${formatMoney(flavor.salePrice, currency)}`
        : flavor.costPrice != null
          ? `Costo ${formatMoney(flavor.costPrice, currency)}`
          : flavor.salePrice != null
            ? `Venta ${formatMoney(flavor.salePrice, currency)}`
            : "Sin precios";
    return (
      <li
        key={flavor.id}
        className="relative flex flex-col items-center rounded-2xl bg-white p-3 pt-2 text-center ring-1 ring-cocoa/5"
      >
        <div className="absolute right-0.5 top-0.5">
          <ActionMenu
            label={`Acciones de ${flavor.name}`}
            items={[
              {
                label: "Editar",
                icon: <IconEdit className="h-4 w-4" />,
                onClick: () => handleEdit(flavor),
              },
              {
                label: "Ajustar stock",
                icon: <IconBox className="h-4 w-4" />,
                onClick: () => setAdjustFlavor(flavor),
              },
              {
                label: flavor.active ? "Desactivar" : "Activar",
                onClick: () => setToggleModal(flavor),
              },
              {
                label: "Eliminar",
                icon: <IconTrash className="h-4 w-4" />,
                danger: true,
                onClick: () => setDeleteModal(flavor),
              },
            ]}
          />
        </div>
        <span
          className="mt-2 flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
          style={{ backgroundColor: flavor.color ? `${flavor.color}20` : undefined }}
          aria-hidden="true"
        >
          {flavor.emoji ?? "🍦"}
        </span>
        <p className="mt-1 w-full truncate font-extrabold text-cocoa">{flavor.name}</p>
        <p className="w-full truncate text-[11px] font-semibold text-cocoa-soft">{prices}</p>
      </li>
    );
  }

  if (loading) return <PageLoader label="Cargando sabores…" />;

  return (
    <div className="animate-fade-up space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-cocoa">Sabores 🍦</h1>
          <p className="text-sm font-semibold text-cocoa-soft">
            {flavors ? `${active.length} activos · ${inactive.length} archivados` : "Cargando…"}
          </p>
        </div>
        <Button onClick={handleCreate}>
          <IconPlus className="h-5 w-5" />
          <span className="hidden sm:inline">Nuevo sabor</span>
          <span className="sm:hidden">Agregar</span>
        </Button>
      </div>

      {flavors && flavors.length > 0 ? (
        <div className="space-y-6">
          <SearchInput value={query} onChange={setQuery} />
          <section>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-sm font-bold text-cocoa-soft">Activos</h2>
              <Badge tone="green">{active.length}</Badge>
            </div>
            {active.length > 0 ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {active.map(renderFlavor)}
              </ul>
            ) : (
              <EmptyState emoji="🍦" title="Sin sabores activos" description="Crea o activa un sabor." />
            )}
          </section>

          {inactive.length > 0 && (
            <section>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-sm font-bold text-cocoa-soft">Inactivos / archivados</h2>
                <Badge tone="gray">{inactive.length}</Badge>
              </div>
              <p className="mb-2 text-xs font-semibold text-cocoa-soft">
                No aparecen en nuevas ventas ni compras, pero su historial se conserva.
              </p>
              <ul className="grid grid-cols-2 gap-3 opacity-80 sm:grid-cols-3 lg:grid-cols-4">
                {inactive.map(renderFlavor)}
              </ul>
            </section>
          )}
        </div>
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

      {/* Modal ajustar stock: ExitModal preselecciona el sabor y el
          tipo ADJUSTMENT (motivo obligatorio, movimiento firmado). */}
      <ExitModal
        open={Boolean(adjustFlavor)}
        onClose={() => setAdjustFlavor(null)}
        inventory={inventory ?? []}
        presetFlavorId={adjustFlavor?.id}
        presetMovementType="ADJUSTMENT"
        onSaved={reloadInventory}
      />

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

      {/* Modal confirmar eliminar */}
      <Modal
        open={Boolean(deleteModal)}
        onClose={() => setDeleteModal(null)}
        title="Eliminar sabor"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setDeleteModal(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => deleteModal && handleDeleteFlavor(deleteModal)}
              disabled={deleting}
            >
              {deleting ? "Eliminando…" : "Eliminar"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-cocoa">
          {deleteModal?.active
            ? `¿Eliminar "${deleteModal?.name}"? Si conserva historial (ventas, compras o movimientos), se archivará para no romper los datos.`
            : `¿Eliminar "${deleteModal?.name}"? Es un sabor archivado; se borrará definitivamente.`}
        </p>
      </Modal>
    </div>
  );
}