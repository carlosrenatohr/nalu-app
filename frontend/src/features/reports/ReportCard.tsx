import { formatMoney, formatDateLong } from "@/lib/formatting/currency";
import type { SalesReport } from "@/types";

// ---------------------------------------------------------------------
// Tarjeta de reporte con el branding Nalu. Se muestra en pantalla y se
// exporta como imagen (WhatsApp). Diseñada para móvil: no parece una
// captura de pantalla, es un reporte gráfico propio.
// ---------------------------------------------------------------------

export function ReportCard({
  report,
  businessName,
  currency,
}: {
  report: SalesReport;
  businessName: string;
  currency: string;
}) {
  const topFlavors = report.byFlavor.slice(0, 5);
  const maxUnits = Math.max(1, ...topFlavors.map((f) => f.units));

  return (
    <div className="w-full overflow-hidden rounded-[1.75rem] bg-cream shadow-card ring-1 ring-cocoa/10">
      {/* Encabezado */}
      <div className="bg-gradient-to-r from-turquoise to-turquoise-deep px-6 py-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/80">Reporte de ventas</p>
            <h2 className="text-3xl font-black tracking-tight">{businessName}</h2>
          </div>
          <span className="text-4xl" aria-hidden="true">🍧</span>
        </div>
        <p className="mt-1 text-sm font-semibold text-white/90">
          {formatDateLong(report.range.from)} — {formatDateLong(report.range.to)}
        </p>
      </div>

      {/* Números grandes */}
      <div className="grid grid-cols-2 gap-3 px-6 py-5">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-cocoa/5">
          <p className="text-xs font-bold text-cocoa-soft">Ventas</p>
          <p className="text-2xl font-black text-turquoise-deep">{formatMoney(report.totalSales, currency)}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-cocoa/5">
          <p className="text-xs font-bold text-cocoa-soft">Ganancia</p>
          <p className="text-2xl font-black text-strawberry">+{formatMoney(report.profit, currency)}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-cocoa/5">
          <p className="text-xs font-bold text-cocoa-soft">Paletas vendidas</p>
          <p className="text-2xl font-black text-cocoa">{report.unitsSold}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-cocoa/5">
          <p className="text-xs font-bold text-cocoa-soft">Margen</p>
          <p className="text-2xl font-black text-grape">{report.margin}%</p>
        </div>
      </div>

      {/* Sabores más vendidos */}
      <div className="px-6 pb-2">
        <p className="mb-3 text-sm font-black uppercase tracking-wide text-cocoa-soft">
          Sabores más vendidos 🍦
        </p>
        {topFlavors.length === 0 ? (
          <p className="py-4 text-center text-sm font-semibold text-cocoa-soft">
            Sin ventas en este período
          </p>
        ) : (
          <ul className="space-y-2.5">
            {topFlavors.map((f, idx) => (
              <li key={f.flavorId} className="flex items-center gap-3">
                <span className="w-5 text-right text-sm font-black text-cocoa-soft">{idx + 1}.</span>
                <div className="flex-1">
                  <div className="mb-1 flex justify-between text-sm font-bold text-cocoa">
                    <span>{f.flavorName}</span>
                    <span>{f.units}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-cocoa/8">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-turquoise to-kiwi"
                      style={{ width: `${(f.units / maxUnits) * 100}%` }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pie */}
      <div className="mt-3 flex items-center justify-between border-t border-cocoa/10 px-6 py-3 text-xs font-bold text-cocoa-soft">
        <span>Hecho con Nalu 🍧</span>
        <span>Costos históricos incluidos</span>
      </div>
    </div>
  );
}
