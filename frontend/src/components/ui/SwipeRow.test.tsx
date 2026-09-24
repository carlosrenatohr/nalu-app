import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SwipeHint, SwipeRow } from "./SwipeRow";

// ---------------------------------------------------------------------
// Fila deslizable: el gesto (táctil o ratón) revela las acciones, que
// quedan inert mientras están ocultas para no interferir con teclado.
// SwipeHint (ícono «) reemplaza al kebab: enseña el affordance de
// deslizar y abre/cierra las acciones al tocarlo, así la fila es
// usable también con teclado o ratón sin arrastrar.
// ---------------------------------------------------------------------

function renderRow(onEdit = vi.fn(), onDelete = vi.fn()) {
  render(
    <ul>
      <SwipeRow
        label="Compra de Tropical"
        actions={
          <>
            <button type="button" onClick={onEdit}>
              Editar
            </button>
            <button type="button" onClick={onDelete}>
              Eliminar
            </button>
          </>
        }
      >
        <div>Tropical · C$2240</div>
        <SwipeHint label="Acciones de Tropical" />
      </SwipeRow>
    </ul>,
  );
  return { onEdit, onDelete };
}

/** Desliza el contenido de la fila (inicio → movimiento → fin). */
function swipe(fromX: number, toX: number) {
  const content = screen.getByTestId("swipe-content");
  fireEvent.touchStart(content, { touches: [{ clientX: fromX, clientY: 10 }] });
  fireEvent.touchMove(content, { touches: [{ clientX: toX, clientY: 10 }] });
  fireEvent.touchEnd(content);
}

describe("SwipeRow", () => {
  it("muestra el contenido con las acciones ocultas (inert)", () => {
    renderRow();
    expect(screen.getByText("Tropical · C$2240")).toBeInTheDocument();
    const actions = screen.getByTestId("swipe-actions");
    expect(actions).toHaveAttribute("aria-hidden", "true");
    expect(actions).toHaveAttribute("inert");
  });

  it("revela las acciones al deslizar a la izquierda", () => {
    renderRow();
    swipe(200, 100);
    const actions = screen.getByTestId("swipe-actions");
    expect(actions).not.toHaveAttribute("aria-hidden", "true");
    expect(actions).not.toHaveAttribute("inert");
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
  });

  it("no revela las acciones si el arrastre es menor al umbral", () => {
    renderRow();
    swipe(200, 180);
    expect(screen.getByTestId("swipe-actions")).toHaveAttribute("aria-hidden", "true");
  });

  it("vuelve a ocultar las acciones al deslizar a la derecha", () => {
    renderRow();
    swipe(200, 100);
    swipe(50, 200);
    expect(screen.getByTestId("swipe-actions")).toHaveAttribute("aria-hidden", "true");
  });

  it("ejecuta la acción al tocarla y vuelve a ocultarlas", async () => {
    const { onEdit } = renderRow();
    swipe(200, 100);
    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByTestId("swipe-actions")).toHaveAttribute("aria-hidden", "true"),
    );
  });

  it("Escape cierra las acciones abiertas", () => {
    renderRow();
    swipe(200, 100);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByTestId("swipe-actions")).toHaveAttribute("aria-hidden", "true");
  });

  it("el ícono de acciones abre y cierra las acciones al tocarlo", async () => {
    renderRow();
    const hint = screen.getByRole("button", { name: "Acciones de Tropical" });
    const actions = screen.getByTestId("swipe-actions");
    expect(hint).toHaveAttribute("aria-expanded", "false");
    expect(hint).toHaveAttribute("aria-controls", actions.id);

    await userEvent.click(hint);
    expect(hint).toHaveAttribute("aria-expanded", "true");
    expect(actions).not.toHaveAttribute("aria-hidden", "true");
    expect(actions).not.toHaveAttribute("inert");

    await userEvent.click(hint);
    expect(hint).toHaveAttribute("aria-expanded", "false");
    expect(actions).toHaveAttribute("aria-hidden", "true");
    expect(actions).toHaveAttribute("inert");
  });
});
