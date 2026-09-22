import { describe, expect, it } from "vitest";
import { matchesSearch, normalizeSearch } from "./search";

// ---------------------------------------------------------------------
// La búsqueda de sabores debe ser flexible: sin acentos y sin importar
// mayúsculas/minúsculas ("fresa" encuentra "Frésa").
// ---------------------------------------------------------------------

describe("normalizeSearch", () => {
  it("quita acentos", () => {
    expect(normalizeSearch("Frésa con Créma")).toBe("fresa con crema");
    expect(normalizeSearch("Mangó")).toBe("mango");
    expect(normalizeSearch("piña")).toBe("pina");
  });

  it("hace el texto minúsculas", () => {
    expect(normalizeSearch("OREO")).toBe("oreo");
    expect(normalizeSearch("Coco con Choco")).toBe("coco con choco");
  });

  it("recorta espacios sobrantes", () => {
    expect(normalizeSearch("  Coco  ")).toBe("coco");
  });

  it("soporta caracteres sin diacríticos sin romperlos", () => {
    expect(normalizeSearch("Chocolate 🍫")).toBe("chocolate 🍫");
    expect(normalizeSearch("n°1")).toBe("n°1");
  });
});

describe("matchesSearch", () => {
  it("coincide sin importar acentos ni mayúsculas", () => {
    expect(matchesSearch("fresa", "Frésa")).toBe(true);
    expect(matchesSearch("FRESA", "fresa")).toBe(true);
    expect(matchesSearch("mango con chile", "Mangó con Chile")).toBe(true);
  });

  it("no coincide cuando no hay coincidencia", () => {
    expect(matchesSearch("dulce", "Frésa")).toBe(false);
    expect(matchesSearch("choco", "Frésa")).toBe(false);
  });

  it("búsqueda vacía muestra todo", () => {
    expect(matchesSearch("", "Coco")).toBe(true);
    expect(matchesSearch("   ", "Coco")).toBe(true);
  });

  it("texto null/undefined se trata como vacío sin lanzar", () => {
    expect(matchesSearch("x", null)).toBe(false);
    expect(matchesSearch("x", undefined)).toBe(false);
    expect(matchesSearch("", null)).toBe(true);
  });
});
