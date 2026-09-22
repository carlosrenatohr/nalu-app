import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------
// Campo de búsqueda reutilizable (uso principal: filtrar sabores).
// Un solo componente para no duplicar el mismo <input> en cada pantalla.
// El filtrado en sí se hace con lib/utils/search (matchesSearch).
// ---------------------------------------------------------------------

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Texto visible para lectores de pantalla. */
  label?: string;
  placeholder?: string;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  label = "Buscar sabor",
  placeholder = "Buscar sabor…",
  className,
}: SearchInputProps) {
  return (
    <label className={cn("block sm:max-w-xs", className)}>
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-11 w-full rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-cocoa ring-1 ring-cocoa/10 focus:ring-2 focus:ring-turquoise focus:outline-none"
      />
    </label>
  );
}
