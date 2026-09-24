import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/utils";
import { SaleDetailModal } from "./SaleDetailModal";
import type { Sale } from "@/types";

// ---------------------------------------------------------------------
// Detalle de venta: espejo del de compras — ubicación, fecha, pago,
// cada línea con cantidad × precio, subtotal, total, ganancia y notas,
// con acceso directo a editar.
// ---------------------------------------------------------------------

const sale: Sale = {
  id: "40000000-0000-4000-8000-000000000001",
  businessId: "biz-1",
  saleDate: "2026-09-22",
  location: "Casa",
  notes: "Cliente habitual",
  total: 120,
  paymentType: "cash",
  profit: 64,
  items: [
    {
      id: "si-1",
      saleId: "40000000-0000-4000-8000-000000000001",
      flavorId: "20000000-0000-4000-8000-000000000001",
      flavorName: "Coco",
      quantity: 2,
      unitPrice: 60,
      unitCostSnapshot: 28,
      subtotal: 120,
    },
  ],
  createdAt: "2026-09-22T10:00:00.000Z",
  updatedAt: "2026-09-22T10:00:00.000Z",
};

describe("SaleDetailModal", () => {
  it("muestra ubicación, líneas, unidades, ganancia y notas", () => {
    renderWithProviders(<SaleDetailModal open sale={sale} onClose={vi.fn()} />);
    expect(screen.getByText("Detalle de venta")).toBeInTheDocument();
    expect(screen.getByText("Casa")).toBeInTheDocument();
    expect(screen.getByText("Coco")).toBeInTheDocument();
    // Desglose: 2 × precio unitario de la línea.
    expect(screen.getByText(/2 ×/)).toBeInTheDocument();
    expect(screen.getByText("2 paletas")).toBeInTheDocument();
    expect(screen.getByText(/Ganancia/)).toBeInTheDocument();
    expect(screen.getByText("Cliente habitual")).toBeInTheDocument();
  });

  it("cierra con 'Cerrar' y abre edición con 'Editar venta'", async () => {
    const onClose = vi.fn();
    const onEdit = vi.fn();
    renderWithProviders(
      <SaleDetailModal open sale={sale} onClose={onClose} onEdit={onEdit} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Editar venta" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    // La X del encabezado y el botón del pie comparten nombre: usamos el del pie.
    const closeButtons = screen.getAllByRole("button", { name: "Cerrar" });
    await userEvent.click(closeButtons[closeButtons.length - 1]!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("no renderiza nada sin venta seleccionada", () => {
    renderWithProviders(<SaleDetailModal open sale={null} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Detalle de venta")).not.toBeInTheDocument();
  });
});
