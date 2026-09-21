import { Button } from "./Button";

// ---------------------------------------------------------------------
// Aviso de borrador recuperado: permite continuar o descartar un draft
// guardado de un formulario de negocio abandonado a mitad de camino.
// ---------------------------------------------------------------------

export function DraftBanner({
  onContinue,
  onDiscard,
}: {
  onContinue: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-mango/15 p-3 ring-1 ring-mango/40">
      <div>
        <p className="text-sm font-extrabold text-cocoa">Tienes un borrador</p>
        <p className="text-xs font-semibold text-cocoa-soft">
          Continúa donde lo dejaste o descártalo.
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="secondary" onClick={onDiscard}>
          Descartar
        </Button>
        <Button size="sm" onClick={onContinue}>
          Continuar
        </Button>
      </div>
    </div>
  );
}