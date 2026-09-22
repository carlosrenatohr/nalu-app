import { describe, expect, it } from "vitest";
import { isSelectableFlavor, selectableInventory } from "./flavors";

// ---------------------------------------------------------------------
// Regla de negocio: los sabores archivados NO deben aparecer para nuevas
// ventas/compras, salvo que ya estén incluidos en el documento editado.
// ---------------------------------------------------------------------

describe("isSelectableFlavor", () => {
  it("sabor activo siempre es seleccionable", () => {
    expect(isSelectableFlavor({ active: true })).toBe(true);
    expect(isSelectableFlavor({ active: true }, 0)).toBe(true);
  });

  it("sabor archivado NO es seleccionable si no está incluido", () => {
    expect(isSelectableFlavor({ active: false })).toBe(false);
    expect(isSelectableFlavor({ active: false }, 0)).toBe(false);
  });

  it("sabor archivado SÍ se mantiene si ya está incluido en el documento", () => {
    expect(isSelectableFlavor({ active: false }, 3)).toBe(true);
  });
});

describe("selectableInventory", () => {
  const inv = [
    { flavor: { active: true }, qty: 0 },
    { flavor: { active: false }, qty: 0 },
    { flavor: { active: false }, qty: 2 },
  ];

  it("filtra archivados sin cantidad incluida", () => {
    const result = selectableInventory(inv, (i) => i.qty);
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.qty)).toEqual([0, 2]);
  });

  it("por defecto (sin getQty) excluye todos los archivados", () => {
    const result = selectableInventory(inv);
    expect(result).toHaveLength(1);
    expect(result[0]?.flavor.active).toBe(true);
  });
});
