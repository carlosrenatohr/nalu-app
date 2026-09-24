import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type TouchEvent,
} from "react";
import { cn } from "@/lib/utils/cn";
import { IconSwipeLeft } from "./icons";

// ---------------------------------------------------------------------
// Fila con acciones por deslizar: arrastrar a la izquierda (táctil o
// ratón) revela Editar/Eliminar sin depender del menú kebab. Mientras
// están ocultas, las acciones quedan `inert` (fuera del foco y de los
// clics) para no romper la navegación por teclado.
//
// SwipeHint (exportado aquí) es el ícono que reemplaza al kebab en filas
// deslizables: enseña el affordance de deslizar («) y, al tocarlo,
// abre/cierra las acciones — así la fila es accesible también con
// teclado o ratón, sin necesidad de arrastrar.
// ---------------------------------------------------------------------

/** Px de arrastre mínimos para revelar u ocultar las acciones. */
const SWIPE_THRESHOLD = 40;

interface SwipeRowContextValue {
  open: boolean;
  toggle: () => void;
  /** id de la zona de acciones (para aria-controls del SwipeHint). */
  actionsId: string;
}

const SwipeRowContext = createContext<SwipeRowContextValue | null>(null);

/** Estado de la fila; solo debe usarse dentro de <SwipeRow>. */
function useSwipeRowContext(): SwipeRowContextValue {
  const ctx = useContext(SwipeRowContext);
  if (!ctx) throw new Error("<SwipeHint> debe renderizarse dentro de <SwipeRow>");
  return ctx;
}

export interface SwipeRowProps {
  /** Descripción accesible de la fila (p. ej. "la compra de X"). */
  label: string;
  /** Contenido de la fila (debe tener fondo opaco para tapar las acciones). */
  children: ReactNode;
  /** Acciones que se revelan al deslizar (p. ej. Editar/Eliminar). */
  actions: ReactNode;
  /** Reserva más ancho para zonas de 3+ botones (p. ej. proveedores). */
  wide?: boolean;
}

export function SwipeRow({ label, children, actions, wide = false }: SwipeRowProps) {
  const [open, setOpen] = useState(false);
  const startX = useRef<number | null>(null);
  const actionsId = useId();

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
    <SwipeRowContext.Provider value={{ open, toggle: () => setOpen((v) => !v), actionsId }}>
      <li className="relative isolate overflow-hidden rounded-[1.25rem]" data-testid="swipe-row">
        {/* Contenido deslizable (Card con fondo opaco). Va primero en el
            DOM para que el tabulador recorra contenido → acciones. */}
        <div
          data-testid="swipe-content"
          role="group"
          aria-label={label}
          className={cn(
            "relative z-10 transition-transform duration-200",
            open && (wide ? "-translate-x-40" : "-translate-x-32"),
          )}
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
        {/* Acciones detrás de la fila: inert mientras están ocultas. */}
        <div
          id={actionsId}
          data-testid="swipe-actions"
          aria-hidden={!open}
          inert={!open}
          onClick={() => setOpen(false)}
          className={cn(
            "absolute inset-y-0 right-0 z-0 flex items-center justify-center gap-1.5",
            wide ? "w-40" : "w-32",
          )}
        >
          {actions}
        </div>
      </li>
    </SwipeRowContext.Provider>
  );
}

/**
 * Ícono que reemplaza al menú kebab en filas deslizables: muestra el
 * affordance de deslizar («) y, al tocarlo, abre/cierra las acciones.
 */
export function SwipeHint({ label }: { label: string }) {
  const { open, toggle, actionsId } = useSwipeRowContext();
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={open}
      aria-controls={actionsId}
      title="Desliza o toca para ver las acciones"
      onClick={toggle}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-cocoa-soft transition-colors hover:bg-cocoa/5"
    >
      <IconSwipeLeft
        className={cn(
          "h-5 w-5 transition-transform motion-reduce:transition-none",
          open && "rotate-180",
        )}
      />
    </button>
  );
}
