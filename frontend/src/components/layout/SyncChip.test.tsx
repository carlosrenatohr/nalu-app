import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/utils";
import { SyncChip } from "./SyncChip";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { syncEngine, type SyncState } from "@/lib/offline/syncEngine";

// ---------------------------------------------------------------------
// Estados del indicador de sincronización: en línea, sin conexión,
// sincronizando, pendientes y — nuevo en F6 — el último error visible
// con reintento al tocar.
// ---------------------------------------------------------------------

vi.mock("@/hooks/useSyncStatus", () => ({ useSyncStatus: vi.fn() }));

function state(overrides: Partial<SyncState> = {}): SyncState {
  return { online: true, pending: 0, syncing: false, lastSync: null, lastError: null, ...overrides };
}

describe("SyncChip", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sin errores muestra 'En línea'", () => {
    vi.mocked(useSyncStatus).mockReturnValue(state());
    renderWithProviders(<SyncChip />);
    expect(screen.getByText("En línea")).toBeInTheDocument();
  });

  it("sin conexión muestra 'Sin conexión' con el contador de pendientes", () => {
    vi.mocked(useSyncStatus).mockReturnValue(state({ online: false, pending: 4 }));
    renderWithProviders(<SyncChip />);
    expect(screen.getByText(/Sin conexión · 4 pendientes/)).toBeInTheDocument();
  });

  it("mientras sincroniza lo indica", () => {
    vi.mocked(useSyncStatus).mockReturnValue(state({ syncing: true }));
    renderWithProviders(<SyncChip />);
    expect(screen.getByText("Sincronizando…")).toBeInTheDocument();
  });

  it("con pendientes muestra el contador", () => {
    vi.mocked(useSyncStatus).mockReturnValue(state({ pending: 2 }));
    renderWithProviders(<SyncChip />);
    expect(screen.getByText("2 cambios pendientes")).toBeInTheDocument();
  });

  it("muestra el último error con su motivo y reintenta al tocar", async () => {
    vi.mocked(useSyncStatus).mockReturnValue(
      state({ lastError: "500 Internal Server Error", pending: 3 }),
    );
    const syncSpy = vi.spyOn(syncEngine, "sync").mockResolvedValue(undefined);

    renderWithProviders(<SyncChip />);

    const chip = screen.getByRole("button", { name: /Error al sincronizar/ });
    expect(chip).toHaveAttribute("title", "500 Internal Server Error");

    await userEvent.click(chip);
    expect(syncSpy).toHaveBeenCalledTimes(1);
    syncSpy.mockRestore();
  });
});
