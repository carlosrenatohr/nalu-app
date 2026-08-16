import { useMemo, useRef, useState } from "react";
import { useAsync } from "@/hooks/useAsync";
import { useBusiness } from "@/hooks/useBusiness";
import { reportsApi } from "@/services/api";
import {
  addDays,
  formatMoney,
  localToday,
  startOfMonth,
  startOfWeek,
  toISODate,
} from "@/lib/formatting/currency";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { BarChart } from "@/components/ui/BarChart";
import { PageLoader } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReportCard } from "./ReportCard";
import { exportReportImage, exportPurchasesPdf, exportSalesPdf } from "./exporters";
import { useToast } from "@/components/ui/Toast";
import { IconDownload, IconImage } from "@/components/ui/icons";
import { cn } from "@/lib/utils/cn";

type RangeKey = "today" | "yesterday" | "week" | "thisWeek" | "month" | "lastMonth" | "custom";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Hoy" },
  { key: "yesterday", label: "Ayer" },
  { key: "week", label: "7 días" },
  { key: "thisWeek", label: "Esta semana" },
  { key: "month", label: "Este mes" },
  { key: "lastMonth", label: "Mes anterior" },
];

function computeRange(key: RangeKey, today: string, customFrom: string, customTo: string) {
  switch (key) {
    case "today":
      return { from: today, to: today };
    case "yesterday":
      return { from: addDays(today, -1), to: addDays(today, -1) };
    case "week":
      return { from: addDays(today, -6), to: today };
    case "thisWeek":
      return { from: startOfWeek(today), to: today };
    case "month":
      return { from: startOfMonth(today), to: today };
    case "lastMonth": {
      const first = new Date(`${startOfMonth(today)}T00:00:00`);
      first.setDate(0); // último día del mes anterior
      const last = new Date(first);
      first.setDate(1);
      return { from: toISODate(first), to: toISODate(last) };
    }
    case "custom":
      return { from: customFrom || today, to: customTo || today };
  }
}

