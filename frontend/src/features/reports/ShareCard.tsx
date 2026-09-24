import { formatDateLong } from "@/lib/formatting/currency";
import { cn } from "@/lib/utils/cn";
import type { FlavorShare, SharesResult } from "./shareContent";

// ---------------------------------------------------------------------
// Ficha compartible de Reportes (1080 × 1350, formato «ficha corta» 4:5):
//  - Podio olímpico 2-1-3 con el % colorido arriba de cada icono.
//  - Mini-lista con el 4.º y 5.º; última línea: «El resto: X %».
//  - Posiciones sin datos → cara triste 😞 (siempre el mismo template).
//  - QR client-side a la plataforma + frase motivacional rotativa.
// El nodo SIEMPRE se renderiza a tamaño fijo (la captura sale 1080×1350);
// la vista previa lo escala con transform desde ReportsPage.
// ---------------------------------------------------------------------

export const FICHA_WIDTH = 1080;
export const FICHA_HEIGHT = 1350;

interface Chip {
  readonly fondo: string;
  readonly texto: string;
  readonly anillo: string;
}

const CHIP_1: Chip = { fondo: "bg-strawberry", texto: "text-white", anillo: "ring-strawberry" };
const CHIP_2: Chip = { fondo: "bg-turquoise", texto: "text-white", anillo: "ring-turquoise" };
const CHIP_3: Chip = { fondo: "bg-grape", texto: "text-white", anillo: "ring-grape" };
const CHIP_4: Chip = { fondo: "bg-mango", texto: "text-cocoa", anillo: "ring-mango" };
const CHIP_5: Chip = { fondo: "bg-kiwi", texto: "text-white", anillo: "ring-kiwi" };

/** Sombra de texto para el contenido blanco sobre el fondo degradado. */
const SOMBRA_TXT = "[text-shadow:0_3px_0_rgba(75,56,50,0.35)]";

function PodioColumna({
  puesto,
  sabor,
  chip,
  altoPedestal,
}: {
  puesto: 1 | 2 | 3;
  sabor: FlavorShare | null;
  chip: Chip;
  altoPedestal: string;
}) {
  const medalla = puesto === 1 ? "🥇" : puesto === 2 ? "🥈" : "🥉";
  const vacio = sabor === null;
  return (
    <div className="flex w-[280px] flex-col items-center" data-testid={`podio-${puesto}`}>
      {/* % colorido arriba del icono */}
      <span
        className={cn(
          "mb-4 rounded-full px-6 py-2 text-3xl font-black shadow-soft",
          chip.fondo,
          chip.texto,
        )}
      >
        {vacio ? "—" : `${sabor.pct}%`}
      </span>

      {/* Icono del sabor (o cara triste si la posición está vacía) */}
      <div
        className={cn(
          "flex h-[190px] w-[190px] items-center justify-center rounded-full bg-white shadow-card ring-8",
          vacio ? "ring-cocoa/15" : chip.anillo,
        )}
      >
        <span className="text-[104px] leading-none" aria-hidden="true">
          {vacio ? "😞" : (sabor.emoji ?? "🍦")}
        </span>
      </div>

      <p
        className={cn(
          "mt-4 min-h-[64px] px-2 text-center text-2xl font-black leading-tight text-white",
          SOMBRA_TXT,
        )}
      >
        {vacio ? "Sin datos" : sabor.flavorName}
      </p>

      {/* Pedestal del podio */}
      <div
        className={cn(
          "flex w-full flex-col items-center justify-center rounded-t-3xl bg-white/95",
          altoPedestal,
        )}
      >
        <span className="text-4xl" aria-hidden="true">
          {medalla}
        </span>
        <span className="text-2xl font-black text-cocoa">{puesto}.º</span>
      </div>
    </div>
  );
}

function FilaPosicion({
  puesto,
  sabor,
  chip,
}: {
  puesto: 4 | 5;
  sabor: FlavorShare | null;
  chip: Chip;
}) {
  const vacio = sabor === null;
  return (
    <li
      className="flex items-center gap-4 rounded-2xl bg-white px-5 py-4 ring-1 ring-cocoa/5"
      data-testid={`puesto-${puesto}`}
    >
      <span className="w-12 text-2xl font-black text-cocoa-soft">{puesto}.º</span>
      <span className="text-3xl" aria-hidden="true">
        {vacio ? "😞" : (sabor.emoji ?? "🍦")}
      </span>
      <span className="flex-1 text-2xl font-extrabold text-cocoa">
        {vacio ? "Sin datos" : sabor.flavorName}
      </span>
      <span className={cn("rounded-full px-4 py-1 text-2xl font-black", chip.fondo, chip.texto)}>
        {vacio ? "—" : `${sabor.pct}%`}
      </span>
    </li>
  );
}

