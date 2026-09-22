import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/utils";
import { InventoryPage } from "./InventoryPage";

// ---------------------------------------------------------------------
// El inventario se renderiza como tarjetas visuales, no como tabla.
// ---------------------------------------------------------------------

const MOCK_INVENTORY = [
  {
    flavor: {
      id: "20000000-0000-4000-8000-000000000001",
      name: "Coco",
      emoji: "🥥",
      color: "#F5E9D8",
      minStock: 10,
    },
    available: 4,
    lastCost: 28,
    lowStock: true,
  },
  {
    flavor: {
      id: "20000000-0000-4000-8000-000000000002",
      name: "Oreo",
      emoji: "🍪",
      color: "#4B3832",
      minStock: 10,
    },
    available: 18,
    lastCost: 28,
    lowStock: false,
  },
];

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
    list: vi.fn(async () => MOCK_INVENTORY),
  },
}));

describe("Inventario", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra cada sabor con su disponibilidad", async () => {
    renderWithProviders(<InventoryPage />);
    expect(await screen.findByText("Coco")).toBeInTheDocument();
    expect(screen.getByText("Oreo")).toBeInTheDocument();
    // Disponibles en las tarjetas
    expect(screen.getAllByText("4")).not.toHaveLength(0);
    expect(screen.getAllByText("18")).not.toHaveLength(0);
  });

  it("muestra el indicador de stock bajo", async () => {
    renderWithProviders(<InventoryPage />);
    await screen.findByText("Coco");
    expect(screen.getByText("¡Pocas!")).toBeInTheDocument();
  });

  it("ordena las tarjetas por stock (menor primero por defecto)", async () => {
    renderWithProviders(<InventoryPage />);
    await screen.findByText("Coco");

    const names = () =>
      screen
        .getAllByRole("listitem")
        .map((li) => li.textContent ?? "")
        .filter((t) => t.includes("disponibles") || t.includes("Coco") || t.includes("Oreo"));

    // Por defecto: menor stock primero → Coco (4) antes que Oreo (18).
    expect(names()[0]).toContain("Coco");

    await userEvent.selectOptions(screen.getByLabelText(/Ordenar/i), "high");
    const after = names();
    expect(after[0]).toContain("Oreo");
  });
});
