import { useState } from "react";
import { useAsync } from "@/hooks/useAsync";
import { suppliersApi } from "@/services/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageLoader } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { IconPlus, IconStore, IconEdit, IconTrash } from "@/components/ui/icons";
import { SupplierModal } from "./SupplierModal";
import type { Supplier } from "@/types";

// ---------------------------------------------------------------------
// CRUD completo de proveedores: listar, crear, editar, desactivar y
// eliminar (borrado físico si sin compras, archivo si hay historial).
// ---------------------------------------------------------------------

export function SuppliersPage() {
  const { toast } = useToast();
  const { data: suppliers, loading, error, reload } = useAsync(() => suppliersApi.list(true), []);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [toggleModal, setToggleModal] = useState<Supplier | null>(null);
  const [deleteModal, setDeleteModal] = useState<Supplier | null>(null);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function handleCreate() {
    setEditingSupplier(null);
    setModalOpen(true);
  }

  function handleEdit(supplier: Supplier) {
    setEditingSupplier(supplier);
    setModalOpen(true);
  }

  async function handleToggleActive(supplier: Supplier) {
    setToggling(true);
    try {
      await suppliersApi.update(supplier.id, { active: !supplier.active });
      toast(supplier.active ? "Proveedor desactivado" : "Proveedor activado");
      setToggleModal(null);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo actualizar", "error");
    } finally {
      setToggling(false);
    }
  }

  async function handleDeleteSupplier(supplier: Supplier) {
    setDeleting(true);
    try {
      const result = await suppliersApi.delete(supplier.id);
      toast(
        result.archived
          ? `"${supplier.name}" archivado (conserva su historial)`
          : `"${supplier.name}" eliminado`,
      );
      setDeleteModal(null);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo eliminar el proveedor", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="animate-fade-up space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-cocoa">Proveedores 🏭</h1>
          <p className="text-sm font-semibold text-cocoa-soft">
            {suppliers ? `${suppliers.length} proveedores` : "Cargando…"}
          </p>
        </div>
        <Button onClick={handleCreate}>
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
              <Card className="transition-shadow hover:shadow-card">
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
                  <div className="flex items-center gap-1">
                    <ActionMenu
                      label={`Acciones de ${s.name}`}
                      items={[
                        {
                          label: "Editar",
                          icon: <IconEdit className="h-4 w-4" />,
                          onClick: () => handleEdit(s),
                        },
                        {
                          label: s.active ? "Desactivar" : "Activar",
                          onClick: () => setToggleModal(s),
                        },
                        {
                          label: "Eliminar",
                          icon: <IconTrash className="h-4 w-4" />,
                          danger: true,
                          onClick: () => setDeleteModal(s),
                        },
                      ]}
                    />
                  </div>
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
          action={<Button onClick={handleCreate}>Agregar proveedor</Button>}
        />
      )}

      {/* Modal crear/editar */}
      <SupplierModal
        key={editingSupplier?.id ?? "new"}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={reload}
        supplier={editingSupplier}
      />

      {/* Modal confirmar desactivar/activar */}
      <Modal
        open={Boolean(toggleModal)}
        onClose={() => setToggleModal(null)}
        title={toggleModal?.active ? "Desactivar proveedor" : "Activar proveedor"}
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
            ? `¿Desactivar "${toggleModal?.name}"? No aparecerá en las listas de compras.`
            : `¿Reactivar "${toggleModal?.name}"? Volverá a estar disponible.`}
        </p>
      </Modal>

      {/* Modal confirmar eliminar */}
      <Modal
        open={Boolean(deleteModal)}
        onClose={() => setDeleteModal(null)}
        title="Eliminar proveedor"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setDeleteModal(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => deleteModal && handleDeleteSupplier(deleteModal)}
              disabled={deleting}
            >
              {deleting ? "Eliminando…" : "Eliminar"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-cocoa">
          {deleteModal?.active
            ? `¿Eliminar "${deleteModal?.name}"? Si tiene compras registradas, se archivará para no romper el historial.`
            : `¿Eliminar "${deleteModal?.name}"? Es un proveedor archivado; se borrará definitivamente.`}
        </p>
      </Modal>
    </div>
  );
}
