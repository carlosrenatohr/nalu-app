import type { ReactNode } from "react";
import { Stepper } from "./Stepper";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------
// Fila compacta de sabor con stepper: una sola implementación para
// venta nueva, venta editada, compra nueva y compra editada.
// - qty > 0 → anillo turquesa (seleccionado).
// - qty > 1 → anillo mango + badge ×N (evita doble-tap accidental).
// ---------------------------------------------------------------------

export interface FlavorQuantityRowProps {
  /** id para React key (se usa como key del <li>). */
  id: string;
  name: string;
  emoji?: string | null;
  /** Info secundaria bajo el nombre (p. ej. "4 disponibles"). */
  meta?: ReactNode;
  quantity: number;
  onChange: (quantity: number) => void;
  /** Máximo permitido (stock). Si no se pasa, sin límite (compras). */
  max?: number;
  /** Contenido extra al lado del stepper (p. ej. costo unitario). */
  trailing?: ReactNode;
}

export function FlavorQuantityRow({
  id,
  name,
  emoji,
  meta,
  quantity,
  onChange,
  max,
  trailing,
}: FlavorQuantityRowProps) {
  const selected = quantity > 0;
  const aboveOne = quantity > 1;

  return (
    <li
      data-testid={`flavor-row-${id}`}
      className={cn(
        "flex items-center justify-between gap-2 rounded-[1.25rem] bg-white p-3 ring-1 transition-all",
        aboveOne
          ? "ring-mango shadow-soft"
          : selected
            ? "ring-turquoise shadow-soft"
            : "ring-cocoa/5",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-3xl" aria-hidden="true">
          {emoji ?? "🍦"}
        </span>
        <div className="min-w-0">
          <p className="truncate font-extrabold text-cocoa">{name}</p>
          {meta ? (
            <p className="text-xs font-semibold text-cocoa-soft">{meta}</p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {trailing}
        {aboveOne ? (
          <span
            data-testid={`flavor-row-qty-${id}`}
            className="rounded-full bg-mango px-2 py-0.5 text-xs font-extrabold text-cocoa"
          >
            ×{quantity}
          </span>
        ) : null}
        <Stepper value={quantity} onChange={onChange} max={max} />
      </div>
    </li>
  );
}
