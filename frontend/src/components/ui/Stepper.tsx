import { IconMinus, IconPlus } from "./icons";

export function Stepper({
  value,
  onChange,
  min = 0,
  max,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1);

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border-2 border-turquoise/25 bg-white p-1"
      role="group"
      aria-label="Cantidad"
    >
      <button
        type="button"
        onClick={dec}
        disabled={disabled || value <= min}
        aria-label="Quitar uno"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-cream text-turquoise-deep transition-colors hover:bg-turquoise/10 disabled:opacity-30"
      >
        <IconMinus className="h-4 w-4" />
      </button>
      <span className="w-8 text-center text-lg font-extrabold text-cocoa" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={inc}
        disabled={disabled || (max !== undefined && value >= max)}
        aria-label="Agregar uno"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-turquoise text-white transition-colors hover:bg-turquoise-deep disabled:opacity-30"
      >
        <IconPlus className="h-4 w-4" />
      </button>
    </div>
  );
}
