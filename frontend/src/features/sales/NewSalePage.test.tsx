import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/utils";
import { NewSalePage } from "./NewSalePage";

// ---------------------------------------------------------------------
// Flujo clave: venta rápida. Se prueba que la UI calcula el total,
// valida los campos y guarda la venta.
// ---------------------------------------------------------------------

const MOCK_INVENTORY = [
  {
    flavor: {
      id: "20000000-0000-4000-8000-000000000001",
      name: "Coco",
      emoji: "🥥",
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
      minStock: 10,
    },
    available: 8,
    lastCost: 28,
    lowStock: false,
  },
];

const MOCK_LOCATIONS = [{ id: "40000000-0000-4000-8000-000000000001", name: "Casa", active: true }];

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
  locationsApi: {
    list: vi.fn(async () => MOCK_LOCATIONS),
  },
  salesApi: {
    create: vi.fn(async (input: unknown) => ({ ...(input as object), id: "sale-1", profit: 64 })),
  },
}));

const { salesApi } = await import("@/services/api");

describe("Nueva venta (venta rápida)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra los sabores con su disponibilidad", async () => {
    renderWithProviders(<NewSalePage />);
    expect(await screen.findByText("Coco")).toBeInTheDocument();
    expect(screen.getByText("Oreo")).toBeInTheDocument();
  });

  it("calcula el total al agregar cantidades", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewSalePage />);

    await screen.findByText("Coco");

    // Ubicación
    await user.click(screen.getByRole("radio", { name: "Casa" }));

    // Suma 2 de Coco (botones "Agregar uno" de cada fila)
    const addButtons = screen.getAllByRole("button", { name: "Agregar uno" });
    await user.click(addButtons[0]!);
    await user.click(addButtons[0]!);

    // Total: 2 × C$60 = C$120
    await waitFor(() => {
      expect(screen.getByText("C$120")).toBeInTheDocument();
    });
  });

  it("valida que se elija ubicación antes de guardar", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewSalePage />);
    await screen.findByText("Coco");

    const addButtons = screen.getAllByRole("button", { name: "Agregar uno" });
    await user.click(addButtons[0]!);
    await user.click(screen.getByRole("button", { name: /Confirmar venta/i }));

    expect(await screen.findByText("Elige una ubicación")).toBeInTheDocument();
    expect(salesApi.create).not.toHaveBeenCalled();
  });

  it("guarda la venta con los datos correctos", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewSalePage />);
    await screen.findByText("Coco");

    await user.click(screen.getByRole("radio", { name: "Casa" }));
    const addButtons = screen.getAllByRole("button", { name: "Agregar uno" });
    await user.click(addButtons[0]!);
    await user.click(screen.getByRole("button", { name: /Confirmar venta/i }));

    await waitFor(() => {
      expect(salesApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          location: "Casa",
          items: [
            expect.objectContaining({
              flavorId: "20000000-0000-4000-8000-000000000001",
              quantity: 1,
              unitPrice: 60,
            }),
          ],
        }),
      );
    });
  });
});
