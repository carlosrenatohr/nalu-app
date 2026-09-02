import { useState } from "react";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------
// Selector de emojis organizado por categorías temáticas.
// Frutas, Chocolate, Dulces, Bebidas + entrada libre para emojis/ASCII.
// ---------------------------------------------------------------------

const EMOJI_CATEGORIES = [
  {
    label: "Frutas",
    emoji: "🍎",
    items: [
      "🍓", "🍒", "🥭", "🍑", "🍊", "🍋", "🍇", "🍉",
      "🍌", "🍈", "🥝", "🫐", "🍎", "🍍", "🥥", "🌴",
    ],
  },
  {
    label: "Chocolate",
    emoji: "🍫",
    items: [
      "🍫", "🍪", "🥜", "🌰", "☕", "🧃", "🧁", "🍰",
    ],
  },
  {
    label: "Dulces",
    emoji: "🍬",
    items: [
      "🍬", "🍭", "🍩", "🎂", "🍡", "🍥", "🧇", "🍨",
    ],
  },
  {
    label: "Bebidas",
    emoji: "🥤",
    items: [
      "🥤", "🧋", "🥛", "🍵", "🧊", "🫧", "🍶", "🍺",
    ],
  },
];

interface EmojiPickerProps {
  value: string | null;
  onChange: (emoji: string) => void;
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [customInput, setCustomInput] = useState("");

  function handleCustomSubmit() {
    const trimmed = customInput.trim();
    if (trimmed.length > 0 && trimmed.length <= 8) {
      onChange(trimmed);
      setCustomInput("");
    }
  }

  return (
    <div className="space-y-3">
      {EMOJI_CATEGORIES.map((cat) => (
        <div key={cat.label}>
          <span className="mb-1.5 block text-xs font-bold text-cocoa-soft">
            {cat.emoji} {cat.label}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {cat.items.map((emoji, i) => (
              <button
                key={`${cat.label}-${i}`}
                type="button"
                onClick={() => onChange(emoji)}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl text-xl transition-all",
                  value === emoji
                    ? "scale-110 bg-turquoise/15 ring-2 ring-turquoise shadow-soft"
                    : "bg-cream hover:bg-cocoa/5",
                )}
                aria-label={`Seleccionar ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Entrada libre para emojis, ASCII o dígitos */}
      <div>
        <span className="mb-1.5 block text-xs font-bold text-cocoa-soft">
          ✏️ Personalizado
        </span>
        <div className="flex gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value.slice(0, 8))}
            onKeyDown={(e) => e.key === "Enter" && handleCustomSubmit()}
            placeholder="Escribe un emoji o texto…"
            maxLength={8}
            className="flex-1 rounded-xl bg-cream px-3 py-2 text-sm font-semibold text-cocoa ring-1 ring-cocoa/10 focus:ring-2 focus:ring-turquoise focus:outline-none"
          />
          <button
            type="button"
            onClick={handleCustomSubmit}
            disabled={!customInput.trim()}
            className="rounded-xl bg-turquoise px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-turquoise-deep disabled:opacity-40"
          >
            Usar
          </button>
        </div>
      </div>
    </div>
  );
}
