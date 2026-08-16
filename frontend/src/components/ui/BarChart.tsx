import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------
// Gráfica de barras horizontal sencilla (sin librerías de charts).
// ---------------------------------------------------------------------

export interface BarDatum {
  label: string;
  value: number;
  hint?: string;
  color?: string;
}

export function BarChart({
  data,
  color = "var(--color-turquoise)",
  valueFormatter = (v: number) => String(v),
}: {
  data: BarDatum[];
  color?: string;
  valueFormatter?: (value: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return null;

  return (
    <ul className="space-y-3" aria-label="Gráfica de barras">
      {data.map((d) => (
        <li key={d.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="font-bold text-cocoa">{d.label}</span>
            <span className="font-extrabold text-cocoa-soft">
              {valueFormatter(d.value)}
              {d.hint ? <span className="ml-1 font-medium text-cocoa-soft/60">{d.hint}</span> : null}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-cocoa/6" role="img" aria-label={`${d.label}: ${valueFormatter(d.value)}`}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(d.value / max) * 100}%`,
                backgroundColor: d.color ?? color,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-cocoa-soft">
      <span className={cn("h-2.5 w-2.5 rounded-full")} style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
