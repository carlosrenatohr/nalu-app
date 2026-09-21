import { cn } from "@/lib/utils/cn";
import type { PaymentType } from "@/types";

// ---------------------------------------------------------------------
// Selector de tipo de pago. Lista fija por ahora (efectivo, transferencia,
// tarjeta, otro) con emoji y color propio para hacerla intuitiva.
// ---------------------------------------------------------------------

export const PAYMENT_OPTIONS: {
  value: PaymentType;
  label: string;
  emoji: string;
  activeClass: string;
}[] = [
  { value: "cash", label: "Efectivo", emoji: "💵", activeClass: "border-kiwi bg-kiwi text-cocoa" },
  { value: "transfer", label: "Transferencia", emoji: "🏦", activeClass: "border-turquoise bg-turquoise text-white" },
  { value: "card", label: "Tarjeta", emoji: "💳", activeClass: "border-grape bg-grape text-white" },
  { value: "other", label: "Otro", emoji: "🧾", activeClass: "border-mango bg-mango text-cocoa" },
];

export function PaymentSelect({
  value,
  onChange,
}: {
  value: PaymentType;
  onChange: (value: PaymentType) => void;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-bold text-cocoa-soft">Tipo de pago</span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Tipo de pago">
        {PAYMENT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-2 py-2 text-sm font-bold transition-colors",
              value === opt.value ? opt.activeClass : "border-cocoa/10 bg-cream text-cocoa-soft",
            )}
          >
            <span className="text-xl" aria-hidden="true">
              {opt.emoji}
            </span>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}