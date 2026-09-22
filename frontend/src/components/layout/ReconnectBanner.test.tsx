import { describe, expect, it, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { ReconnectBanner } from "./ReconnectBanner";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import type { SyncState } from "@/lib/offline/syncEngine";

// ---------------------------------------------------------------------
// Banner de reconexión: aviso breve al pasar de offline → online,
// oculto el resto del tiempo (no estorba en uso normal).
// ---------------------------------------------------------------------

vi.mock("@/hooks/useSyncStatus", () => ({ useSyncStatus: vi.fn() }));

function state(overrides: Partial<SyncState> = {}): SyncState {
  return { online: true, pending: 0, syncing: false, lastSync: null, lastError: null, ...overrides };
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("ReconnectBanner", () => {
  it("no se muestra con la conexión estable", () => {
    vi.mocked(useSyncStatus).mockReturnValue(state({ online: true }));
    render(<ReconnectBanner />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("aparece al reconectar y se oculta a los 4 segundos", () => {
    vi.useFakeTimers();
    vi.mocked(useSyncStatus).mockReturnValue(state({ online: false }));
    const { rerender } = render(<ReconnectBanner />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    // Vuelve la conexión → transición offline → online.
    vi.mocked(useSyncStatus).mockReturnValue(state({ online: true }));
    rerender(<ReconnectBanner />);
    expect(screen.getByRole("status")).toHaveTextContent("Conexión restablecida");

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
