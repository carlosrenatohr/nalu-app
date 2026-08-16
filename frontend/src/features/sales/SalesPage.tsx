import { useState } from "react";
import { useNavigate } from "react-router";
import { useAsync } from "@/hooks/useAsync";
import { useBusiness } from "@/hooks/useBusiness";
import { salesApi } from "@/services/api";
import { formatMoney, localToday, addDays, formatRelativeDay } from "@/lib/formatting/currency";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageLoader } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconCart, IconPlus } from "@/components/ui/icons";
import { cn } from "@/lib/utils/cn";
import type { Sale } from "@/types";

type Range = "today" | "week" | "all";

const RANGES: { value: Range; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "week", label: "7 días" },
  { value: "all", label: "Todo" },
];

export function SalesPage() {
  const navigate = useNavigate();
  const { currency } = useBusiness();
  const [range, setRange] = useState<Range>("today");

  const today = localToday();
  const from = range === "today" ? today : range === "week" ? addDays(today, -6) : undefined;
  const { data: sales, loading, error } = useAsync(
    () => salesApi.list(from, range === "all" ? undefined : today),
    [from, range],
  );

  const total = (sales ?? []).reduce((acc, s) => acc + s.total, 0);

  return (
    <div className="animate-fade-up space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-cocoa">Ventas 🍦</h1>
          <p className="text-sm font-semibold text-cocoa-soft">
            {sales ? `${sales.length} ventas · ${formatMoney(total, currency)}` : "Cargando…"}
          </p>
        </div>
        <Button onClick={() => navigate("/sales/new")}>
          <IconPlus className="h-5 w-5" />
          <span className="hidden sm:inline">Nueva venta</span>
          <span className="sm:hidden">Vender</span>
        </Button>
      </div>

      {/* Filtros por rango */}
      <div className="flex gap-2" role="tablist" aria-label="Filtrar ventas">
        {RANGES.map((r) => (
          <button
            key={r.value}
            role="tab"
            aria-selected={range === r.value}
            onClick={() => setRange(r.value)}
            className={cn(
              "min-h-10 rounded-full px-4 text-sm font-bold transition-colors",
              range === r.value
                ? "bg-turquoise text-white shadow-pop"
                : "bg-white text-cocoa-soft ring-1 ring-cocoa/10",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading ? (
        <PageLoader label="Cargando ventas…" />
      ) : error ? (
        <EmptyState emoji="😅" title="No pudimos cargar las ventas" description={error} />
      ) : sales && sales.length > 0 ? (
        <ul className="space-y-3">
          {sales.map((sale: Sale) => (
            <li key={sale.id}>
              <Card className="transition-shadow hover:shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-turquoise/12 text-turquoise-deep">
                      <IconCart className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-extrabold text-cocoa">
                        {sale.location ?? "Sin ubicación"}
                        <span className="ml-2 text-xs font-bold text-cocoa-soft">
                          {formatRelativeDay(sale.saleDate)}
                        </span>
                      </p>
                      <p className="line-clamp-1 text-xs text-cocoa-soft">
                        {sale.items
                          .map((i) => `${i.flavorName ?? "Sabor"} ×${i.quantity}`)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-cocoa">{formatMoney(sale.total, currency)}</p>
                    <Badge tone="green">+{formatMoney(sale.profit ?? 0, currency)}</Badge>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          emoji="🛒"
          title="No tienes ventas registradas todavía"
          description="Registra tu primera venta: elige el sabor, la cantidad y ¡listo!"
          action={
            <Button onClick={() => navigate("/sales/new")}>
              <IconPlus className="h-5 w-5" /> Registrar venta
            </Button>
          }
        />
      )}
    </div>
  );
}
