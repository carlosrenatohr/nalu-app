import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/utils";
import { EditSaleModal } from "./EditSaleModal";
import type { FlavorInventory, Sale } from "@/types";

// ---------------------------------------------------------------------
// Filtro «Solo incluidos» del formulario de edición de venta: idéntico
// al de compras — deja únicamente los sabores con cantidad > 0.
// ---------------------------------------------------------------------

const FRESA_ID = "20000000-0000-4000-8000-000000000001";
const MANGO_ID = "20000000-0000-4000-8000-000000000002";

function inv(id: string, name: string, available: number): FlavorInventory {
  return {
    flavor: {
      id,
      businessId: "biz-1",
      name,
      slug: name.toLowerCase(),
      emoji: "🍦",
      color: null,
      costPrice: null,
      salePrice: null,
      minStock: 2,
      active: true,
      createdAt: "",
      updatedAt: "",
    },
    available,
    lastCost: 28,
    purchased: 0,
    sold: 0,
    gifted: 0,
    personalUse: 0,
    lost: 0,
    adjusted: 0,
    returned: 0,
    value: 0,
    lowStock: false,
  };
}

const sale: Sale = {
  id: "40000000-0000-4000-8000-000000000001",
  businessId: "biz-1",
  saleDate: "2026-09-22",
  location: "Casa",
  notes: null,
  total: 120,
  paymentType: "cash",
  profit: 64,
  items: [
    {
      id: "si-1",
      saleId: "40000000-0000-4000-8000-000000000001",
      flavorId: FRESA_ID,
      flavorName: "Fresa",
      quantity: 2,
      unitPrice: 60,
      unitCostSnapshot: 28,
      subtotal: 120,
    },
  ],
  createdAt: "2026-09-22T10:00:00.000Z",
  updatedAt: "2026-09-22T10:00:00.000Z",
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
  inventoryApi: {
    list: vi.fn(async () => [
      inv(FRESA_ID, "Fresa", 10),
      inv(MANGO_ID, "Mango", 5),
    ]),
  },
  locationsApi: {
    list: vi.fn(async () => [{ id: "loc-1", name: "Casa" }]),
  },
  salesApi: {
    update: vi.fn(async (id: string) => ({ ...sale, id })),
  },
}));

describe("EditSaleModal — filtro «Solo incluidos»", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra todos los sabores seleccionables al abrir", async () => {
    renderWithProviders(
      <EditSaleModal open sale={sale} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    expect(await screen.findByText("Fresa")).toBeInTheDocument();
    expect(screen.getByText("Mango")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /solo incluidos/i }),
    ).not.toBeChecked();
  });

  it("con el filtro activo solo quedan los sabores ya incluidos", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <EditSaleModal open sale={sale} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    await screen.findByText("Fresa");

    await user.click(screen.getByRole("checkbox", { name: /solo incluidos/i }));

    expect(screen.getByRole("checkbox", { name: /solo incluidos/i })).toBeChecked();
    expect(screen.getByText("Fresa")).toBeInTheDocument();
    expect(screen.queryByText("Mango")).not.toBeInTheDocument();
  });

  it("al quitar la cantidad, el sabor desaparece del filtro de incluidos", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <EditSaleModal open sale={sale} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    await screen.findByText("Fresa");
    await user.click(screen.getByRole("checkbox", { name: /solo incluidos/i }));

    // Fresa pasa de 2 a 0 → sale de la lista de incluidos (queda vacía).
    const filaFresa = screen.getByTestId(`flavor-row-${FRESA_ID}`);
    const menos = within(filaFresa).getByRole("button", { name: "Quitar uno" });
    await user.click(menos);
    await user.click(menos);
    expect(screen.queryByText("Fresa")).not.toBeInTheDocument();
  });
});
