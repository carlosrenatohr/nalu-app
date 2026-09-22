import { useEffect, useRef, useState, type MouseEvent, type ReactNode, type TouchEvent } from "react";

// ---------------------------------------------------------------------
// Fila con acciones por deslizar: arrastrar a la izquierda (táctil o
// ratón) revela Editar/Eliminar sin depender solo del menú kebab, y
// arrastrar a la derecha o pulsar Escape la vuelve a ocultar. Mientras
// están ocultas, las acciones quedan `inert` (fuera del foco y de los
// clics) para no romper la navegación por teclado.
// ---------------------------------------------------------------------

/** Px de arrastre mínimos para revelar u ocultar las acciones. */
const SWIPE_THRESHOLD = 40;

export interface SwipeRowProps {
  /** Descripción accesible de la fila (p. ej. "la compra de X"). */
  label: string;
  /** Contenido de la fila (debe tener fondo opaco para tapar las acciones). */
  children: ReactNode;
  /** Acciones que se revelan al deslizar (p. ej. Editar/Eliminar). */
  actions: ReactNode;
}

export function SwipeRow({ label, children, actions }: SwipeRowProps) {
  const [open, setOpen] = useState(false);
  const startX = useRef<number | null>(null);

  // Escape cierra las acciones (consistente con ActionMenu).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const begin = (x: number) => {
    startX.current = x;
  };
  const move = (x: number) => {
    if (startX.current === null) return;
    const dx = x - startX.current;
    if (dx <= -SWIPE_THRESHOLD) setOpen(true);
    else if (dx >= SWIPE_THRESHOLD) setOpen(false);
  };
  const end = () => {
    startX.current = null;
  };

  return (
    <li className="relative isolate overflow-hidden rounded-[1.25rem]" data-testid="swipe-row">
      {/* Acciones detrás de la fila: inert mientras están ocultas. */}
      <div
        data-testid="swipe-actions"
        aria-hidden={!open}
        inert={!open}
        onClick={() => setOpen(false)}
        className="absolute inset-y-0 right-0 flex w-32 items-center justify-center gap-1.5"
      >
        {actions}
      </div>

      {/* Contenido deslizable (Card con fondo opaco). */}
      <div
        data-testid="swipe-content"
        role="group"
        aria-label={label}
        className={`relative transition-transform duration-200${open ? " -translate-x-32" : ""}`}
        onTouchStart={(e: TouchEvent) => begin(e.touches[0]?.clientX ?? 0)}
        onTouchMove={(e: TouchEvent) => move(e.touches[0]?.clientX ?? 0)}
        onTouchEnd={end}
        onMouseDown={(e: MouseEvent) => begin(e.clientX)}
        onMouseMove={(e: MouseEvent) => {
          if (startX.current !== null) move(e.clientX);
        }}
        onMouseUp={end}
        onMouseLeave={end}
      >
        {children}
      </div>
    </li>
  );
}
