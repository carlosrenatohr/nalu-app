import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------
// Selector de emojis organizado por categorías temáticas.
// Frutas 🍎, Chocolate 🍫, Dulces 🍬
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
];

interface EmojiPickerProps {
  value: string | null;
  onChange: (emoji: string) => void;
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
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
    </div>
  );
}
