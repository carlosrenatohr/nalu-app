import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";
import { cn } from "@/lib/utils/cn";

const fieldBase =
  "w-full min-h-11 rounded-2xl border-2 border-cocoa/10 bg-cream px-4 py-2.5 text-base text-cocoa placeholder:text-cocoa-soft/50 transition-colors focus:border-turquoise focus:outline-none";

function FieldShell({
  label,
  error,
  children,
}: {
  label?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      {label ? (
        <span className="mb-1.5 block text-sm font-bold text-cocoa-soft">{label}</span>
      ) : null}
      {children}
      {error ? (
        <span role="alert" className="mt-1 block text-sm font-medium text-strawberry">
          {error}
        </span>
      ) : null}
    </label>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <FieldShell label={label} error={error}>
      <input
        className={cn(fieldBase, error && "border-strawberry/60", className)}
        aria-invalid={error ? true : undefined}
        {...props}
      />
    </FieldShell>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  children: ReactNode;
}

export function Select({ label, error, className, children, ...props }: SelectProps) {
  return (
    <FieldShell label={label} error={error}>
      <select
        className={cn(fieldBase, "appearance-none", error && "border-strawberry/60", className)}
        aria-invalid={error ? true : undefined}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, ...props }: TextareaProps) {
  return (
    <FieldShell label={label} error={error}>
      <textarea className={cn(fieldBase, "min-h-24", className)} aria-invalid={error ? true : undefined} {...props} />
    </FieldShell>
  );
}
