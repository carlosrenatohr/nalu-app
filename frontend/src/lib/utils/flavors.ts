// ---------------------------------------------------------------------
// Regla compartida de "sabor seleccionable" en flujos de venta/compra.
// Un sabor archivado no debe aparecer para nuevas operaciones, PERO si ya
// está incluido en el documento que se está editando debe seguir visible
// para no perder la línea histórica.
// ---------------------------------------------------------------------

/**
 * ¿El sabor puede mostrarse en un selector de venta/compra?
 * @param flavor      Sabor a evaluar (archivado = inactive).
 * @param includedQty Cantidad ya incluida en el documento (0 = nada incluido).
 */
export function isSelectableFlavor(
  flavor: { active: boolean },
  includedQty = 0,
): boolean {
  return flavor.active || includedQty > 0;
}

/**
 * Filtra inventario para mostrar sabores seleccionables.
 * `getQty` devuelve la cantidad ya incluida en el documento.
 */
export function selectableInventory<T extends { flavor: { active: boolean } }>(
  inventory: T[],
  getQty: (item: T) => number = () => 0,
): T[] {
  return inventory.filter((item) => isSelectableFlavor(item.flavor, getQty(item)));
}
