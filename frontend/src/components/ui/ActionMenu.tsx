import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconMore } from "./icons";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------
// Menú de acciones (kebab) reutilizable. Evita llenar la interfaz con
// botones permanentes: agrupa acciones secundarias en un desplegable.
//
// El menú se porta al <body> y se posiciona con `fixed` (midiendo el
// botón) en vez de vivir como `absolute` dentro del ancestro. Motivo:
// dentro de SwipeRow el ancestro directo tiene `overflow-hidden` (recorta
// el desplegable) y `isolate` (la fila siguiente lo taparía). Ir al body
// escapa ambos problemas, igual que hace Modal.
// ---------------------------------------------------------------------

export interface ActionMenuItem {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  onClick: () => void;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  /** Etiqueta accesible del botón (qué registro abre el menú). */
  label: string;
}

/** Altura aprox. de un ítem (py-2.5 + text-sm) en px — para el flip vertical. */
const ITEM_HEIGHT = 41;
/** Padding vertical del menú (p-1.5) en px. */
const MENU_PADDING = 12;
/** Separación mínima respecto al borde de la ventana. */
const EDGE_GAP = 8;

export function ActionMenu({ items, label }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      // El menú ya no es descendiente del botón, así que comprobamos ambos.
      const inside =
        (containerRef.current?.contains(target) ?? false) ||
        (menuRef.current?.contains(target) ?? false);
      if (!inside) setOpen(false);
    };
    // Con `fixed` el menú se quedaría anclado a la ventana si la lista
    // rueda; cerrarlo evita un menú desprendido del botón.
    const onScroll = () => setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const toggle = () => {
    if (!open) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const menuHeight = items.length * ITEM_HEIGHT + MENU_PADDING;
        const spaceBelow = window.innerHeight - rect.bottom;
        // Si no cabe hacia abajo, se abre hacia arriba (clamp al borde superior).
        const flip = spaceBelow < menuHeight + EDGE_GAP;
        const top = flip
          ? Math.max(EDGE_GAP, rect.top - 4 - menuHeight)
          : rect.bottom + 4;
        setPos({ top, right: Math.max(EDGE_GAP, window.innerWidth - rect.right) });
      }
    }
    setOpen((v) => !v);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        className="flex h-11 w-11 items-center justify-center rounded-full text-cocoa-soft transition-colors hover:bg-cocoa/5"
      >
        <IconMore className="h-5 w-5" />
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{ top: pos.top, right: pos.right }}
              className="animate-pop fixed z-50 w-44 overflow-hidden rounded-2xl bg-white p-1.5 shadow-card ring-1 ring-cocoa/10"
            >
              {items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    item.onClick();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-colors",
                    item.danger
                      ? "text-strawberry hover:bg-strawberry/10"
                      : "text-cocoa hover:bg-cream",
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
