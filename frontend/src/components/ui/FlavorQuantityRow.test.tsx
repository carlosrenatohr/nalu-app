import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FlavorQuantityRow } from "./FlavorQuantityRow";

// ---------------------------------------------------------------------
// Fila compartida de sabores: resalta la cantidad cuando pasa de 1 para
// que el operador note que está vendiendo más de una unidad.
// ---------------------------------------------------------------------

describe("FlavorQuantityRow", () => {
  it("muestra nombre, emoji y meta", () => {
    render(
      <FlavorQuantityRow id="1" name="Coco" emoji="🥥" meta="4 disponibles" quantity={0} onChange={() => {}} />,
    );
    expect(screen.getByText("Coco")).toBeInTheDocument();
    expect(screen.getByText("🥥")).toBeInTheDocument();
    expect(screen.getByText("4 disponibles")).toBeInTheDocument();
  });

  it("resalta la fila cuando la cantidad pasa de 1", () => {
    const { rerender } = render(
      <FlavorQuantityRow id="1" name="Coco" quantity={1} onChange={() => {}} />,
    );
    const row = screen.getByTestId("flavor-row-1");
    expect(row.className).toContain("ring-turquoise");
    expect(screen.queryByTestId("flavor-row-qty-1")).not.toBeInTheDocument();

    rerender(<FlavorQuantityRow id="1" name="Coco" quantity={3} onChange={() => {}} />);
    expect(row.className).toContain("ring-mango");
    expect(screen.getByTestId("flavor-row-qty-1")).toHaveTextContent("×3");
  });

  it("el stepper respeta el máximo (stock)", async () => {
    const onChange = vi.fn();
    render(<FlavorQuantityRow id="1" name="Coco" quantity={4} onChange={onChange} max={4} />);
    // Botón de incrementar (debe estar deshabilitado al llegar al máximo).
    const plus = screen.getByRole("button", { name: "Agregar uno" });
    expect(plus).toBeDisabled();
    // Bajar de a 1 llama onChange con 3.
    const minus = screen.getByRole("button", { name: "Quitar uno" });
    await userEvent.click(minus);
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("renderiza el contenido extra (costo unitario)", () => {
    render(
      <FlavorQuantityRow
        id="1"
        name="Coco"
        quantity={2}
        onChange={() => {}}
        trailing={<span data-testid="costo">C$28</span>}
      />,
    );
    expect(screen.getByTestId("costo")).toBeInTheDocument();
  });
});
