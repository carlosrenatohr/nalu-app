# Reportes y exportación

## Rangos de fechas

La página de Reportes ofrece:

- Hoy
- Ayer
- Últimos 7 días
- Esta semana (desde el lunes)
- Este mes
- Mes anterior
- Rango personalizado (desde/hasta)

Todos los cálculos de reporte los hace **el servidor** (`GET /api/reports/sales`, `GET /api/reports/purchases`, `GET /api/reports/inventory`).

## Reporte de ventas

Incluye:

- Ventas totales (C$)
- Paletas vendidas
- Costo de las paletas vendidas (suma de `quantity × unit_cost_snapshot` → costo histórico)
- Ganancia (`ventas − costo`)
- Margen (`ganancia / ventas × 100`)
- **Sabores más vendidos** (por cantidad)
- **Ventas por ubicación**
- **Ventas por precio** (análisis de canales: C$40, C$50, C$60…)

### Análisis por precio

Agrupa las ventas por el precio real cobrado:

```
C$40 → unidades vendidas → ganancia
C$50 → unidades vendidas → ganancia
C$60 → unidades vendidas → ganancia
```

Ayuda a entender qué canales/precios son más rentables.

## Reporte de compras (proveedores)

Por cada compra: fecha, proveedor, sabores, cantidades, costo unitario y total.

Incluye análisis **por proveedor** (número de compras, paletas y total invertido) y resumen del período.

> **Sobre rentabilidad por lote:** si la rentabilidad exacta por lote no está disponible, los valores se etiquetan como estimaciones. Nalu nunca presenta estimaciones como números exactos. El costo histórico por venta sí es exacto (se congela al vender).

## Exportaciones

### 1. PDF (`jspdf` + `jspdf-autotable`)

- Branding Nalu: encabezado turquesa con el nombre del negocio y el rango de fechas.
- Resumen con números grandes.
- Tablas: sabores más vendidos, ventas por ubicación, ventas por precio.
- PDF de compras con análisis por proveedor y detalle.
- Se genera **en el navegador** (funciona offline y no depende del servidor).

### 2. Imagen para WhatsApp (`html-to-image`)

- Captura la **tarjeta de reporte** con branding (fondo crema, encabezado turquesa, números grandes, barras de sabores).
- Diseñada como **imagen de reporte**, no como captura de pantalla.
- Si el navegador lo permite, usa **Web Share** para compartir directo (WhatsApp); si no, descarga el PNG.

## Gráficas

Barras horizontales CSS simples (`BarChart`): sin librerías de charts, con los colores de la marca (turquesa, fresa, mango, uva).

## Estilo visual de los reportes

- Fondo crema, encabezado turquesa, acentos fresa/mango/kiwi/uva.
- Tarjetas redondeadas, números grandes, barras simples.
- Decoración sutil de frutas/paleta.
- Profesional para análisis, alegre para compartir.
