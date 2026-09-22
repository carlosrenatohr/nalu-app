import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/utils";
import { FlavorsPage } from "./FlavorsPage";

// ---------------------------------------------------------------------
// Sabores: desde el menú de acciones se abre el ajuste de stock con el
// sabor preseleccionado y el motivo obligatorio (ExitModal + ADJUSTMENT).
// ---------------------------------------------------------------------

const COCO_ID = "20000000-0000-4000-8000-000000000001";

const MOCK_FLAVOR = {
  id: COCO_ID,
  businessId: "10000000-0000-4000-8000-000000000001",
  name: "Coco",
  slug: "coco",
  emoji: "🥥",
  color: "#F5E9D8",
  costPrice: 28,
  salePrice: 60,
  minStock: 10,
  active: true,
  createdAt: "2026-09-22T10:00:00.000Z",
  updatedAt: "2026-09-22T10:00:00.000Z",
};

const MOCK_INVENTORY = [
  {
    flavor: MOCK_FLAVOR,
    available: 4,
    lastCost: 28,
    purchased: 10,
    sold: 6,
    gifted: 0,
    personalUse: 0,
    lost: 0,
    adjusted: 0,
    returned: 0,
    value: 112,
    lowStock: true,
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
  flavorsApi: {
    list: vi.fn(async () => [MOCK_FLAVOR]),
    create: vi.fn(async () => MOCK_FLAVOR),
    update: vi.fn(async () => MOCK_FLAVOR),
    delete: vi.fn(async () => ({ archived: false })),
  },
  inventoryApi: {
    list: vi.fn(async () => MOCK_INVENTORY),
    registerMovement: vi.fn(async () => ({})),
  },
}));

const { inventoryApi } = await import("@/services/api");

async function openAdjustFromMenu(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText("Coco");
  await user.click(screen.getByRole("button", { name: "Acciones de Coco" }));
  await user.click(screen.getByRole("menuitem", { name: /Ajustar stock/ }));
  return screen.findByRole("dialog", { name: "Ajuste de stock" });
}

describe("Sabores → Ajustar stock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("abre el ajuste de stock con el sabor preseleccionado y motivo obligatorio", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FlavorsPage />);

    const dialog = await openAdjustFromMenu(user);
    await waitFor(() => expect(within(dialog).getByRole("combobox")).toHaveValue(COCO_ID));
    expect(within(dialog).getByRole("radio", { name: /Ajuste/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(within(dialog).getByRole("button", { name: "Guardar movimiento" })).toBeDisabled();
  });

  it("registra el ajuste con motivo y cierra el modal", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FlavorsPage />);

    const dialog = await openAdjustFromMenu(user);
    await user.type(within(dialog).getByLabelText("Motivo (obligatorio)"), "Conteo físico");
    await user.click(within(dialog).getByRole("button", { name: "Guardar movimiento" }));

    await waitFor(() =>
      expect(inventoryApi.registerMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          flavorId: COCO_ID,
          movementType: "ADJUSTMENT",
          notes: "Conteo físico",
        }),
      ),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("ofrece las cuatro acciones por sabor en el menú", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FlavorsPage />);
    await screen.findByText("Coco");
    await user.click(screen.getByRole("button", { name: "Acciones de Coco" }));

    const menu = screen.getByRole("menu");
    const labels = within(menu)
      .getAllByRole("menuitem")
      .map((el) => el.textContent ?? "");
    expect(labels).toHaveLength(4);
    expect(labels[0]).toContain("Editar");
    expect(labels[1]).toContain("Ajustar stock");
    expect(labels[2]).toContain("Desactivar");
    expect(labels[3]).toContain("Eliminar");
  });
});
