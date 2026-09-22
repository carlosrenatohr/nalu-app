import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/utils";
import { NewPurchasePage } from "./NewPurchasePage";

// ---------------------------------------------------------------------
// Nueva compra: lista de sabores y alta rápida de un sabor con el
// MISMO FlavorModal de la página de Sabores (sin duplicar el formulario).
// ---------------------------------------------------------------------

const flavor = {
  id: "20000000-0000-4000-8000-000000000001",
  businessId: "biz-1",
  name: "Coco",
  slug: "coco",
  emoji: "🥥",
  color: "#F5E9D8",
  costPrice: 28,
  salePrice: 60,
  minStock: 10,
  active: true,
  createdAt: "",
  updatedAt: "",
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
  flavorsApi: {
    list: vi.fn(async () => [flavor]),
    create: vi.fn(async (input: unknown) => ({ ...flavor, ...(input as object) })),
  },
  suppliersApi: {
    list: vi.fn(async () => []),
    create: vi.fn(async () => ({})),
  },
  purchasesApi: {
    create: vi.fn(async (input: unknown) => ({ ...(input as object), id: "p1" })),
  },
}));

describe("Nueva compra", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("lista los sabores seleccionables", async () => {
    renderWithProviders(<NewPurchasePage />);
    expect(await screen.findByText("Sabores comprados")).toBeInTheDocument();
    expect(screen.getByText("Coco")).toBeInTheDocument();
  });

  it("'Nuevo' abre el mismo FlavorModal de la página de Sabores", async () => {
    renderWithProviders(<NewPurchasePage />);
    await screen.findByText("Sabores comprados");

    await userEvent.click(screen.getByRole("button", { name: /Nuevo/ }));

    expect(await screen.findByText("Nuevo sabor")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre del sabor")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cambiar emoji del sabor" }),
    ).toBeInTheDocument();
  });
});
