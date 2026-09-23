import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/utils";
import { AiRecommendationCard } from "./AiRecommendationCard";
import { aiApi } from "@/services/api";
import { ApiClientError } from "@/services/api/client";
import type { InventoryRecommendation } from "@/types";

// ---------------------------------------------------------------------
// Tarjeta de recomendación IA: estados idle → loading → success/error,
// selector de ventana (7/30/90 días) y mensaje amigable ante fallos.
// El cliente API se mockea (nunca se llama al backend en estos tests).
// ---------------------------------------------------------------------

vi.mock("@/services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api")>();
  return {
    ...actual,
    aiApi: { inventoryRecommendation: vi.fn() },
  };
});

const recommend = vi.mocked(aiApi.inventoryRecommendation);

function makeRecommendation(
  overrides: Partial<InventoryRecommendation> = {},
): InventoryRecommendation {
  return {
    flavor: { id: "f-1", name: "Maracumango", emoji: "🥭" },
    priority: "high",
    reason: "9 unidades vendidas en los últimos 30 días y quedan 15 paletas disponibles.",
    confidence: 0.9,
    probabilities: [
      { id: "f-1", name: "Maracumango", emoji: "🥭", p: 0.7 },
      { id: "f-2", name: "Coco", emoji: "🥥", p: 0.2 },
      { id: "ninguno", name: "Sin recomendación", emoji: "🤔", p: 0.1 },
    ],
    insufficientData: false,
    range: { from: "2026-08-23", to: "2026-09-22", days: 30 },
    model: "jev-1.13.0",
    ...overrides,
  };
}

beforeEach(() => {
  recommend.mockReset();
  localStorage.clear(); // preferencia de visibilidad compartida entre tests
});

