import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { listPending } from "@/lib/offline/outbox";
import { revertPendingOp } from "@/lib/offline/revert";
import { syncEngine } from "@/lib/offline/syncEngine";
import type { OutboxOp } from "@/lib/offline/db";

// ---------------------------------------------------------------------
// Detalle de los cambios pendientes de sincronización. Muestra QUÉ hay
// en cola (por tipo), su estado, el error si falló, y permite descartar
// (revertir) una operación que aún no se haya sincronizado.
// ---------------------------------------------------------------------

const TYPE_LABELS: Record<OutboxOp["type"], string> = {
  sale: "Venta",
  purchase: "Compra",
  movement: "Movimiento",
  flavor: "Sabor",
  supplier: "Proveedor",
};

const TYPE_EMOJI: Record<OutboxOp["type"], string> = {
  sale: "🛒",
  purchase: "📦",
  movement: "⚖️",
  flavor: "🍦",
  supplier: "🚚",
};

function describe(op: OutboxOp): string {
  const p = op.payload as Record<string, unknown>;
  switch (op.type) {
    case "sale":
      return `Venta en ${p.location ?? "…"} · ${((p.items as unknown[]) ?? []).length} sabor(es)`;
    case "purchase":
      return `Compra · ${((p.items as unknown[]) ?? []).length} sabor(es)`;
    case "movement":
      return `Movimiento ${p.movementType ?? ""} ×${p.quantity ?? 0}`;
    case "flavor":
      return `Sabor "${p.name ?? ""}"`;
    case "supplier":
      return `Proveedor "${p.name ?? ""}"`;
  }
}

export function PendingChangesModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [ops, setOps] = useState<OutboxOp[]>([]);
  const [reverting, setReverting] = useState<string | null>(null);
  const [syncingNow, setSyncingNow] = useState(false);

  async function refresh() {
    setOps(await listPending());
  }

  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  async function handleRevert(op: OutboxOp) {
    setReverting(op.opId);
    try {
      await revertPendingOp(op.opId);
      toast("Cambio descartado");
      await refresh();
      await syncEngine.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo descartar el cambio", "error");
    } finally {
      setReverting(null);
    }
  }

  async function handleSyncNow() {
    setSyncingNow(true);
    try {
      await syncEngine.sync();
      await refresh();
    } finally {
      setSyncingNow(false);
    }
  }

  const counts = new Map<string, number>();
  for (const op of ops) counts.set(op.type, (counts.get(op.type) ?? 0) + 1);
  const summary = Array.from(counts.entries())
    .map(([type, n]) => `${n} ${TYPE_LABELS[type as OutboxOp["type"]].toLowerCase()}${n > 1 ? "s" : ""}`)
    .join(", ");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cambios pendientes"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cerrar
          </Button>
          <Button className="flex-1" onClick={handleSyncNow} disabled={syncingNow || ops.length === 0}>
            {syncingNow ? "Sincronizando…" : "Sincronizar ahora"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {ops.length > 0 ? (
          <>
            <p className="text-sm font-semibold text-cocoa-soft">
              {ops.length} {ops.length === 1 ? "cambio" : "cambios"} pendientes
              {summary ? `: ${summary}` : ""}
            </p>
            <ul className="space-y-2">
              {ops.map((op) => (
                <li
                  key={op.opId}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-cream p-3 ring-1 ring-cocoa/5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-2xl" aria-hidden="true">
                      {TYPE_EMOJI[op.type]}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-extrabold text-cocoa">{TYPE_LABELS[op.type]}</p>
                        <Badge tone={op.status === "failed" ? "red" : "yellow"}>
                          {op.status === "failed" ? "fallida" : "pendiente"}
                        </Badge>
                      </div>
                      <p className="truncate text-xs font-semibold text-cocoa-soft">
                        {describe(op)}
                      </p>
                      {op.status === "failed" && op.lastError ? (
                        <p className="mt-0.5 text-xs font-bold text-strawberry">{op.lastError}</p>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleRevert(op)}
                    disabled={reverting === op.opId}
                  >
                    {reverting === op.opId ? "…" : "Descartar"}
                  </Button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <EmptyState
            emoji="✅"
            title="Sin cambios pendientes"
            description="Todo lo que registraste ya está sincronizado."
          />
        )}
      </div>
    </Modal>
  );
}