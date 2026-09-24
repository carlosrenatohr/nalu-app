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

### 2. Ficha compartible para WhatsApp (`html-to-image`)

- Imagen fija **1080×1350** (formato «ficha corta» 4:5 de Instagram/WhatsApp). En pantalla se muestra escalada con `transform`; la captura siempre sale a tamaño real.
- **Podio olímpico 2-1-3** de los 3 sabores más vendidos, con el **% colorido arriba de cada icono** (emoji del catálogo; si el sabor no tiene emoji, fallback 🍦).
- Mini-lista con el **4.º y 5.º** (cada uno con su % colorido) y última línea **«El resto: X %»** (sabores fuera del top 5).
- Posiciones sin datos muestran **😞 «Sin datos»** — siempre el mismo template, sin huecos vacíos.
- **QR client-side** (librería `qrcode`, SVG) hacia la raíz de la plataforma: sin servicios externos ni presupuesto.
- **Frase motivacional y fondo rotativos** en cada generación de imagen: 24 frases + 8 fondos locales con índice en `localStorage` (no se repiten hasta cerrar el ciclo; nada se guarda ni se sube — todo se genera al momento).
- Los % se calculan sobre las **unidades vendidas del rango**; el QR, la frase y el emoji se resuelven en el frontend, sin tocar el backend.
- Si el navegador lo permite, usa **Web Share** para compartir directo (WhatsApp); si no, descarga el PNG. Cancelar el compartir **no** descarga nada ni muestra error.

## Gráficas

Barras horizontales CSS simples (`BarChart`): sin librerías de charts, con los colores de la marca (turquesa, fresa, mango, uva).

## Estilo visual de los reportes

- Fondo crema, encabezado turquesa, acentos fresa/mango/kiwi/uva.
- Tarjetas redondeadas, números grandes, barras simples.
- Decoración sutil de frutas/paleta.
- Profesional para análisis, alegre para compartir.
