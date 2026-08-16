import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type StatTone = "turquoise" | "strawberry" | "mango" | "kiwi" | "grape";

const tones: Record<StatTone, { bg: string; label: string }> = {
  turquoise: { bg: "bg-gradient-to-br from-turquoise to-turquoise-deep text-white", label: "text-white/80" },
  strawberry: { bg: "bg-gradient-to-br from-strawberry to-orange text-white", label: "text-white/85" },
  mango: { bg: "bg-gradient-to-br from-mango to-orange text-cocoa", label: "text-cocoa/70" },
  kiwi: { bg: "bg-gradient-to-br from-kiwi to-mint text-cocoa", label: "text-cocoa/70" },
  grape: { bg: "bg-gradient-to-br from-grape to-lavender text-white", label: "text-white/85" },
};

export function StatCard({
  tone = "turquoise",
  label,
  value,
  emoji,
  children,
  className,
}: {
  tone?: StatTone;
  label: string;
  value: string;
  emoji?: string;
  children?: ReactNode;
  className?: string;
}) {
  const t = tones[tone];
  return (
    <div className={cn("rounded-[1.25rem] p-5 shadow-soft", t.bg, className)}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-sm font-bold", t.label)}>{label}</span>
        {emoji ? <span className="text-2xl" aria-hidden="true">{emoji}</span> : null}
      </div>
      <p className="mt-1 text-3xl font-black tracking-tight">{value}</p>
      {children}
    </div>
  );
}
