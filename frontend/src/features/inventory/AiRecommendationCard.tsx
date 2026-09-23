import { useRef, useState } from "react";
import { aiApi } from "@/services/api";
import { ApiClientError } from "@/services/api/client";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils/cn";
import type { InventoryRecommendation } from "@/types";

// ---------------------------------------------------------------------
// Recomendación IA de inventario (Jev / System One).
// Estados: idle → loading → success (o error). El selector de ventana
// (7/30/90 días) re-analiza al instante para poder JUGAR con Jev y ver
// cómo cambian sus probabilidades según los datos reales.
//
// La tarjeta se puede OCULTAR con un toggle (preferencia simple en
// localStorage): se colapsa con una transición suave a una barra
// mínima con el encabezado, y el contenido queda `inert` (fuera del
// árbol de accesibilidad y sin foco) hasta volver a mostrarlo. Así,
// aunque el proveedor de IA falle, Nalu sigue operable sin estorbos.
// ---------------------------------------------------------------------

type Status = "idle" | "loading" | "success" | "error";

type ErrorInfo = { code: string | null; message: string | null };

const DAY_OPTIONS = [7, 30, 90] as const;

const BAR_COLORS = ["bg-turquoise", "bg-strawberry", "bg-mango", "bg-kiwi", "bg-grape", "bg-orange"];

const PRIORITY = {
  high: { label: "Alta", emoji: "🔥", tone: "red" },
  medium: { label: "Media", emoji: "💪", tone: "yellow" },
  low: { label: "Baja", emoji: "🌱", tone: "green" },
} as const;

/** Preferencia simple de UI (localStorage): tarjeta visible u oculta. */
const VISIBILITY_KEY = "nalu.jev.recomendacion-visible";

function readVisibility(): boolean {
  try {
    return localStorage.getItem(VISIBILITY_KEY) !== "0";
  } catch {
    return true; // sin localStorage disponible: mostramos la tarjeta
  }
}

function persistVisibility(visible: boolean): void {
  try {
    localStorage.setItem(VISIBILITY_KEY, visible ? "1" : "0");
  } catch {
    // Modo privado / cuota llena: la preferencia solo dura la sesión.
  }
}

// Mensaje amigable POR CÓDIGO de error: nunca mostramos un estado vacío.
// El detalle del servidor se muestra aparte, entre comillas.
const ERROR_COPY: Record<string, { title: string; hint: string }> = {
  AI_RATE_LIMIT: {
    title: "Jev está saturado 💤",
    hint: "Hay muchas consultas al modelo ahora mismo. Espera un minuto y vuelve a intentarlo.",
  },
  AI_TIMEOUT: {
    title: "Jev tardó demasiado 🐢",
    hint: "El modelo no respondió a tiempo. Intenta nuevamente.",
  },
  AI_UNAVAILABLE: {
    title: "Jev no está disponible 🌧️",
    hint: "El servicio de IA no respondió. Intenta de nuevo en un momento.",
  },
  AI_NOT_CONFIGURED: {
    title: "La IA no está configurada 🛠️",
    hint: "Este servidor no tiene la clave de Jev. Revisa la configuración del despliegue.",
  },
  AI_INVALID_RESPONSE: {
    title: "Jev respondió algo raro 🤔",
    hint: "No se pudo interpretar su respuesta. Intenta nuevamente.",
  },
};

const DEFAULT_ERROR_COPY = {
  title: "No fue posible obtener la recomendación.",
  hint: "Revisa tu conexión e intenta nuevamente.",
};

