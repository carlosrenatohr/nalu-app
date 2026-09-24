import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/utils";
import { SalesPage } from "./SalesPage";

// ---------------------------------------------------------------------
// Lista de ventas paginada: primera página + "Cargar más" acumula la
// siguiente sin perder el conteo total del rango.
// ---------------------------------------------------------------------

function makeSale(id: string, location: string) {
  return {
    id,
    businessId: "biz-1",
    saleDate: "2026-09-22",
    location,
    notes: null,
    total: 120,
    paymentType: "cash",
    profit: 64,
    items: [
      {
        id: `item-${id}`,
        saleId: id,
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
}

const PAGE_1 = {
  items: [makeSale("s1", "Casa"), makeSale("s2", "Puesto")],
  total: 3,
  page: 1,
  limit: 20,
};
const PAGE_2 = {
  items: [makeSale("s3", "Otro")],
  total: 3,
  page: 2,
  limit: 20,
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
    list: vi.fn(async () => []),
  },
  locationsApi: {
    list: vi.fn(async () => []),
  },
  salesApi: {
    list: vi.fn(async () => []),
    listPage: vi.fn(async (_from: string | undefined, _to: string | undefined, page: number) =>
      page === 1 ? PAGE_1 : PAGE_2,
    ),
    update: vi.fn(async (id: string) => makeSale(id, "Casa")),
    delete: vi.fn(async () => makeSale("s1", "Casa")),
  },
}));

const { salesApi } = await import("@/services/api");

describe("Ventas (lista paginada)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra la primera página y avisa cuántas faltan", async () => {
    renderWithProviders(<SalesPage />);
    expect(await screen.findByText("Casa")).toBeInTheDocument();
    expect(screen.getByText("Puesto")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Acciones de la venta en Casa" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Otro")).not.toBeInTheDocument();
    expect(screen.getByText(/2 de 3 ventas/)).toBeInTheDocument();
    expect(salesApi.listPage).toHaveBeenCalledWith(expect.any(String), expect.any(String), 1, 20);
  });

  it("'Cargar más' trae la siguiente página y oculta el botón al terminar", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SalesPage />);
    await screen.findByText("Casa");

    await user.click(screen.getByRole("button", { name: /Cargar más \(1 restantes\)/ }));

    expect(await screen.findByText("Otro")).toBeInTheDocument();
    await waitFor(() => {
      expect(salesApi.listPage).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        2,
        20,
      );
    });
    // Ya no hay páginas pendientes: se oculta y el conteo pasa a total.
    expect(screen.queryByRole("button", { name: /Cargar más/ })).not.toBeInTheDocument();
    expect(screen.getByText(/3 ventas/)).toBeInTheDocument();
  });

  it("tocar la fila abre el detalle de la venta", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SalesPage />);
    await screen.findByText("Casa");

    await user.click(screen.getByRole("button", { name: "Ver detalle de la venta en Casa" }));

    expect(await screen.findByText("Detalle de venta")).toBeInTheDocument();
    expect(screen.getByText("Coco")).toBeInTheDocument();
  });
});
