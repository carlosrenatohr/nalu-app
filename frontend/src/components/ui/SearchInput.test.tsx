import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchInput } from "./SearchInput";

// ---------------------------------------------------------------------
// El campo de búsqueda es controlado y notifica cada tecla para que la
// pantalla filtre en vivo.
// ---------------------------------------------------------------------

function Harness({ onType }: { onType?: (v: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <SearchInput
      value={value}
      onChange={(v) => {
        setValue(v);
        onType?.(v);
      }}
    />
  );
}

describe("SearchInput", () => {
  it("es accesible por su placeholder y tiene área táctil ≥ 44px", () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText("Buscar sabor…");
    expect(input).toBeInTheDocument();
    expect(input.className).toContain("min-h-11");
  });

  it("notifica cada tecla para filtrar en vivo", async () => {
    const onType = vi.fn();
    render(<Harness onType={onType} />);
    const input = screen.getByPlaceholderText("Buscar sabor…");
    await userEvent.type(input, "mango");
    expect(onType).toHaveBeenCalledTimes(5);
    expect(input).toHaveValue("mango");
  });

  it("permite un placeholder/label personalizado", () => {
    render(<SearchInput value="" onChange={() => {}} placeholder="Filtra…" label="Filtra sabores" />);
    expect(screen.getByPlaceholderText("Filtra…")).toBeInTheDocument();
    expect(screen.getByText("Filtra sabores")).toBeInTheDocument();
  });
});