export function ShareCard({
  businessName,
  rangeFrom,
  rangeTo,
  shares,
  frase,
  fondoClases,
  qrSvg,
}: {
  businessName: string;
  rangeFrom: string;
  rangeTo: string;
  shares: SharesResult;
  frase: string;
  fondoClases: string;
  qrSvg: string | null;
}) {
  // podium viene [1.º, 2.º, 3.º]; en el DOM se dibuja en orden 2-1-3.
  const [primero, segundo, tercero] = shares.podium;

  return (
    <section
      data-testid="ficha-raiz"
      aria-label={`Ficha Top Sabores de ${businessName}`}
      className={cn("relative flex flex-col overflow-hidden bg-turquoise-deep p-14", fondoClases)}
      style={{ width: FICHA_WIDTH, height: FICHA_HEIGHT }}
    >
      {/* Decoración de fondo */}
      <div
        className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-white/15"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-24 h-[420px] w-[420px] rounded-full bg-white/10"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute right-12 top-52 rotate-12 text-8xl opacity-20"
        aria-hidden="true"
      >
        🍧
      </div>

      {/* Encabezado */}
      <header className="relative z-10 mb-8">
        <p className="text-sm font-black uppercase tracking-[0.35em] text-white/90">
          🏆 Top Sabores
        </p>
        <h2 className={cn("mt-2 text-6xl font-black leading-none text-white", SOMBRA_TXT)}>
          {businessName}
        </h2>
        <p className="mt-3 inline-block rounded-full bg-white/95 px-5 py-2 text-xl font-bold text-cocoa">
          {formatDateLong(rangeFrom)} — {formatDateLong(rangeTo)}
        </p>
      </header>

      {/* Podio olímpico 2-1-3 */}
      <div className="relative z-10 mb-8 flex items-end justify-center gap-6">
        <PodioColumna puesto={2} sabor={segundo} chip={CHIP_2} altoPedestal="h-[140px]" />
        <PodioColumna puesto={1} sabor={primero} chip={CHIP_1} altoPedestal="h-[190px]" />
        <PodioColumna puesto={3} sabor={tercero} chip={CHIP_3} altoPedestal="h-[110px]" />
      </div>

      {/* Posiciones 4 y 5 */}
      <ul className="relative z-10 mb-4 space-y-3 rounded-3xl bg-white/95 p-4 ring-1 ring-cocoa/5">
        <FilaPosicion puesto={4} sabor={shares.fourth} chip={CHIP_4} />
        <FilaPosicion puesto={5} sabor={shares.fifth} chip={CHIP_5} />
      </ul>

      {/* Última línea: % que representa «el resto» de los sabores */}
      <div className="relative z-10 mb-5 flex justify-center" data-testid="resto">
        <span className="rounded-full bg-cocoa px-6 py-3 text-2xl font-black text-white shadow-soft">
          El resto: {shares.restPct} %
        </span>
      </div>

      {/* Pie: QR a la plataforma + frase motivacional */}
      <footer className="relative z-10 mt-auto flex items-center gap-6">
        <div className="flex h-[170px] w-[170px] shrink-0 items-center justify-center rounded-3xl bg-white p-4 shadow-card">
          {qrSvg ? (
            <div
              role="img"
              aria-label="Código QR hacia la plataforma"
              className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          ) : (
            <span className="text-sm font-bold text-cocoa-soft">Generando QR…</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="rounded-2xl bg-white/95 px-5 py-3 text-2xl font-black italic leading-snug text-cocoa">
            «{frase}»
          </p>
          <div
            className={cn(
              "mt-3 flex items-center justify-between text-base font-bold text-white",
              SOMBRA_TXT,
            )}
          >
            <span>Escanea el QR para ver más en Nalu</span>
            <span>Hecho con Nalu 🍧</span>
          </div>
        </div>
      </footer>
    </section>
  );
}
