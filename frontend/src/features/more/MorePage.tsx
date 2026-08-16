import { Link } from "react-router";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { syncEngine } from "@/lib/offline/syncEngine";
import { SyncChip } from "@/components/layout/SyncChip";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconStore, IconGear, IconCart, IconArrowRight, IconSync } from "@/components/ui/icons";

const LINKS = [
  {
    to: "/purchases",
    label: "Compras",
    description: "Registra y revisa tus compras",
    icon: IconCart,
    color: "bg-mango/25 text-[#8a6d00]",
  },
  {
    to: "/suppliers",
    label: "Proveedores",
    description: "Administra tus proveedores",
    icon: IconStore,
    color: "bg-grape/15 text-grape",
  },
  {
    to: "/settings",
    label: "Ajustes",
    description: "Tu negocio, precios y colores",
    icon: IconGear,
    color: "bg-turquoise/12 text-turquoise-deep",
  },
];

export function MorePage() {
  const sync = useSyncStatus();

  return (
    <div className="animate-fade-up space-y-5">
      <h1 className="text-2xl font-black text-cocoa">Más 🍍</h1>

      {/* Estado de sincronización */}
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-extrabold text-cocoa">Sincronización</p>
            <p className="text-sm text-cocoa-soft">
              {sync.lastSync
                ? `Última sincronización: ${new Date(sync.lastSync).toLocaleTimeString("es-NI", { hour: "2-digit", minute: "2-digit" })}`
                : "Tus cambios se sincronizan automáticamente"}
            </p>
            {sync.lastError ? (
              <Badge tone="red" className="mt-2">
                {sync.lastError}
              </Badge>
            ) : null}
          </div>
          <SyncChip />
        </div>
        <Button
          variant="secondary"
          className="mt-4 w-full"
          onClick={() => void syncEngine.sync()}
          disabled={sync.syncing || !sync.online}
        >
          <IconSync className="h-5 w-5" />
          Sincronizar ahora
        </Button>
      </Card>

      {/* Accesos */}
      <ul className="space-y-3">
        {LINKS.map((link) => (
          <li key={link.to}>
            <Link to={link.to}>
              <Card className="transition-shadow hover:shadow-card">
                <div className="flex items-center gap-3">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${link.color}`}>
                    <link.icon className="h-6 w-6" />
                  </span>
                  <div className="flex-1">
                    <p className="font-extrabold text-cocoa">{link.label}</p>
                    <p className="text-sm text-cocoa-soft">{link.description}</p>
                  </div>
                  <IconArrowRight className="h-5 w-5 text-cocoa-soft/50" />
                </div>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      <p className="pt-4 text-center text-xs font-semibold text-cocoa-soft/60">
        Nalu · Asistente de negocio para paletas artesanales 🍧
      </p>
    </div>
  );
}
