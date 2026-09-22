import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/utils";
import { ExitModal } from "./ExitModal";
import type { Flavor, FlavorInventory } from "@/types";

// ---------------------------------------------------------------------
// Salidas/ajustes sin venta: el ajuste exige motivo en el cliente
// (el backend también lo valida) y el modal se puede preabrir con un
// tipo concreto, p. ej. "Ajustar stock" desde Sabores.
// ---------------------------------------------------------------------

const COCO_ID = "20000000-0000-4000-8000-000000000001";
const OREO_ID = "20000000-0000-4000-8000-000000000002";
const STAMP = "2026-09-22T10:00:00.000Z";

function makeFlavor(id: string, name: string, emoji: string): Flavor {
  return {
    id,
    businessId: "10000000-0000-4000-8000-000000000001",
    name,
    slug: name.toLowerCase(),
    emoji,
    color: "#F5E9D8",
    costPrice: 28,
    salePrice: 60,
    minStock: 10,
    active: true,
    createdAt: STAMP,
    updatedAt: STAMP,
  };
}

const MOCK_INVENTORY: FlavorInventory[] = [
  {
    flavor: makeFlavor(COCO_ID, "Coco", "🥥"),
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
  {
    flavor: makeFlavor(OREO_ID, "Oreo", "🍪"),
    available: 18,
    lastCost: 28,
    purchased: 18,
    sold: 0,
    gifted: 0,
    personalUse: 0,
    lost: 0,
    adjusted: 0,
    returned: 0,
    value: 504,
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
    registerMovement: vi.fn(async () => ({})),
  },
}));

const { inventoryApi } = await import("@/services/api");

describe("ExitModal (salidas y ajustes)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preabre el ajuste de stock con el sabor elegido y exige motivo", async () => {
    renderWithProviders(
      <ExitModal
        open
        onClose={vi.fn()}
        inventory={MOCK_INVENTORY}
        presetFlavorId={COCO_ID}
        presetMovementType="ADJUSTMENT"
      />,
    );

    const dialog = await screen.findByRole("dialog", { name: "Ajuste de stock" });
    // Tipo preseleccionado y sabor elegido
    expect(within(dialog).getByRole("radio", { name: /Ajuste/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await waitFor(() => expect(within(dialog).getByRole("combobox")).toHaveValue(COCO_ID));
    // Bidireccional (sentido del ajuste) y motivo obligatorio
    expect(within(dialog).getByRole("radio", { name: "Aumentar (+)" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Guardar movimiento" })).toBeDisabled();
  });

  it("guarda el ajuste con motivo, sentido y sabor correctos", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <ExitModal
        open
        onClose={onClose}
        inventory={MOCK_INVENTORY}
        presetFlavorId={COCO_ID}
        presetMovementType="ADJUSTMENT"
      />,
    );

    const dialog = await screen.findByRole("dialog", { name: "Ajuste de stock" });
    const save = within(dialog).getByRole("button", { name: "Guardar movimiento" });
    expect(save).toBeDisabled();

    await user.type(within(dialog).getByLabelText("Motivo (obligatorio)"), "Conteo físico");
    await user.click(within(dialog).getByRole("radio", { name: "Aumentar (+)" }));
    expect(save).toBeEnabled();
    await user.click(save);

    await waitFor(() =>
      expect(inventoryApi.registerMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          flavorId: COCO_ID,
          movementType: "ADJUSTMENT",
          direction: "in",
          notes: "Conteo físico",
        }),
      ),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("las salidas comunes no exigen motivo", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <ExitModal open onClose={onClose} inventory={MOCK_INVENTORY} presetFlavorId={COCO_ID} />,
    );

    await screen.findByRole("dialog", { name: "Registrar salida" });
    const save = screen.getByRole("button", { name: "Guardar movimiento" });
    expect(save).toBeEnabled();
    await user.click(save);

    await waitFor(() =>
      expect(inventoryApi.registerMovement).toHaveBeenCalledWith(
        expect.objectContaining({ flavorId: COCO_ID, movementType: "GIFT" }),
      ),
    );
    expect(onClose).toHaveBeenCalled();
  });
});
