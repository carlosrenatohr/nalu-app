import { Link, useNavigate } from "react-router";
import { useAsync } from "@/hooks/useAsync";
import { useBusiness } from "@/hooks/useBusiness";
import { inventoryApi } from "@/services/api";
import { formatMoney } from "@/lib/formatting/currency";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageLoader } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExitModal } from "./ExitModal";
import { IconGift, IconPlus } from "@/components/ui/icons";
import { useState } from "react";
import type { FlavorInventory } from "@/types";

// ---------------------------------------------------------------------
// Inventario visual: tarjetas de sabor (emoji, disponible, último
// costo, estado de stock). No es una hoja de cálculo.
// ---------------------------------------------------------------------

export function InventoryPage() {
  const navigate = useNavigate();
  const { currency } = useBusiness();
  const { data: inventory, loading, error, reload } = useAsync(() => inventoryApi.list(), []);
  const [exitOpen, setExitOpen] = useState(false);

  if (loading) return <PageLoader label="Cargando inventario…" />;

  return (
    <div className="animate-fade-up space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-cocoa">Inventario 🍧</h1>
          <p className="text-sm font-semibold text-cocoa-soft">
            {inventory
              ? `${inventory.reduce((acc, i) => acc + i.available, 0)} paletas disponibles`
              : ""}
          </p>
        </div>
        <Button variant="secondary" onClick={() => setExitOpen(true)}>
          <IconGift className="h-5 w-5" />
          <span className="hidden sm:inline">Registrar salida</span>
          <span className="sm:hidden">Salida</span>
        </Button>
      </div>

      {error ? (
        <EmptyState emoji="😅" title="No pudimos cargar el inventario" description={error} />
      ) : inventory && inventory.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {inventory.map((item: FlavorInventory) => {
            const color = item.flavor.color ?? "#F5E9D8";
            return (
              <li key={item.flavor.id}>
                <Link
                  to={`/inventory/${item.flavor.id}`}
                  className="group block h-full rounded-[1.25rem] p-4 transition-all hover:-translate-y-0.5 hover:shadow-card"
                  style={{
                    background: `linear-gradient(150deg, ${color} 0%, #FFFFFF 90%)`,
                  }}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-4xl transition-transform group-hover:scale-110" aria-hidden="true">
                      {item.flavor.emoji ?? "🍦"}
                    </span>
                    {item.lowStock ? <Badge tone="red">¡Pocas!</Badge> : null}
                  </div>
                  <p className="mt-2 font-extrabold text-cocoa">{item.flavor.name}</p>
                  <p className="text-3xl font-black text-cocoa">{item.available}</p>
                  <p className="text-xs font-semibold text-cocoa-soft">
                    {item.lastCost !== null ? `Último costo ${formatMoney(item.lastCost, currency)}` : "Sin compras"}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          emoji="🍧"
          title="Tu inventario está esperando su primera compra"
          description="Cuando registres una compra, los sabores aparecerán aquí con su disponibilidad."
          action={
            <Button variant="mango" onClick={() => navigate("/purchases/new")}>
              <IconPlus className="h-5 w-5" /> Registrar compra
            </Button>
          }
        />
      )}

      <ExitModal
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        inventory={inventory ?? []}
        onSaved={reload}
      />
    </div>
  );
}