export function AiRecommendationCard() {
  const [status, setStatus] = useState<Status>("idle");
  const [days, setDays] = useState<number>(30);
  const [recommendation, setRecommendation] = useState<InventoryRecommendation | null>(null);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [visible, setVisible] = useState<boolean>(readVisibility);
  // Descarta respuestas obsoletas si el usuario juega rápido con los días.
  const requestId = useRef(0);

  const analyze = async (windowDays: number): Promise<void> => {
    const id = ++requestId.current;
    setStatus("loading");
    setError(null);
    try {
      const result = await aiApi.inventoryRecommendation(windowDays);
      if (id !== requestId.current) return;
      setRecommendation(result);
      setStatus("success");
    } catch (err) {
      if (id !== requestId.current) return;
      setError(
        err instanceof ApiClientError ? { code: err.code, message: err.message } : null,
      );
      setStatus("error");
    }
  };

  const selectDays = (next: number): void => {
    setDays(next);
    // Con un resultado en pantalla, cambiar la ventana re-analiza ya.
    if (status === "success") void analyze(next);
  };

  const toggleVisibility = (): void => {
    const next = !visible;
    setVisible(next);
    persistVisibility(next);
  };

  const busy = status === "loading";
  const pct = recommendation ? Math.round(recommendation.confidence * 100) : 0;
  const priority = recommendation?.priority ? PRIORITY[recommendation.priority] : null;
  const errorCopy = (error?.code ? ERROR_COPY[error.code] : undefined) ?? DEFAULT_ERROR_COPY;

  return (
    <Card className="animate-fade-up overflow-hidden bg-gradient-to-br from-lavender via-white to-mint">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-3xl" aria-hidden="true">
            ✨
          </span>
          <h2 className="text-lg font-extrabold text-cocoa">Recomendación IA</h2>
        </div>
        {/* Mostrar/ocultar la tarjeta con transición (preferencia persistida) */}
        <button
          type="button"
          onClick={toggleVisibility}
          aria-expanded={visible}
          aria-controls="cuerpo-recomendacion-ia"
          title={visible ? "Ocultar recomendación" : "Mostrar recomendación"}
          className="min-h-11 min-w-11 shrink-0 rounded-xl text-xl leading-none transition-all hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turquoise active:scale-95"
        >
          <span aria-hidden="true">{visible ? "🙈" : "👁️"}</span>
          <span className="sr-only">
            {visible ? "Ocultar recomendación de Jev" : "Mostrar recomendación de Jev"}
          </span>
        </button>
      </div>

      {/* Cuerpo plegable: grid-rows 1fr ↔ 0fr con opacidad (motion-safe). */}
      <div
        id="cuerpo-recomendacion-ia"
        inert={!visible}
        className={cn(
          "grid transition-[grid-template-rows] ease-out motion-safe:duration-500",
          visible ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div
          className={cn(
            "overflow-hidden motion-safe:transition-opacity motion-safe:duration-500",
            visible ? "opacity-100" : "opacity-0",
          )}
        >
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-cocoa-soft">
              Jev analiza tu inventario y ventas recientes
            </p>
            <Badge tone="purple">Jev · System One</Badge>
          </div>

          {/* Ventana de análisis: cambia los datos que ve Jev */}
          <div
            role="group"
            aria-label="Ventana de análisis"
            className="mt-3 flex gap-1 rounded-2xl bg-white/80 p-1 ring-1 ring-cocoa/5"
          >
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={days === d}
                disabled={busy}
                onClick={() => selectDays(d)}
                className={cn(
                  "min-h-9 flex-1 rounded-xl text-xs font-bold transition-all disabled:cursor-not-allowed disabled:opacity-60",
                  days === d
                    ? "bg-turquoise text-white shadow-pop"
                    : "text-cocoa-soft hover:bg-cocoa/5 active:scale-[0.97]",
                )}
              >
                {d} días
              </button>
            ))}
          </div>

          <div aria-live="polite" className="mt-4">
            {status === "idle" ? (
              <div>
                <p className="text-sm font-semibold text-cocoa-soft">
                  Analiza el inventario y las ventas recientes para descubrir qué sabor conviene
                  priorizar. 🍧
                </p>
                <Button className="mt-3 w-full" onClick={() => void analyze(days)} disabled={busy}>
                  ✨ Analizar inventario
                </Button>
              </div>
            ) : null}

            {status === "loading" ? (
              <div className="flex items-center gap-3 py-2">
                <Spinner />
                <p className="font-bold text-cocoa" role="status">
                  ✨ Analizando inventario…
                </p>
              </div>
            ) : null}

            {status === "error" ? (
              <div className="rounded-2xl bg-strawberry-soft/70 p-4 text-center">
                <p className="font-bold text-cocoa">{errorCopy.title}</p>
                <p className="text-sm font-semibold text-cocoa-soft">{errorCopy.hint}</p>
                {error?.message && error.message !== errorCopy.title ? (
                  <p className="mt-1 text-xs font-semibold text-cocoa-soft">
                    “{error.message}”
                  </p>
                ) : null}
                <Button variant="secondary" className="mt-3" onClick={() => void analyze(days)}>
                  🔄 Reintentar
                </Button>
              </div>
            ) : null}

            {status === "success" && recommendation ? (
              <div>
                {recommendation.insufficientData || !recommendation.flavor ? (
                  <div className="rounded-2xl bg-white/80 p-4 text-center ring-1 ring-cocoa/5">
                    <span className="text-3xl" aria-hidden="true">
                      🤔
                    </span>
                    <p className="font-bold text-cocoa">Aún no hay una recomendación clara</p>
                    <p className="text-sm font-semibold text-cocoa-soft">{recommendation.reason}</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 rounded-2xl bg-white/80 p-4 ring-1 ring-cocoa/5">
                      <span className="text-5xl" aria-hidden="true">
                        {recommendation.flavor.emoji}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[0.65rem] font-extrabold uppercase tracking-wider text-cocoa-soft">
                          Priorizar para la venta
                        </p>
                        <p className="truncate text-2xl font-black text-cocoa">
                          {recommendation.flavor.name}
                        </p>
                        {priority ? (
                          <Badge tone={priority.tone} className="mt-1">
                            Prioridad: {priority.emoji} {priority.label}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-cocoa">{recommendation.reason}</p>

                    {/* Confianza de Jev (System One la calcula siempre) */}
                    <div className="mt-3">
                      <div className="flex justify-between text-xs font-extrabold text-cocoa-soft">
                        <span>Confianza de Jev</span>
                        <span>{pct}%</span>
                      </div>
                      <div
                        className="mt-1 h-2.5 rounded-full bg-cocoa/10"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Confianza de Jev"
                      >
                        <div
                          className="h-2.5 rounded-full bg-gradient-to-r from-kiwi to-turquoise transition-all duration-700"
                          style={{ width: `${Math.max(2, pct)}%` }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* La jugada de Jev: distribución completa de probabilidades */}
                {recommendation.probabilities.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-[0.65rem] font-extrabold uppercase tracking-wider text-cocoa-soft">
                      Probabilidades de Jev
                    </p>
                    <ul className="mt-2 space-y-2">
                      {recommendation.probabilities.map((entry, i) => (
                        <li key={entry.id} className="flex items-center gap-2">
                          <span className="w-6 text-center text-lg" aria-hidden="true">
                            {entry.emoji}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex justify-between text-xs font-bold text-cocoa">
                              <span className="truncate">{entry.name}</span>
                              <span>{Math.round(entry.p * 100)}%</span>
                            </div>
                            <div className="mt-0.5 h-2 rounded-full bg-cocoa/10">
                              <div
                                className={cn(
                                  "h-2 rounded-full transition-all duration-700",
                                  BAR_COLORS[i % BAR_COLORS.length],
                                )}
                                style={{ width: `${Math.max(2, Math.round(entry.p * 100))}%` }}
                              />
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-cocoa-soft">
                    Últimos {recommendation.range.days} días · {recommendation.range.from} →{" "}
                    {recommendation.range.to}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void analyze(days)}
                    disabled={busy}
                  >
                    🔄 Analizar nuevamente
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}
