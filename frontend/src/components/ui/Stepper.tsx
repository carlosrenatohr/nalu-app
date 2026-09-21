import { useState } from "react";
import { IconMinus, IconPlus } from "./icons";

// ---------------------------------------------------------------------
// Stepper de cantidad: botones − / + y entrada manual editable.
// Escribir directamente el número (ej. "5") evita pulsar +1 varias veces.
// ---------------------------------------------------------------------

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
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? String(value);

  function commit(raw: string) {
    const n = parseInt(raw, 10);
    setDraft(null);
    if (Number.isNaN(n)) return;
    let v = n;
    if (max !== undefined) v = Math.min(max, v);
    v = Math.max(min, v);
    onChange(v);
  }

  const dec = () => {
    setDraft(null);
    onChange(Math.max(min, value - 1));
  };
  const inc = () => {
    setDraft(null);
    onChange(max !== undefined ? Math.min(max, value + 1) : value + 1);
  };

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
      <input
        value={display}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
        }}
        inputMode="numeric"
        aria-label="Cantidad"
        className="w-10 bg-transparent text-center text-lg font-extrabold text-cocoa focus:outline-none"
      />
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