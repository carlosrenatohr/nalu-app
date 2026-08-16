# Reglas de negocio

Este documento define el comportamiento **no negociable** de Nalu. Los tests de dominio y de API verifican estas reglas.

## 1. Una salida de inventario NO es automáticamente una venta

Existen 7 tipos de movimiento:

| Tipo | Efecto en inventario | ¿Genera ingresos? |
|---|---|---|
| `PURCHASE` | + (entrada) | No |
| `SALE` | − (salida) | **Sí** |
| `GIFT` | − (salida) | No |
| `PERSONAL_USE` | − (salida) | No |
| `LOSS` | − (salida) | No |
| `ADJUSTMENT` | ± | No |
| `RETURN` | + (entrada) | No |

**Regla crítica:** regalar, consumo propio y pérdidas **nunca** se cuentan como ventas ni generan ingresos. Solo `SALE` genera ingresos.

## 2. Inventario basado en movimientos

El disponible de un sabor es **siempre** la suma de las cantidades firmadas de sus movimientos:

```
+30 PURCHASE
−10 SALE
−2  GIFT
−1  PERSONAL_USE
= 17 disponibles
```

No se mantienen conteos paralelos. El caché de inventario del frontend (IndexedDB) es solo una vista derivada para el modo offline y se refresca desde el servidor.

## 3. Costo histórico (integridad de datos)

- Al vender, se congela el costo unitario promedio del sabor en `sale_items.unit_cost_snapshot`.
- **Las ventas pasadas nunca se recalculan** con el costo actual del proveedor.

Ejemplo:

```
Compra:  C$28
Venta:   C$60   → ganancia C$32 (se guarda el snapshot 28)
Más tarde el proveedor sube a C$30:
La venta anterior sigue mostrando ganancia C$32, no C$30.
```

## 4. Cálculo de ganancia

```
ganancia = total de la venta − costo histórico total
margen   = ganancia / total × 100
```

Los totales los calcula **el servidor** (autoritativo). El frontend muestra estimaciones instantáneas para la UX, pero la fuente de verdad financiera es la API.

## 5. Disponibilidad de inventario

Al registrar una venta (o regalo, consumo, pérdida), el servidor valida que el disponible alcance la cantidad:

- Si no alcanza → `409 INSUFFICIENT_INVENTORY` con mensaje en español.
- La operación **no** se aplica y **no** altera el inventario.

La validación y la escritura ocurren en la misma operación (lectura previa + `batch` atómico). Para un negocio de una sola persona la ventana de concurrencia es irrelevante; se documenta por transparencia.

## 6. Compras

Al registrar una compra:

1. Se crea la compra.
2. Se crean los ítems (cantidad × costo unitario = subtotal).
3. Se crean los movimientos `PURCHASE` (entrada).
4. El inventario aumenta.
5. El costo unitario queda disponible para el promedio ponderado (costo histórico de futuras ventas).

El total de la compra lo calcula el servidor (nunca se confía en el subtotal enviado por el cliente).

## 7. Ventas

Flujo de la venta rápida (móvil):

1. Elegir ubicación.
2. Elegir sabores.
3. Elegir cantidades.
4. Confirmar/ajustar precio.
5. Ver total y ganancia estimada.
6. Confirmar → se guarda la venta + ítems + movimientos de salida.

El servidor recalcula subtotales y total; el precio lo define el vendedor (los botones rápidos 40/50/60 son atajos, no reglas).

## 8. Precios por defecto (configurables)

- Costo de compra por defecto: **C$28** (configurable en Ajustes).
- Precio de venta por defecto: **C$60** (configurable en Ajustes).

Son valores iniciales del negocio, **no** reglas de negocio. El vendedor puede cambiarlos en cada operación y en Ajustes.

## 9. Validaciones del servidor (no confiar en el frontend)

- `cantidad > 0` (entero).
- `precio >= 0`.
- Fecha válida `YYYY-MM-DD`.
- Existencia del sabor y del proveedor.
- Inventario disponible.
- Los IDs de sincronización se deduplican (idempotencia).

## 10. Ubicaciones y sabores configurables

- Las ubicaciones (Casa, Puesto, Otro) se administran en Ajustes; las ventas guardan el **nombre** de la ubicación (desnormalizado a propósito: mantiene el histórico estable ante renombres futuros, decisión documentada).
- Se pueden crear nuevos sabores; su `slug` se genera automáticamente y es único por negocio.

## 11. Atomicidad

Las operaciones multi-registro (venta, compra) se ejecutan en un solo `batch` transaccional. Si cualquier sentencia falla, **todo se revierte**: nunca quedan ventas sin ítems o compras sin movimientos.

## 12. Moneda

Todo el dinero se maneja con la moneda configurada (`NIO` por defecto, mostrada como C$). Los montos se redondean a 2 decimales al persistir.
