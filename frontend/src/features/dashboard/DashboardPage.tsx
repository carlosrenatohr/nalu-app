import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAsync } from "@/hooks/useAsync";
import { useBusiness } from "@/hooks/useBusiness";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { inventoryApi, reportsApi, salesApi } from "@/services/api";
import { formatMoney, localToday, formatDateLong } from "@/lib/formatting/currency";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageLoader } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExitModal } from "@/features/inventory/ExitModal";
import { IconCart, IconPlus, IconGift, IconAlert } from "@/components/ui/icons";
import type { Sale } from "@/types";

export function DashboardPage() {
  const navigate = useNavigate();
  const { business, currency } = useBusiness();
  const sync = useSyncStatus();
  const [exitOpen, setExitOpen] = useState(false);

  const today = localToday();
  const report = useAsync(() => reportsApi.sales(today, today), [today]);
  const inventory = useAsync(() => inventoryApi.list(), []);
  const recentSales = useAsync(() => salesApi.list(today, today), [today]);

  const totalInventory = useMemo(
    () => inventory.data?.reduce((acc, i) => acc + i.available, 0) ?? 0,
    [inventory.data],
  );

  const lowStock = useMemo(
    () => (inventory.data ?? []).filter((i) => i.lowStock),
    [inventory.data],
  );

  const loading = report.loading || inventory.loading;

  return (
    <div className="animate-fade-up space-y-6">
      {/* Saludo */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-cocoa-soft">
            {formatDateLong(today)}
            {!sync.online ? " · Sin conexión" : ""}
          </p>
          <h1 className="text-3xl font-black tracking-tight text-cocoa">
            ¡Hola{business ? `, ${business.name.split(" ")[0]}` : ""}! ☀️
          </h1>
        </div>
        <span className="text-5xl" aria-hidden="true">🍧</span>
      </div>

      {/* Tarjetas de estadísticas */}
      {loading ? (
        <PageLoader label="Cargando tu día…" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              tone="turquoise"
              label="Ventas de hoy"
              value={formatMoney(report.data?.totalSales ?? 0, currency)}
              emoji="💰"
            />
            <StatCard
              tone="strawberry"
              label="Ganancia de hoy"
              value={formatMoney(report.data?.profit ?? 0, currency)}
              emoji="✨"
            />
            <StatCard
              tone="mango"
              label="Paletas vendidas"
              value={String(report.data?.unitsSold ?? 0)}
              emoji="🍦"
            />
            <StatCard
              tone="kiwi"
              label="Inventario"
              value={String(totalInventory)}
              emoji="📦"
            />
          </div>

          {/* Acciones rápidas */}
          <div className="grid grid-cols-3 gap-3">
            <Button
              size="lg"
              className="col-span-1 flex-col py-4 text-sm"
              onClick={() => navigate("/sales/new")}
            >
              <IconPlus className="h-6 w-6" />
              Registrar venta
            </Button>
            <Button
              size="lg"
              variant="mango"
              className="flex-col py-4 text-sm"
              onClick={() => navigate("/purchases/new")}
            >
              <IconCart className="h-6 w-6" />
              Registrar compra
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="flex-col py-4 text-sm"
              onClick={() => setExitOpen(true)}
            >
              <IconGift className="h-6 w-6" />
              Registrar salida
            </Button>
          </div>

          {/* Alertas de stock bajo */}
          {lowStock.length > 0 ? (
            <Card className="border-2 border-mango/40">
              <CardHeader
                title="¡Ojo con el inventario! 🍌"
                subtitle="Estos sabores están por debajo del stock mínimo"
              />
              <ul className="space-y-2">
                {lowStock.slice(0, 4).map((i) => (
                  <li key={i.flavor.id}>
                    <Link
                      to={`/inventory/${i.flavor.id}`}
                      className="flex items-center justify-between rounded-2xl bg-mango-soft/60 px-4 py-2.5 text-sm font-bold text-cocoa transition-colors hover:bg-mango-soft"
                    >
                      <span>
                        {i.flavor.emoji ?? ""} {i.flavor.name}
                      </span>
                      <span className="flex items-center gap-1.5">
                        {i.available} disponibles
                        <IconAlert className="h-4 w-4 text-orange" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {/* Ventas recientes de hoy */}
          <Card>
            <CardHeader
              title="Ventas de hoy"
              action={
                <Link to="/sales" className="text-sm font-bold text-turquoise-deep">
                  Ver todas →
                </Link>
              }
            />
            {recentSales.loading ? (
              <PageLoader />
            ) : recentSales.data && recentSales.data.length > 0 ? (
              <ul className="divide-y divide-cocoa/5">
                {recentSales.data.slice(0, 5).map((sale: Sale) => (
                  <li key={sale.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div>
                      <p className="font-bold text-cocoa">{sale.location}</p>
                      <p className="text-xs text-cocoa-soft">
                        {sale.items.map((i) => `${i.flavorName ?? "Sabor"} ×${i.quantity}`).join(" · ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-cocoa">{formatMoney(sale.total, currency)}</p>
                      <Badge tone="green">+{formatMoney(sale.profit ?? 0, currency)}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                emoji="🛒"
                title="Aún no hay ventas hoy"
                description="Cuando registres tu primera venta del día, aparecerá aquí."
                action={
                  <Button onClick={() => navigate("/sales/new")}>Registrar una venta</Button>
                }
              />
            )}
          </Card>

        </>
      )}

      <ExitModal
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        inventory={inventory.data ?? []}
        onSaved={() => {
          inventory.reload();
          report.reload();
        }}
      />
    </div>
  );
}
