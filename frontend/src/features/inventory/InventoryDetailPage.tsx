import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useAsync } from "@/hooks/useAsync";
import { useBusiness } from "@/hooks/useBusiness";
import { inventoryApi } from "@/services/api";
import { formatMoney, formatDateShort } from "@/lib/formatting/currency";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageLoader } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExitModal } from "./ExitModal";
import { IconArrowLeft, IconGift } from "@/components/ui/icons";
import type { MovementType } from "@/types";

const MOVEMENT_LABELS: Record<MovementType, { label: string; tone: "green" | "red" | "gray" | "turquoise" }> = {
  PURCHASE: { label: "Compra", tone: "green" },
  SALE: { label: "Venta", tone: "turquoise" },
  GIFT: { label: "Regalo", tone: "gray" },
  PERSONAL_USE: { label: "Consumo propio", tone: "gray" },
  LOSS: { label: "Pérdida", tone: "red" },
  ADJUSTMENT: { label: "Ajuste", tone: "gray" },
  RETURN: { label: "Devolución", tone: "green" },
};

export function InventoryDetailPage() {
  const { flavorId = "" } = useParams();
  const navigate = useNavigate();
  const { currency } = useBusiness();
  const { data, loading, error, reload } = useAsync(
    () => inventoryApi.getByFlavor(flavorId),
    [flavorId],
  );
  const [exitOpen, setExitOpen] = useState(false);

  if (loading) return <PageLoader label="Cargando sabor…" />;

  if (!data) {
    return (
      <EmptyState
        emoji="🍦"
        title="No encontramos ese sabor"
        description={error ?? "Puede que haya sido desactivado."}
        action={<Button onClick={() => navigate("/inventory")}>Volver al inventario</Button>}
      />
    );
  }

  const { summary, movements } = data;
  const flavor = summary.flavor;

  const rows = [
    { label: "Compradas", value: summary.purchased, tone: "green" as const },
    { label: "Vendidas", value: summary.sold, tone: "turquoise" as const },
    { label: "Regaladas", value: summary.gifted, tone: "gray" as const },
    { label: "Consumo propio", value: summary.personalUse, tone: "gray" as const },
    { label: "Pérdidas", value: summary.lost, tone: "red" as const },
  ];

  return (
    <div className="animate-fade-up space-y-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Volver"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-cocoa ring-1 ring-cocoa/10"
        >
          <IconArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          <span className="text-5xl" aria-hidden="true">{flavor.emoji ?? "🍦"}</span>
          <div>
            <h1 className="text-2xl font-black text-cocoa">{flavor.name}</h1>
            {summary.lowStock ? <Badge tone="red">Stock bajo</Badge> : <Badge tone="green">Disponible</Badge>}
          </div>
        </div>
      </div>

      {/* Resumen principal */}
      <div className="rounded-[1.25rem] bg-gradient-to-br from-kiwi to-mint p-6 text-cocoa shadow-soft">
        <p className="text-sm font-bold text-cocoa/70">Disponible</p>
        <p className="text-5xl font-black">{summary.available}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm font-bold">
          <p>Último costo: {summary.lastCost !== null ? formatMoney(summary.lastCost, currency) : "—"}</p>
          <p>Valor estimado: {formatMoney(summary.value, currency)}</p>
        </div>
      </div>

      {/* Totales por tipo de movimiento */}
      <Card>
        <CardHeader title="Totales" subtitle="Suma de movimientos registrados" />
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {rows.map((r) => (
            <li key={r.label} className="rounded-2xl bg-cream px-4 py-3">
              <p className="text-xs font-bold text-cocoa-soft">{r.label}</p>
              <p className="text-2xl font-black text-cocoa">{r.value}</p>
            </li>
          ))}
        </ul>
      </Card>

      {/* Acciones de salida */}
      <div className="flex gap-3">
        <Button className="flex-1" onClick={() => setExitOpen(true)}>
          <IconGift className="h-5 w-5" /> Registrar salida
        </Button>
      </div>

      {/* Historial */}
      <Card>
        <CardHeader title="Historial de movimientos" subtitle="Todas las entradas y salidas de este sabor" />
        {movements.length > 0 ? (
          <ul className="divide-y divide-cocoa/5">
            {movements.map((m) => {
              const meta = MOVEMENT_LABELS[m.movementType];
              const isIn = m.quantity > 0;
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <p className="mt-0.5 text-xs font-semibold text-cocoa-soft">
                      {formatDateShort(m.date)}
                      {m.notes ? ` · ${m.notes}` : ""}
                    </p>
                  </div>
                  <span
                    className={`text-lg font-black ${isIn ? "text-[#3e7d1f]" : "text-strawberry"}`}
                  >
                    {isIn ? "+" : ""}
                    {m.quantity}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            emoji="📭"
            title="Sin movimientos todavía"
            description="Los movimientos de este sabor aparecerán aquí."
          />
        )}
      </Card>

      <ExitModal
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        inventory={[summary]}
        presetFlavorId={flavor.id}
        onSaved={reload}
      />
    </div>
  );
}
