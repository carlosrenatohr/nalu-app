import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/utils";
import { PurchasesPage } from "./PurchasesPage";
import type { Purchase } from "@/types";

// ---------------------------------------------------------------------
// Lista de compras: tocar la fila abre el detalle (desglose por línea) y
// deslizar (o tocar el ícono «) revela Editar/Eliminar.
// ---------------------------------------------------------------------

const purchase: Purchase = {
  id: "50000000-0000-4000-8000-000000000001",
  businessId: "biz-1",
  supplierId: "30000000-0000-4000-8000-000000000001",
  supplierName: "Distribuidora Tropical",
  purchaseDate: "2026-09-18",
  notes: null,
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

vi.mock("@/services/api", () => ({
  businessApi: {
    get: vi.fn(async () => ({
      id: "biz-1",
      name: "Nalu",
      currency: "NIO",
      defaultPurchaseCost: 28,
      defaultHomePrice: 60,
      primaryColor: "#36C9C6",
      secondaryColor: "#FF6F91",
      contact: null,
      reportFooter: null,
      createdAt: "",
      updatedAt: "",
    })),
  },
  purchasesApi: {
    list: vi.fn(async () => [purchase]),
    update: vi.fn(async (id: string) => ({ ...purchase, id })),
    delete: vi.fn(async () => purchase),
    create: vi.fn(async (input: unknown) => ({ ...(input as object), id: "new" })),
  },
  // EditSaleModal/EditPurchaseModal cargan estas listas al montar.
  flavorsApi: {
    list: vi.fn(async () => []),
    create: vi.fn(async () => ({})),
  },
  suppliersApi: {
    list: vi.fn(async () => []),
    create: vi.fn(async () => ({})),
  },
  inventoryApi: {
    list: vi.fn(async () => []),
  },
  locationsApi: {
    list: vi.fn(async () => []),
  },
}));

describe("Compras (lista)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra cada compra con su total y acciones", async () => {
    renderWithProviders(<PurchasesPage />);
    expect(await screen.findByText("Distribuidora Tropical")).toBeInTheDocument();
    expect(screen.getByText("10 paletas")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Acciones de la compra de Distribuidora Tropical" }),
    ).toBeInTheDocument();
  });

  it("toca la fila → abre el detalle con el desglose", async () => {
    renderWithProviders(<PurchasesPage />);
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Ver detalle de la compra de Distribuidora Tropical",
      }),
    );

    expect(await screen.findByText("Detalle de compra")).toBeInTheDocument();
    expect(screen.getByText("Coco")).toBeInTheDocument();
    expect(screen.getByText(/10 ×/)).toBeInTheDocument();

    // La X del encabezado y el botón del pie comparten nombre: usamos el del pie.
    const closeButtons = screen.getAllByRole("button", { name: "Cerrar" });
    await userEvent.click(closeButtons[closeButtons.length - 1]!);
    await waitFor(() =>
      expect(screen.queryByText("Detalle de compra")).not.toBeInTheDocument(),
    );
  });

  it("deslizar a la izquierda revela Eliminar y abre la confirmación", async () => {
    renderWithProviders(<PurchasesPage />);
    await screen.findByText("Distribuidora Tropical");

    const content = screen.getByTestId("swipe-content");
    fireEvent.touchStart(content, { touches: [{ clientX: 200, clientY: 10 }] });
    fireEvent.touchMove(content, { touches: [{ clientX: 100, clientY: 10 }] });
    fireEvent.touchEnd(content);

    await userEvent.click(
      screen.getByRole("button", { name: "Eliminar compra de Distribuidora Tropical" }),
    );
    expect(await screen.findByText("Eliminar compra")).toBeInTheDocument();
  });
});
