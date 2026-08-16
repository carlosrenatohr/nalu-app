import { useNavigate } from "react-router";
import { useAsync } from "@/hooks/useAsync";
import { useBusiness } from "@/hooks/useBusiness";
import { purchasesApi } from "@/services/api";
import { formatMoney, formatRelativeDay } from "@/lib/formatting/currency";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageLoader } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconPlus, IconStore } from "@/components/ui/icons";
import type { Purchase } from "@/types";

export function PurchasesPage() {
  const navigate = useNavigate();
  const { currency } = useBusiness();
  const { data: purchases, loading, error } = useAsync(() => purchasesApi.list(), []);

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
            <li key={purchase.id}>
              <Card>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mango/25 text-[#8a6d00]">
                      <IconStore className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-extrabold text-cocoa">
                        {purchase.supplierName ?? "Proveedor"}
                        <span className="ml-2 text-xs font-bold text-cocoa-soft">
                          {formatRelativeDay(purchase.purchaseDate)}
                        </span>
                      </p>
                      <p className="line-clamp-1 text-xs text-cocoa-soft">
                        {purchase.items
                          .map((i) => `${i.flavorName ?? "Sabor"} ×${i.quantity}`)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-cocoa">
                      {formatMoney(purchase.totalCost, currency)}
                    </p>
                    <p className="text-xs font-semibold text-cocoa-soft">
                      {purchase.items.reduce((acc, i) => acc + i.quantity, 0)} paletas
                    </p>
                  </div>
                </div>
              </Card>
            </li>
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
    </div>
  );
}
