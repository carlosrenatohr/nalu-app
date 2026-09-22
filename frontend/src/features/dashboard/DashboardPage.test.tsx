import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/utils";
import { DashboardPage } from "./DashboardPage";

// ---------------------------------------------------------------------
// El Inicio responde "¿qué puedo vender hoy?": catálogo compacto de
// sabores activos con stock (sin archivados ni agotados).
// ---------------------------------------------------------------------

const MOCK_INVENTORY = [
  {
    flavor: {
      id: "20000000-0000-4000-8000-000000000001",
      name: "Coco",
      emoji: "🥥",
      minStock: 10,
      active: true,
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
      minStock: 10,
      active: true,
    },
    available: 18,
    lastCost: 28,
    lowStock: false,
  },
  {
    flavor: {
      id: "20000000-0000-4000-8000-000000000003",
      name: "Vainilla",
      emoji: "🍦",
      minStock: 5,
      active: true,
    },
    available: 0,
    lastCost: 28,
    lowStock: true,
  },
  {
    flavor: {
      id: "20000000-0000-4000-8000-000000000004",
      name: "Fresa archivada",
      emoji: "🍓",
      minStock: 5,
      active: false,
    },
    available: 9,
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
  reportsApi: {
    sales: vi.fn(async () => ({
      range: { from: "", to: "" },
      totalSales: 600,
      unitsSold: 10,
      totalCost: 280,
      profit: 320,
      margin: 53,
      byFlavor: [],
      byLocation: [],
      byPrice: [],
    })),
  },
  salesApi: {
    list: vi.fn(async () => [
      {
        id: "sale-1",
        businessId: "biz-1",
        saleDate: "2026-09-22",
        location: "Casa",
        paymentType: "cash",
        total: 120,
        cost: 56,
        profit: 64,
        notes: null,
        createdAt: "",
        updatedAt: "",
        items: [
          {
            id: "item-1",
            saleId: "sale-1",
            flavorId: "20000000-0000-4000-8000-000000000001",
            flavorName: "Coco",
            quantity: 2,
            unitPrice: 60,
            unitCostSnapshot: 28,
          },
        ],
      },
    ]),
  },
}));

describe("Inicio (Dashboard)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra el catálogo de sabores activos con stock", async () => {
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText("Disponibles ahora")).toBeInTheDocument();
    expect(screen.getByText("Coco")).toBeInTheDocument();
    expect(screen.getByText("Oreo")).toBeInTheDocument();
    // Sin stock ni archivados: no se pueden vender.
    expect(screen.queryByText("Vainilla")).not.toBeInTheDocument();
    expect(screen.queryByText("Fresa archivada")).not.toBeInTheDocument();
  });

  it("ordena el catálogo del más escaso al más disponible", async () => {
    renderWithProviders(<DashboardPage />);
    await screen.findByText("Disponibles ahora");
    const items = screen
      .getAllByRole("listitem")
      .map((li) => li.textContent ?? "")
      .filter((t) => t.includes("disponibles"));
    // Coco (4) antes que Oreo (18)
    expect(items[0]).toContain("Coco");
    expect(items[1]).toContain("Oreo");
  });

  it("mantiene las acciones rápidas de venta/compra/salida", async () => {
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByRole("button", { name: /Registrar venta/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Registrar compra/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Registrar salida/i })).toBeInTheDocument();
  });
});
