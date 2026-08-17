import { NavLink, Outlet, useNavigate } from "react-router";
import { useBusiness } from "@/hooks/useBusiness";
import { SyncChip } from "./SyncChip";
import { IconPopsicle, IconHome, IconCart, IconBox, IconChart, IconMore } from "../ui/icons";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------
// Shell de la aplicación:
//  - Móvil: header + navegación inferior (Inicio, Ventas, Inventario,
//    Reportes, Más).
//  - Desktop: barra lateral con el mismo conjunto de secciones.
// No se duplica lógica de negocio: solo la presentación cambia.
// ---------------------------------------------------------------------

const NAV_ITEMS = [
  { to: "/", label: "Inicio", icon: IconHome, end: true },
  { to: "/sales", label: "Ventas", icon: IconCart },
  { to: "/inventory", label: "Inventario", icon: IconBox },
  { to: "/flavors", label: "Sabores", icon: IconPopsicle },
  { to: "/reports", label: "Reportes", icon: IconChart },
  { to: "/more", label: "Más", icon: IconMore },
];

function Logo({ name }: { name: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-turquoise to-turquoise-deep text-white shadow-pop">
        <IconPopsicle className="h-6 w-6" />
      </span>
      <span className="text-2xl font-black tracking-tight text-cocoa">{name}</span>
    </span>
  );
}

function SidebarNav() {
  const navigate = useNavigate();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 flex-col gap-2 border-r border-cocoa/5 bg-white/80 p-5 backdrop-blur lg:flex">
      <button type="button" onClick={() => navigate("/")} className="mb-6 flex justify-start">
        <Logo name="Nalu" />
      </button>
      <nav aria-label="Navegación principal" className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex min-h-11 items-center gap-3 rounded-2xl px-4 text-base font-bold transition-colors",
                isActive
                  ? "bg-turquoise/12 text-turquoise-deep"
                  : "text-cocoa-soft hover:bg-cocoa/5",
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto">
        <SyncChip />
      </div>
    </aside>
  );
}

function BottomNav() {
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-cocoa/5 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-between px-2 py-1.5">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex min-w-14 flex-col items-center gap-0.5 rounded-2xl px-2 py-1.5 text-[11px] font-bold transition-colors",
                isActive ? "text-turquoise-deep" : "text-cocoa-soft/70",
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    "flex h-9 w-14 items-center justify-center rounded-2xl transition-colors",
                    isActive && "bg-turquoise/12",
                  )}
                >
                  <item.icon className="h-5 w-5" />
                </span>
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function AppLayout() {
  const { business } = useBusiness();
  return (
    <div className="app-backdrop min-h-dvh">
      <div className="mx-auto flex max-w-7xl">
        <SidebarNav />
        <div className="min-w-0 flex-1">
          {/* Header móvil */}
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-cocoa/5 bg-cream/90 px-4 py-3 backdrop-blur lg:hidden">
            <button type="button" aria-label="Ir al inicio">
              <Logo name={business?.name ?? "Nalu"} />
            </button>
            <SyncChip />
          </header>

          <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4 lg:px-8 lg:pb-10 lg:pt-8">
            <Outlet />
          </main>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
