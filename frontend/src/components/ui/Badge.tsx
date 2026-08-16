import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type BadgeTone = "green" | "red" | "yellow" | "purple" | "pink" | "gray" | "turquoise";

const tones: Record<BadgeTone, string> = {
  green: "bg-mint text-[#3e7d1f]",
  red: "bg-strawberry-soft text-[#c2255c]",
  yellow: "bg-mango-soft text-[#8a6d00]",
  purple: "bg-lavender text-grape",
  pink: "bg-strawberry-soft text-strawberry",
  gray: "bg-cocoa/8 text-cocoa-soft",
  turquoise: "bg-turquoise/15 text-turquoise-deep",
};

export function Badge({
  tone = "gray",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
