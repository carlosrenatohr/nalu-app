import { cn } from "@/lib/utils/cn";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={cn(
        "inline-block h-6 w-6 animate-spin rounded-full border-[3px] border-turquoise/25 border-t-turquoise",
        className,
      )}
    />
  );
}

export function PageLoader({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-cocoa-soft" role="status">
      <Spinner className="h-8 w-8" />
      <p className="text-sm font-semibold">{label}</p>
    </div>
  );
}
