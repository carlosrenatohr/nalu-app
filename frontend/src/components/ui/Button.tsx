import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "mango";
type Size = "md" | "lg" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-br from-turquoise to-turquoise-deep text-white shadow-pop hover:brightness-105 active:scale-[0.98]",
  secondary:
    "bg-white text-turquoise-deep border-2 border-turquoise/40 hover:border-turquoise active:scale-[0.98]",
  ghost: "bg-transparent text-cocoa-soft hover:bg-cocoa/5 active:scale-[0.98]",
  danger:
    "bg-strawberry text-white shadow-[0_8px_20px_-6px_rgb(255_111_145/0.5)] hover:brightness-105 active:scale-[0.98]",
  mango:
    "bg-gradient-to-br from-mango to-orange text-cocoa shadow-[0_8px_20px_-6px_rgb(255_159_67/0.5)] hover:brightness-105 active:scale-[0.98]",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-2 text-sm rounded-xl",
  md: "px-5 py-3 text-base rounded-2xl",
  lg: "px-6 py-4 text-lg rounded-2xl",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
