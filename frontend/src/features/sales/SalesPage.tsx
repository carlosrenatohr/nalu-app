import { useState } from "react";
import { useNavigate } from "react-router";
import { useAsync } from "@/hooks/useAsync";
import { useBusiness } from "@/hooks/useBusiness";
import { salesApi } from "@/services/api";
import { formatMoney, localToday, addDays, startOfWeek, startOfMonth, formatRelativeDay } from "@/lib/formatting/currency";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageLoader } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconCart, IconPlus, IconEdit, IconTrash } from "@/components/ui/icons";
import { cn } from "@/lib/utils/cn";
import { EditSaleModal } from "./EditSaleModal";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import type { Sale } from "@/types";

type Range = "today" | "yesterday" | "7days" | "week" | "month" | "prev" | "all" | "custom";

const RANGES: { value: Range; label: string; emoji?: string }[] = [
  { value: "today", label: "Hoy", emoji: "📅" },
  { value: "yesterday", label: "Ayer" },
  { value: "7days", label: "7 días" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "prev", label: "Anterior" },
  { value: "all", label: "Todos" },
  { value: "custom", label: "Personalizado" },
];

export function SalesPage() {
  const navigate = useNavigate();
  const { currency } = useBusiness();
  const today = localToday();
  const [range, setRange] = useState<Range>("today");
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);

  let from: string | undefined;
  let to: string | undefined;

  switch (range) {
    case "today":
      from = today;
      to = today;
      break;
    case "yesterday":
      from = addDays(today, -1);
      to = addDays(today, -1);
      break;
    case "7days":
      from = addDays(today, -6);
      to = today;
      break;
    case "week":
      from = startOfWeek(today);
      to = today;
      break;
    case "month":
      from = startOfMonth(today);
      to = today;
      break;
    case "prev":
      from = undefined;
      to = addDays(startOfMonth(today), -1);
      break;
    case "all":
      from = undefined;
      to = undefined;
      break;
    case "custom":
      from = customFrom;
      to = customTo;
      break;
  }

  const { data: sales, loading, error, reload } = useAsync(
    () => salesApi.list(from, to),
    [from, to],
  );

  const total = (sales ?? []).reduce((acc, s) => acc + s.total, 0);

  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [deletingSale, setDeletingSale] = useState<Sale | null>(null);

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
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar ventas">
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
            {r.emoji ? `${r.emoji} ` : ""}{r.label}
          </button>
        ))}
      </div>

      {/* Selector de rango personalizado */}
      {range === "custom" && (
        <div className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-cocoa/10">
          <label className="flex items-center gap-2">
            <span className="text-xs font-bold text-cocoa-soft">Desde</span>
            <input
              type="date"
              value={customFrom}
              max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="min-h-10 rounded-xl bg-cream px-3 text-sm font-bold text-cocoa ring-1 ring-cocoa/10 focus:ring-2 focus:ring-turquoise focus:outline-none"
            />
          </label>
          <span className="text-sm font-bold text-cocoa-soft">al</span>
          <label className="flex items-center gap-2">
            <span className="text-xs font-bold text-cocoa-soft">Hasta</span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              max={today}
              onChange={(e) => setCustomTo(e.target.value)}
              className="min-h-10 rounded-xl bg-cream px-3 text-sm font-bold text-cocoa ring-1 ring-cocoa/10 focus:ring-2 focus:ring-turquoise focus:outline-none"
            />
          </label>
        </div>
      )}

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
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-lg font-black text-cocoa">{formatMoney(sale.total, currency)}</p>
                      <Badge tone="green">+{formatMoney(sale.profit ?? 0, currency)}</Badge>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingSale(sale)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-cocoa-soft hover:bg-turquoise/10 hover:text-turquoise-deep"
                        aria-label="Editar venta"
                      >
                        <IconEdit className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingSale(sale)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-cocoa-soft hover:bg-strawberry/10 hover:text-strawberry"
                        aria-label="Eliminar venta"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </div>
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

      {/* Modal editar venta */}
      <EditSaleModal
        key={editingSale?.id ?? "new"}
        open={Boolean(editingSale)}
        sale={editingSale}
        onClose={() => setEditingSale(null)}
        onSaved={reload}
      />

      {/* Modal eliminar venta */}
      <ConfirmDeleteModal
        open={Boolean(deletingSale)}
        sale={deletingSale}
        onClose={() => setDeletingSale(null)}
        onDeleted={reload}
      />
    </div>
  );
}
