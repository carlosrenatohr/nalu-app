import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ShareCard } from "./ShareCard";
import { FONDOS, FRASES_MOTIVACIONALES, computeShares } from "./shareContent";

// ---------------------------------------------------------------------
// Ficha compartible 1080×1350: podio 2-1-3, % arriba de cada icono,
// 4.º/5.º, «El resto», 😞 en huecos, QR y frase motivacional.
// ---------------------------------------------------------------------

const QR_FALSO = '<svg viewBox="0 0 10 10"><rect width="10" height="10" /></svg>';

const TRES = [
  { flavorId: "a", flavorName: "Fresa", units: 50 },
  { flavorId: "b", flavorName: "Mango", units: 30 },
  { flavorId: "c", flavorName: "Uva", units: 20 },
];

const SEIS = [
  { flavorId: "1", flavorName: "S1", units: 40 },
  { flavorId: "2", flavorName: "S2", units: 20 },
  { flavorId: "3", flavorName: "S3", units: 10 },
  { flavorId: "4", flavorName: "S4", units: 10 },
  { flavorId: "5", flavorName: "S5", units: 10 },
  { flavorId: "6", flavorName: "S6", units: 10 },
];

function renderFicha(
  byFlavor: typeof TRES,
  extras?: { fondoClases?: string; frase?: string; emojiById?: Record<string, string> },
) {
  const shares = computeShares(byFlavor, extras?.emojiById ?? {});
  return render(
    <ShareCard
      businessName="La Esquina"
      rangeFrom="2026-09-01"
      rangeTo="2026-09-30"
      shares={shares}
      frase={extras?.frase ?? (FRASES_MOTIVACIONALES[0] ?? "")}
      fondoClases={extras?.fondoClases ?? (FONDOS[0] ?? "")}
      qrSvg={QR_FALSO}
    />,
  );
}

describe("ShareCard", () => {
  it("es un nodo fijo de 1080×1350 (formato ficha 4:5)", () => {
    renderFicha(TRES);
    const raiz = screen.getByTestId("ficha-raiz");
    expect(raiz).toHaveStyle({ width: "1080px", height: "1350px" });
  });

  it("compone el podio olímpico 2-1-3 con % colorido arriba del icono", () => {
    renderFicha(TRES, { emojiById: { a: "🍓" } });

    const primero = screen.getByTestId("podio-1");
    const segundo = screen.getByTestId("podio-2");
    const tercero = screen.getByTestId("podio-3");

    // Orden visual en el DOM: 2.º, luego 1.º, luego 3.º.
    expect(segundo.compareDocumentPosition(primero) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(primero.compareDocumentPosition(tercero) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(within(primero).getByText("Fresa")).toBeInTheDocument();
    expect(within(segundo).getByText("Mango")).toBeInTheDocument();
    expect(within(tercero).getByText("Uva")).toBeInTheDocument();

    // El % va ANTES (arriba) del icono en cada columna.
    const textoPrimero = primero.textContent ?? "";
    expect(textoPrimero.indexOf("50%")).toBeGreaterThanOrEqual(0);
    expect(textoPrimero.indexOf("50%")).toBeLessThan(textoPrimero.indexOf("Fresa"));
    expect(within(segundo).getByText("30%")).toBeInTheDocument();
    expect(within(tercero).getByText("20%")).toBeInTheDocument();
  });

  it("usa el emoji del catálogo con fallback 🍦", () => {
    renderFicha(TRES, { emojiById: { a: "🍓" } });
    expect(within(screen.getByTestId("podio-1")).getByText("🍓")).toBeInTheDocument();
    // Sin emoji en el catálogo → fallback de paleta.
    expect(within(screen.getByTestId("podio-2")).getByText("🍦")).toBeInTheDocument();
  });

  it("posiciones sin datos muestran 😞 «Sin datos»", () => {
    // Solo dos sabores: el 3.º y el 4.º/5.º quedan vacíos.
    renderFicha(TRES.slice(0, 2));
    const tercero = within(screen.getByTestId("podio-3"));
    expect(tercero.getByText("😞")).toBeInTheDocument();
    expect(tercero.getByText("Sin datos")).toBeInTheDocument();
    expect(within(screen.getByTestId("puesto-4")).getByText("Sin datos")).toBeInTheDocument();
    expect(within(screen.getByTestId("puesto-5")).getByText("Sin datos")).toBeInTheDocument();
  });

  it("sin ventas: los tres huecos del podio muestran 😞 «Sin datos»", () => {
    renderFicha([]);
    for (const puesto of ["podio-1", "podio-2", "podio-3"]) {
      const col = screen.getByTestId(puesto);
      expect(within(col).getByText("😞")).toBeInTheDocument();
      expect(within(col).getByText("Sin datos")).toBeInTheDocument();
    }
    expect(screen.getByTestId("resto")).toHaveTextContent("El resto: 0 %");
  });

  it("lista 4.º y 5.º con su % colorido y la línea final del resto", () => {
    renderFicha(SEIS);
    const cuarto = within(screen.getByTestId("puesto-4"));
    expect(cuarto.getByText("S4")).toBeInTheDocument();
    expect(cuarto.getByText("10%")).toBeInTheDocument();
    const quinto = within(screen.getByTestId("puesto-5"));
    expect(quinto.getByText("S5")).toBeInTheDocument();
    expect(quinto.getByText("10%")).toBeInTheDocument();
    expect(screen.getByTestId("resto")).toHaveTextContent("El resto: 10 %");
  });

  it("muestra el QR a la plataforma y la frase motivacional", async () => {
    renderFicha(TRES);
    expect(
      await screen.findByRole("img", { name: /código qr hacia la plataforma/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(`«${FRASES_MOTIVACIONALES[0]}»`)).toBeInTheDocument();
  });

  it("aplica el fondo rotativo con el mismo template", () => {
    const fondo = FONDOS[1] ?? "";
    renderFicha(TRES, { fondoClases: fondo });
    const raiz = screen.getByTestId("ficha-raiz");
    for (const clase of fondo.split(" ")) {
      if (clase) expect(raiz.classList.contains(clase)).toBe(true);
    }
    // El template base (encabezado + podio) sigue presente con otro fondo.
    expect(screen.getByText("🏆 Top Sabores")).toBeInTheDocument();
    expect(screen.getByTestId("podio-1")).toBeInTheDocument();
  });
});
