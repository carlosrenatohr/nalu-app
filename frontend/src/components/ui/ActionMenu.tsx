import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconMore } from "./icons";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------
// Menú de acciones (kebab) reutilizable. Evita llenar la interfaz con
// botones permanentes: agrupa acciones secundarias en un desplegable.
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

export function ActionMenu({ items, label }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-cocoa-soft transition-colors hover:bg-cocoa/5"
      >
        <IconMore className="h-5 w-5" />
      </button>
      {open ? (
        <div
          role="menu"
          className="animate-pop absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-2xl bg-white p-1.5 shadow-card ring-1 ring-cocoa/10"
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
        </div>
      ) : null}
    </div>
  );
}