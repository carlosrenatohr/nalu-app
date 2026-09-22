import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/utils";
import { AppLayout } from "./AppLayout";

// ---------------------------------------------------------------------
// Header global: acceso rápido a "Registrar compra" desde cualquier
// pantalla (antes solo estaba en el Dashboard).
// ---------------------------------------------------------------------

describe("AppLayout", () => {
  it("ofrece el registro rápido de compra en el header", async () => {
    renderWithProviders(<AppLayout />);
    const btn = screen.getByRole("button", { name: "Registrar compra" });
    expect(btn).toBeInTheDocument();
    await userEvent.click(btn); // no debe lanzar
  });

  it("muestra la navegación principal en móvil y escritorio", () => {
    renderWithProviders(<AppLayout />);
    expect(screen.getAllByRole("navigation").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole("link", { name: /inicio/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /ventas/i }).length).toBeGreaterThan(0);
  });
});
