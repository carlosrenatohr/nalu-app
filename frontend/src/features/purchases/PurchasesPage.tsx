import { useState } from "react";
import { useNavigate } from "react-router";
import { useAsync } from "@/hooks/useAsync";
import { useBusiness } from "@/hooks/useBusiness";
import { purchasesApi } from "@/services/api";
import { formatMoney, formatRelativeDay } from "@/lib/formatting/currency";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageLoader } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { SwipeHint, SwipeRow } from "@/components/ui/SwipeRow";
import { IconEdit, IconPlus, IconStore, IconTrash } from "@/components/ui/icons";
import { EditPurchaseModal } from "./EditPurchaseModal";
import { ConfirmDeletePurchaseModal } from "./ConfirmDeletePurchaseModal";
import { PurchaseDetailModal } from "./PurchaseDetailModal";
import type { Purchase } from "@/types";

// ---------------------------------------------------------------------
// Lista de compras: tocar la fila abre el detalle (desglose) y el ícono
// « (o deslizar la fila a la izquierda) permite editar/eliminar.
// ---------------------------------------------------------------------

export function PurchasesPage() {
  const navigate = useNavigate();
  const { currency } = useBusiness();
  const { data: purchases, loading, error, reload } = useAsync(() => purchasesApi.list(), []);
  const [editing, setEditing] = useState<Purchase | null>(null);
  const [deleting, setDeleting] = useState<Purchase | null>(null);
  const [detail, setDetail] = useState<Purchase | null>(null);

  return (
    <div className="animate-fade-up space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-cocoa">Compras 📦</h1>
          <p className="text-sm font-semibold text-cocoa-soft">
            {purchases ? `${purchases.length} compras registradas` : "Cargando…"}
          </p>
        </div>
        <Button variant="mango" onClick={() => navigate("/purchases/new")}>
          <IconPlus className="h-5 w-5" />
          <span className="hidden sm:inline">Nueva compra</span>
          <span className="sm:hidden">Comprar</span>
        </Button>
      </div>

      {loading ? (
        <PageLoader label="Cargando compras…" />
      ) : error ? (
        <EmptyState emoji="😅" title="No pudimos cargar las compras" description={error} />
      ) : purchases && purchases.length > 0 ? (
        <ul className="space-y-3">
          {purchases.map((purchase: Purchase) => (
            <SwipeRow
              key={purchase.id}
              label={`Compra de ${purchase.supplierName ?? "proveedor"}`}
              actions={
                <>
                  <button
                    type="button"
                    aria-label={`Editar compra de ${purchase.supplierName ?? "proveedor"}`}
                    onClick={() => setEditing(purchase)}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-turquoise text-white shadow-pop transition-transform active:scale-95"
                  >
                    <IconEdit className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Eliminar compra de ${purchase.supplierName ?? "proveedor"}`}
                    onClick={() => setDeleting(purchase)}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-strawberry text-white shadow-pop transition-transform active:scale-95"
                  >
                    <IconTrash className="h-5 w-5" />
                  </button>
                </>
              }
            >
              <Card>
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setDetail(purchase)}
                    aria-label={`Ver detalle de la compra de ${purchase.supplierName ?? "proveedor"}`}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-mango/25 text-[#8a6d00]">
                        <IconStore className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-extrabold text-cocoa">
                          {purchase.supplierName ?? "Proveedor"}
                          <span className="ml-2 text-xs font-bold text-cocoa-soft">
                            {formatRelativeDay(purchase.purchaseDate)}
                          </span>
                        </span>
                        <span className="block line-clamp-1 text-xs text-cocoa-soft">
                          {purchase.items
                            .map((i) => `${i.flavorName ?? "Sabor"} ×${i.quantity}`)
                            .join(" · ")}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-lg font-black text-cocoa">
                        {formatMoney(purchase.totalCost, currency)}
                      </span>
                      <span className="block text-xs font-semibold text-cocoa-soft">
                        {purchase.items.reduce((acc, i) => acc + i.quantity, 0)} paletas
                      </span>
                    </span>
                  </button>
                  <SwipeHint
                    label={`Acciones de la compra de ${purchase.supplierName ?? "este proveedor"}`}
                  />
                </div>
              </Card>
            </SwipeRow>
          ))}
        </ul>
      ) : (
        <EmptyState
          emoji="📦"
          title="No tienes compras registradas"
          description="Registra tu primera compra para llenar el inventario."
          action={
            <Button variant="mango" onClick={() => navigate("/purchases/new")}>
              <IconPlus className="h-5 w-5" /> Registrar compra
            </Button>
          }
        />
      )}

      <EditPurchaseModal
        open={Boolean(editing)}
        purchase={editing}
        onClose={() => setEditing(null)}
        onSaved={reload}
      />
      <ConfirmDeletePurchaseModal
        open={Boolean(deleting)}
        purchase={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={reload}
      />

      {/* Detalle de la compra (desglose por línea) */}
      <PurchaseDetailModal
        open={Boolean(detail)}
        purchase={detail}
        onClose={() => setDetail(null)}
        onEdit={() => {
          setEditing(detail);
          setDetail(null);
        }}
      />
    </div>
  );
}
