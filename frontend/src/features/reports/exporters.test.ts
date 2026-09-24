import { describe, expect, it, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { toBlob } from "html-to-image";
import { exportReportImage } from "./exporters";

// ---------------------------------------------------------------------
// Exportador de imagen: el <a> debe ir adjunto al DOM (Safari/iOS), el
// objectURL se revoca con delay (revocarlo ya cancela la descarga) y
// cancelar el share no es un error ni dispara descarga fantasma.
// ---------------------------------------------------------------------

vi.mock("html-to-image", () => ({ toBlob: vi.fn() }));

const toBlobMock = vi.mocked(toBlob);
const createObjectURL = vi.fn(() => "blob:fake-url");
const revokeObjectURL = vi.fn();

function setNavigator(name: "share" | "canShare", value: unknown) {
  Object.defineProperty(navigator, name, { value, configurable: true, writable: true });
}

beforeAll(() => {
  URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
});

beforeEach(() => {
  toBlobMock.mockResolvedValue(new Blob(["png"], { type: "image/png" }));
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
});

afterEach(() => {
  setNavigator("share", undefined);
  setNavigator("canShare", undefined);
});

describe("exportReportImage", () => {
  it("adjunta el enlace al DOM, descarga y revoca el objectURL con delay", async () => {
    vi.useFakeTimers();
    const clicks: { connected: boolean; download: string; href: string }[] = [];
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function clickMock() {
      clicks.push({ connected: this.isConnected, download: this.download, href: this.href });
    };

    try {
      const result = await exportReportImage(document.createElement("div"), "mi-reporte");

      expect(result).toBe("descargada");
      expect(clicks).toHaveLength(1);
      const primero = clicks[0];
      expect(primero).toBeDefined();
      // Clave Safari/iOS: el ancla debe estar en el body en el momento del click.
      expect(primero?.connected).toBe(true);
      expect(primero?.download).toBe("mi-reporte.png");
      expect(primero?.href).toMatch(/^blob:/);
      // Limpieza tras el click: no quedan enlaces huérfanos.
      expect(document.body.querySelector("a")).toBeNull();

      // El revoke NO puede ser inmediato (rompía la descarga).
      expect(revokeObjectURL).not.toHaveBeenCalled();
      vi.advanceTimersByTime(10_000);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
      vi.useRealTimers();
    }
  });

  it("usa toBlob directo (sin fetch intermedio del dataUrl)", async () => {
    setNavigator("share", undefined);
    const node = document.createElement("div");
    await exportReportImage(node, "x");
    expect(toBlobMock).toHaveBeenCalledWith(node, expect.objectContaining({ skipAutoScale: true }));
  });

  it("comparte el archivo y no descarga cuando el share funciona", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator("share", share);
    setNavigator("canShare", vi.fn(() => true));

    const result = await exportReportImage(document.createElement("div"), "ficha");

    expect(result).toBe("compartida");
    expect(share).toHaveBeenCalledTimes(1);
    const arg = share.mock.calls[0]?.[0] as { files: File[] };
    expect(arg.files[0]?.name).toBe("ficha.png");
    expect(arg.files[0]?.type).toBe("image/png");
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("si el usuario cancela el share, no hay error ni descarga", async () => {
    const cancelError = Object.assign(new Error("cancelado"), { name: "AbortError" });
    setNavigator("share", vi.fn().mockRejectedValue(cancelError));
    setNavigator("canShare", vi.fn(() => true));

    await expect(exportReportImage(document.createElement("div"), "f")).resolves.toBe("cancelada");
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("si el share falla por otra razón, cae a la descarga", async () => {
    setNavigator("share", vi.fn().mockRejectedValue(new Error("sin soporte")));
    setNavigator("canShare", vi.fn(() => true));

    await expect(exportReportImage(document.createElement("div"), "f")).resolves.toBe("descargada");
    expect(createObjectURL).toHaveBeenCalled();
  });

  it("si toBlob no produce blob, lanza error para el toast de la página", async () => {
    toBlobMock.mockResolvedValueOnce(null);
    await expect(exportReportImage(document.createElement("div"), "f")).rejects.toThrow(
      "No se pudo generar la imagen",
    );
  });
});
