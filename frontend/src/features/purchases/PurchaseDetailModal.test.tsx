import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/utils";
import { PurchaseDetailModal } from "./PurchaseDetailModal";
import type { Purchase } from "@/types";

// ---------------------------------------------------------------------
// Detalle de compra: desglose por línea con costo congelado (unitCost),
// total y notas, con acceso directo a editar.
// ---------------------------------------------------------------------

const purchase: Purchase = {
  id: "50000000-0000-4000-8000-000000000001",
  businessId: "biz-1",
  supplierId: "30000000-0000-4000-8000-000000000001",
  supplierName: "Distribuidora Tropical",
  purchaseDate: "2026-09-18",
  notes: "Entrega en la mañana",
  totalCost: 280,
  paymentType: "cash",
  items: [
    {
      id: "pi-1",
      purchaseId: "50000000-0000-4000-8000-000000000001",
      flavorId: "20000000-0000-4000-8000-000000000001",
      flavorName: "Coco",
      quantity: 10,
      unitCost: 28,
      subtotal: 280,
    },
  ],
  createdAt: "2026-09-18T10:00:00.000Z",
  updatedAt: "2026-09-18T10:00:00.000Z",
};

describe("PurchaseDetailModal", () => {
  it("muestra proveedor, líneas, total y notas", () => {
    renderWithProviders(
      <PurchaseDetailModal open purchase={purchase} onClose={vi.fn()} />,
    );
    expect(screen.getByText("Detalle de compra")).toBeInTheDocument();
    expect(screen.getByText("Distribuidora Tropical")).toBeInTheDocument();
    expect(screen.getByText("Coco")).toBeInTheDocument();
    // Desglose: 10 × costo unitario y el subtotal de la línea.
    expect(screen.getByText(/10 ×/)).toBeInTheDocument();
    expect(screen.getByText("10 paletas")).toBeInTheDocument();
    expect(screen.getByText("Entrega en la mañana")).toBeInTheDocument();
  });

  it("cierra con 'Cerrar' y abre edición con 'Editar compra'", async () => {
    const onClose = vi.fn();
    const onEdit = vi.fn();
    renderWithProviders(
      <PurchaseDetailModal open purchase={purchase} onClose={onClose} onEdit={onEdit} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Editar compra" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    // La X del encabezado y el botón del pie comparten nombre: usamos el del pie.
    const closeButtons = screen.getAllByRole("button", { name: "Cerrar" });
    await userEvent.click(closeButtons[closeButtons.length - 1]!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("no renderiza nada sin compra seleccionada", () => {
    renderWithProviders(<PurchaseDetailModal open purchase={null} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Detalle de compra")).not.toBeInTheDocument();
  });
});
