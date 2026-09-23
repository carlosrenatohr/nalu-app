import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { renderWithProviders } from "@/test/utils";
import { AppLayout } from "./AppLayout";

// ---------------------------------------------------------------------
// Header global: acceso rápido a la VENTA rápida (1+ paletas) desde
// cualquier pantalla — el widget invoca la acción de venta, no la de
// compra (la compra se registra desde Inicio/Compras).
// ---------------------------------------------------------------------

describe("AppLayout", () => {
  it("ofrece el registro rápido de venta en el header y abre la venta rápida", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<p>Pantalla de inicio</p>} />
          <Route path="/sales/new" element={<p>Formulario de venta rápida</p>} />
        </Route>
      </Routes>,
    );

    const btn = screen.getByRole("button", { name: "Registrar venta" });
    expect(btn).toBeInTheDocument();
    await user.click(btn);
    expect(await screen.findByText("Formulario de venta rápida")).toBeInTheDocument();
  });

  it("muestra la navegación principal en móvil y escritorio", () => {
    renderWithProviders(<AppLayout />);
    expect(screen.getAllByRole("navigation").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole("link", { name: /inicio/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /ventas/i }).length).toBeGreaterThan(0);
  });
});
