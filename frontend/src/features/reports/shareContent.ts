import QRCode from "qrcode";

// ---------------------------------------------------------------------
// Contenido de la ficha compartible (Top Sabores) de Reportes:
//  - Frases motivacionales: 24 empaquetadas en el bundle (cero storage,
//    cero APIs externas — presupuesto 0).
//  - Fondos coloridos: 8 combinaciones con los tokens Nalu (clases
//    Tailwind literales para que el escáner las incluya en el CSS).
//  - Rotación: índice en localStorage → frase y fondo distintos en cada
//    generación de imagen, sin repetir hasta cerrar el ciclo.
//  - % sobre las unidades vendidas del rango; QR client-side.
// ---------------------------------------------------------------------

/** Raíz de la plataforma: destino del QR de la ficha. */
export const PLATAFORMA_URL = "https://nalu-api.nativerse.workers.dev/";

export const FRASES_MOTIVACIONALES: readonly string[] = [
  "Cada paleta vendida es un paso más hacia tus sueños 🍦",
  "Tú puedes: hoy vendes, mañana facturas el doble ✨",
  "Los sueños se construyen paleta a paleta 💪",
  "El futuro se ve delicioso y está en tus manos 🌈",
  "Sigue así: el éxito sabe a mango con chile 🥭",
  "Pequeños pasos, grandes metas. ¡A darle! 🚀",
  "Tu esfuerzo de hoy es el negocio de tus sueños 🏆",
  "Nadie dijo fácil, pero tú eres imparable 🔥",
  "Cree en ti: eres más grande que cualquier obstáculo 🌟",
  "La constancia endulza cualquier día 💛",
  "Hoy un cliente, mañana un imperio 🏰",
  "Tu sonrisa vende más que cualquier cartel 😄",
  "Romper la barra es cuestión de intentarlo 💥",
  "El atrevimiento sabe delicioso 🍓",
  "Un negocio próspero empieza con un sueño y mucha acción 🎯",
  "Tú haces la diferencia en cada venta ✌️",
  "Los grandes logros empiezan con valentía 🦋",
  "Sigue empujando: la gloria está cerca 🏅",
  "Cada «no» te acerca a un «sí» enorme 🙌",
  "Tú eres el sabor que le falta al mundo 🌍🍦",
  "Trabaja hoy, descansa mañana, repite y brilla ✨",
  "Las metas se comen de a poquito… o de un bocado 🍨",
  "Eres capaz de lograr cosas increíbles 💫",
  "Sueña en grande y vende aún más grande 🎉",
];

/** Fondos: clases Tailwind literales (mismo template, fondo rotativo). */
export const FONDOS: readonly string[] = [
  "bg-gradient-to-br from-turquoise to-grape",
  "bg-gradient-to-br from-strawberry to-mango",
  "bg-gradient-to-br from-kiwi to-turquoise",
  "bg-gradient-to-br from-grape to-strawberry",
  "bg-gradient-to-br from-mango to-strawberry",
  "bg-gradient-to-br from-turquoise-deep to-kiwi",
  "bg-gradient-to-br from-grape to-turquoise",
  "bg-gradient-to-br from-strawberry to-grape",
];

export const INDICE_FRASE_KEY = "nalu.ficha.indice-frase";
export const INDICE_FONDO_KEY = "nalu.ficha.indice-fondo";

/** Índice rotativo actual (preferencia simple → localStorage permitido). */
export function currentRotation(storageKey: string, poolLength: number): number {
  if (poolLength <= 0) return 0;
  try {
    const raw = localStorage.getItem(storageKey);
    const n = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n % poolLength : 0;
  } catch {
    return 0; // sin localStorage (modo privado): empezamos por el primero
  }
}

/** Siguiente índice: avanza, persiste y cierra el ciclo (0, 1, …, n-1, 0). */
export function nextRotation(storageKey: string, poolLength: number): number {
  if (poolLength <= 0) return 0;
  try {
    const next = (currentRotation(storageKey, poolLength) + 1) % poolLength;
    localStorage.setItem(storageKey, String(next));
    return next;
  } catch {
    // Sin localStorage: al menos distinto a la generación anterior.
    return Math.floor(Math.random() * poolLength);
  }
}

export interface FlavorShare {
  flavorId: string;
  flavorName: string;
  units: number;
  /** Emoji del catálogo; null → la ficha pone el fallback 🍦. */
  emoji: string | null;
  /** % de unidades sobre el total del rango (redondeado). */
  pct: number;
}

export interface SharesResult {
  /** [1.º, 2.º, 3.º]; el podio se dibuja en orden 2-1-3. */
  podium: [FlavorShare | null, FlavorShare | null, FlavorShare | null];
  fourth: FlavorShare | null;
  fifth: FlavorShare | null;
  /** % de las unidades de los sabores que quedan fuera del top 5. */
  restPct: number;
  totalUnits: number;
}

/**
 * Calcula el podio, 4.º/5.º y el % del resto sobre las unidades vendidas.
 * Posiciones sin datos quedan en null (la ficha muestra 😞 «Sin datos»).
 * Regla pura y testeable: el servidor sigue siendo la fuente de verdad.
 */
export function computeShares(
  byFlavor: { flavorId: string; flavorName: string; units: number }[],
  emojiById: Record<string, string | null | undefined>,
): SharesResult {
  const total = byFlavor.reduce((acc, f) => acc + Math.max(0, f.units), 0);
  const pctOf = (units: number): number =>
    total > 0 ? Math.round((units / total) * 100) : 0;
  const toShare = (
    f?: { flavorId: string; flavorName: string; units: number },
  ): FlavorShare | null =>
    f
      ? {
          flavorId: f.flavorId,
          flavorName: f.flavorName,
          units: f.units,
          emoji: emojiById[f.flavorId] ?? null,
          pct: pctOf(f.units),
        }
      : null;

  const ordered = [...byFlavor].sort((a, b) => b.units - a.units);
  const top5Units = ordered.slice(0, 5).reduce((acc, f) => acc + Math.max(0, f.units), 0);

  return {
    podium: [toShare(ordered[0]), toShare(ordered[1]), toShare(ordered[2])],
    fourth: toShare(ordered[3]),
    fifth: toShare(ordered[4]),
    restPct: pctOf(Math.max(0, total - top5Units)),
    totalUnits: total,
  };
}

const QR_OPTS = {
  type: "svg" as const,
  margin: 1,
  width: 240,
  errorCorrectionLevel: "M" as const,
  color: { dark: "#4b3832", light: "#ffffff" },
};

/** SVG del QR generado en el cliente (sin servicios externos). */
export function generarQrSvg(url: string = PLATAFORMA_URL): Promise<string> {
  return QRCode.toString(url, QR_OPTS);
}