export function ReportsPage() {
  const { toast } = useToast();
  const { business, currency } = useBusiness();
  const [rangeKey, setRangeKey] = useState<RangeKey>("today");
  const [customFrom, setCustomFrom] = useState(localToday());
  const [customTo, setCustomTo] = useState(localToday());
  const reportCardRef = useRef<HTMLDivElement>(null);

  const today = localToday();
  const range = useMemo(
    () => computeRange(rangeKey, today, customFrom, customTo),
    [rangeKey, today, customFrom, customTo],
  );

  const sales = useAsync(() => reportsApi.sales(range.from, range.to), [range.from, range.to]);
  const purchases = useAsync(
    () => reportsApi.purchases(range.from, range.to),
    [range.from, range.to],
  );

  const report = sales.data;
  const isLoading = sales.loading;

  const flavorBars = useMemo(
    () =>
      (report?.byFlavor ?? []).slice(0, 6).map((f) => ({
        label: f.flavorName,
        value: f.units,
        hint: formatMoney(f.revenue, currency),
      })),
    [report, currency],
  );

  const locationBars = useMemo(
    () =>
      (report?.byLocation ?? []).map((l) => ({
        label: l.location ?? "Sin ubicación",
        value: l.units,
        hint: formatMoney(l.revenue, currency),
      })),
    [report, currency],
  );

  const priceBars = useMemo(
    () =>
      (report?.byPrice ?? []).map((p) => ({
        label: formatMoney(p.unitPrice, currency),
        value: p.units,
        hint: formatMoney(p.revenue - p.cost, currency),
      })),
    [report, currency],
  );

  async function handleImageExport() {
    if (!reportCardRef.current) return;
    try {
      await exportReportImage(reportCardRef.current, `reporte-nalu-${range.from}`);
      toast("Reporte listo para compartir");
    } catch {
      toast("No se pudo generar la imagen", "error");
    }
  }

  function handlePdfExport() {
    if (!report) return;
    try {
      exportSalesPdf(report, business?.name ?? "Nalu", currency);
      toast("PDF descargado");
    } catch {
      toast("No se pudo generar el PDF", "error");
    }
  }

  function handlePurchasesPdf() {
    if (!purchases.data) return;
    try {
      exportPurchasesPdf(purchases.data, business?.name ?? "Nalu", currency);
      toast("PDF de compras descargado");
    } catch {
      toast("No se pudo generar el PDF", "error");
    }
  }

  return (
    <div className="animate-fade-up space-y-5">
      <div>
        <h1 className="text-2xl font-black text-cocoa">Reportes 📊</h1>
        <p className="text-sm font-semibold text-cocoa-soft">Ventas, ganancias y más</p>
      </div>

      {/* Rango de fechas */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Rango del reporte">
        {RANGES.map((r) => (
          <button
            key={r.key}
            role="tab"
            aria-selected={rangeKey === r.key}
            onClick={() => setRangeKey(r.key)}
            className={cn(
              "min-h-10 rounded-full px-3.5 text-sm font-bold transition-colors",
              rangeKey === r.key
                ? "bg-grape text-white shadow-soft"
                : "bg-white text-cocoa-soft ring-1 ring-cocoa/10",
            )}
          >
            {r.label}
          </button>
        ))}
        <button
          role="tab"
          aria-selected={rangeKey === "custom"}
          onClick={() => setRangeKey("custom")}
          className={cn(
            "min-h-10 rounded-full px-3.5 text-sm font-bold transition-colors",
            rangeKey === "custom"
              ? "bg-grape text-white shadow-soft"
              : "bg-white text-cocoa-soft ring-1 ring-cocoa/10",
          )}
        >
          Personalizado
        </button>
      </div>

      {rangeKey === "custom" ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-cocoa-soft">Desde</span>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="min-h-11 w-full rounded-2xl border-2 border-cocoa/10 bg-white px-3 text-base text-cocoa focus:border-turquoise focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-cocoa-soft">Hasta</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="min-h-11 w-full rounded-2xl border-2 border-cocoa/10 bg-white px-3 text-base text-cocoa focus:border-turquoise focus:outline-none"
            />
          </label>
        </div>
      ) : null}

      {/* Botones de exportación */}
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={handlePdfExport} disabled={!report}>
          <IconDownload className="h-5 w-5" /> PDF
        </Button>
        <Button variant="secondary" className="flex-1" onClick={handleImageExport} disabled={!report}>
          <IconImage className="h-5 w-5" /> Imagen
        </Button>
        <Button variant="secondary" className="flex-1" onClick={handlePurchasesPdf} disabled={!purchases.data}>
          <IconDownload className="h-5 w-5" /> Compras PDF
        </Button>
      </div>

      {isLoading ? (
        <PageLoader label="Generando reporte…" />
      ) : report ? (
        <>
          {/* Estadísticas */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard tone="turquoise" label="Ventas" value={formatMoney(report.totalSales, currency)} emoji="💰" />
            <StatCard tone="strawberry" label="Ganancia" value={formatMoney(report.profit, currency)} emoji="✨" />
            <StatCard tone="mango" label="Paletas" value={String(report.unitsSold)} emoji="🍦" />
            <StatCard tone="grape" label="Margen" value={`${report.margin}%`} emoji="📈" />
            <StatCard tone="kiwi" label="Costo" value={formatMoney(report.totalCost, currency)} emoji="🧾" />
          </div>

          {/* Análisis */}
          <Card>
            <CardHeader title="Sabores más vendidos" subtitle="Por cantidad de paletas" />
            <BarChart data={flavorBars} valueFormatter={(v) => `${v} pal`} />
          </Card>

          <Card>
            <CardHeader title="Ventas por ubicación" subtitle="Casa, puesto y más" />
            <BarChart data={locationBars} color="var(--color-strawberry)" />
          </Card>

          <Card>
            <CardHeader title="Ventas por precio" subtitle="Qué precio rinde más" />
            <BarChart data={priceBars} color="var(--color-grape)" />
          </Card>

          {/* Análisis por proveedor */}
          <Card>
            <CardHeader title="Compras por proveedor" subtitle={`${purchases.data?.totalPurchases ?? 0} compras · ${formatMoney(purchases.data?.totalCost ?? 0, currency)}`} />
            {purchases.data && purchases.data.bySupplier.length > 0 ? (
              <ul className="space-y-2">
                {purchases.data.bySupplier.map((s) => (
                  <li
                    key={s.supplierId}
                    className="flex items-center justify-between rounded-2xl bg-cream px-4 py-3"
                  >
                    <div>
                      <p className="font-extrabold text-cocoa">{s.supplierName}</p>
                      <p className="text-xs font-semibold text-cocoa-soft">
                        {s.purchases} compras · {s.units} paletas
                      </p>
                    </div>
                    <p className="font-black text-cocoa">{formatMoney(s.totalCost, currency)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState emoji="📦" title="Sin compras en este período" description="No se registraron compras entre estas fechas." />
            )}
          </Card>

          {/* Reporte visual (exportable a imagen) */}
          <div ref={reportCardRef}>
            <ReportCard report={report} businessName={business?.name ?? "Nalu"} currency={currency} />
          </div>
        </>
      ) : (
        <EmptyState emoji="📊" title="No pudimos generar el reporte" description={sales.error ?? ""} />
      )}
    </div>
  );
}