describe("AiRecommendationCard", () => {
  it("estado inicial: invita a analizar sin llamar al modelo", () => {
    renderWithProviders(<AiRecommendationCard />);
    expect(screen.getByText("Recomendación IA")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /analizar inventario/i })).toBeInTheDocument();
    expect(recommend).not.toHaveBeenCalled();
  });

  it("analiza y muestra sabor, prioridad, razón, confianza y probabilidades", async () => {
    recommend.mockResolvedValue(makeRecommendation());
    const user = userEvent.setup();
    renderWithProviders(<AiRecommendationCard />);

    await user.click(screen.getByRole("button", { name: /analizar inventario/i }));

    await waitFor(() => {
      expect(screen.getAllByText("Maracumango").length).toBeGreaterThan(0);
    });
    expect(recommend).toHaveBeenCalledWith(30);
    expect(screen.getByText(/prioridad: 🔥 alta/i)).toBeInTheDocument();
    expect(screen.getByText(/vendidas en los últimos 30 días/)).toBeInTheDocument();
    expect(screen.getByText("Confianza de Jev")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "90");
    expect(screen.getByText("Probabilidades de Jev")).toBeInTheDocument();
    expect(screen.getByText("Coco")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /analizar nuevamente/i })).toBeInTheDocument();
  });

  it("deshabilita la acción y muestra estado de carga mientras piensa", async () => {
    recommend.mockReturnValue(new Promise(() => {})); // nunca resuelve
    const user = userEvent.setup();
    renderWithProviders(<AiRecommendationCard />);

    await user.click(screen.getByRole("button", { name: /analizar inventario/i }));

    expect(await screen.findByText(/analizando inventario/i)).toBeInTheDocument();
    // El selector de días queda bloqueado durante el análisis.
    expect(screen.getByRole("button", { name: "7 días" })).toBeDisabled();
  });

  it("fallo del servicio → mensaje amigable en español y botón de reintento", async () => {
    recommend
      .mockRejectedValueOnce(new ApiClientError("AI_UNAVAILABLE", "Servicio caído"))
      .mockResolvedValueOnce(makeRecommendation());
    const user = userEvent.setup();
    renderWithProviders(<AiRecommendationCard />);

    await user.click(screen.getByRole("button", { name: /analizar inventario/i }));

    // Copia específica por código: título + pista + detalle del servidor.
    expect(await screen.findByText(/jev no está disponible/i)).toBeInTheDocument();
    expect(screen.getByText(/el servicio de ia no respondió/i)).toBeInTheDocument();
    expect(screen.getByText(/servicio caído/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /reintentar/i }));
    await waitFor(() => {
      expect(screen.getAllByText("Maracumango").length).toBeGreaterThan(0);
    });
    expect(recommend).toHaveBeenCalledTimes(2);
  });

  it("datos insuficientes → aviso amigable sin sabor", async () => {
    recommend.mockResolvedValue(
      makeRecommendation({
        flavor: null,
        priority: null,
        insufficientData: true,
        reason: "Jev no vio datos suficientes para recomendar un sabor con confianza.",
        probabilities: [{ id: "ninguno", name: "Sin recomendación", emoji: "🤔", p: 0.95 }],
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<AiRecommendationCard />);

    await user.click(screen.getByRole("button", { name: /analizar inventario/i }));

    expect(
      await screen.findByText(/aún no hay una recomendación clara/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/no vio datos suficientes/i)).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("cambiar la ventana de días re-analiza al instante (la demo se juega)", async () => {
    recommend.mockResolvedValue(makeRecommendation());
    const user = userEvent.setup();
    renderWithProviders(<AiRecommendationCard />);

    await user.click(screen.getByRole("button", { name: /analizar inventario/i }));
    await waitFor(() => expect(recommend).toHaveBeenCalledWith(30));

    await user.click(screen.getByRole("button", { name: "7 días" }));
    await waitFor(() => expect(recommend).toHaveBeenCalledWith(7));
    expect(recommend).toHaveBeenCalledTimes(2);
  });

  it("429 (saturación) → explica que Jev está saturado y sugiere esperar", async () => {
    recommend.mockRejectedValueOnce(
      new ApiClientError(
        "AI_RATE_LIMIT",
        "El servicio de IA recibió demasiadas solicitudes. Intenta en unos minutos.",
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<AiRecommendationCard />);

    await user.click(screen.getByRole("button", { name: /analizar inventario/i }));

    expect(await screen.findByText(/jev está saturado/i)).toBeInTheDocument();
    expect(screen.getByText(/espera un minuto/i)).toBeInTheDocument();
    expect(screen.getByText(/recibió demasiadas solicitudes/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });

  it("error sin código del servidor → copia genérica (nunca un estado vacío)", async () => {
    recommend.mockRejectedValue(new TypeError("fetch failed"));
    const user = userEvent.setup();
    renderWithProviders(<AiRecommendationCard />);

    await user.click(screen.getByRole("button", { name: /analizar inventario/i }));

    expect(await screen.findByText(/no fue posible obtener la recomendación/i)).toBeInTheDocument();
    expect(screen.getByText(/revisa tu conexión/i)).toBeInTheDocument();
    // El error crudo del runtime jamás se filtra a la UI.
    expect(screen.queryByText(/fetch failed/i)).not.toBeInTheDocument();
  });

  it("el toggle oculta la tarjeta y la vuelve a mostrar (preferencia persistida)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AiRecommendationCard />);

    const hideButton = screen.getByRole("button", { name: /ocultar recomendación de jev/i });
    expect(hideButton).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("cuerpo-recomendacion-ia")).not.toHaveAttribute("inert");

    await user.click(hideButton);

    expect(
      screen.getByRole("button", { name: /mostrar recomendación de jev/i }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById("cuerpo-recomendacion-ia")).toHaveAttribute("inert");
    expect(localStorage.getItem("nalu.jev.recomendacion-visible")).toBe("0");
    // El encabezado y su toggle siguen disponibles: Nalu sigue operable.
    expect(screen.getByText("Recomendación IA")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /mostrar recomendación de jev/i }));

    expect(
      screen.getByRole("button", { name: /ocultar recomendación de jev/i }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(localStorage.getItem("nalu.jev.recomendacion-visible")).toBe("1");
  });

  it("respeta la preferencia guardada al montar (tarjeta oculta)", () => {
    localStorage.setItem("nalu.jev.recomendacion-visible", "0");
    renderWithProviders(<AiRecommendationCard />);

    expect(
      screen.getByRole("button", { name: /mostrar recomendación de jev/i }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById("cuerpo-recomendacion-ia")).toHaveAttribute("inert");
    expect(screen.getByText("Recomendación IA")).toBeInTheDocument();
  });
});
