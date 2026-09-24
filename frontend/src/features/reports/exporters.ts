import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toBlob } from "html-to-image";
import { formatMoney, formatDateLong } from "@/lib/formatting/currency";
import type { SalesReport, PurchasesReport } from "@/types";

// ---------------------------------------------------------------------
// Exportadores de reportes:
//  1. PDF con branding Nalu (jspdf + autotable).
//  2. Imagen de la ficha compartible para WhatsApp (html-to-image sobre
//     ShareCard, nodo fijo 1080×1350).
// ---------------------------------------------------------------------

const TURQUOISE: [number, number, number] = [21, 158, 155];
const STRAWBERRY: [number, number, number] = [255, 111, 145];
const COCOA: [number, number, number] = [75, 56, 50];

export function exportSalesPdf(
  report: SalesReport,
  businessName: string,
  currency: string,
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Encabezado con branding
  doc.setFillColor(...TURQUOISE);
  doc.rect(0, 0, pageWidth, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(`${businessName} — Reporte de ventas`, 14, 16);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${formatDateLong(report.range.from)} — ${formatDateLong(report.range.to)}`,
    14,
    25,
  );

  // Resumen
  doc.setTextColor(...COCOA);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Resumen", 14, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Ventas: ${formatMoney(report.totalSales, currency)}`, 14, 55);
  doc.text(`Paletas vendidas: ${report.unitsSold}`, 14, 62);
  doc.text(`Costo: ${formatMoney(report.totalCost, currency)}`, 14, 69);
  doc.setTextColor(...STRAWBERRY);
  doc.setFont("helvetica", "bold");
  doc.text(`Ganancia: +${formatMoney(report.profit, currency)} (${report.margin}%)`, 14, 76);
  doc.setTextColor(...COCOA);
  doc.setFont("helvetica", "normal");

  // Sabores más vendidos
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Sabores más vendidos", 14, 92);
  autoTable(doc, {
    startY: 97,
    head: [["Sabor", "Paletas", "Ventas", "Ganancia"]],
    body: report.byFlavor.map((f) => [
      f.flavorName,
      String(f.units),
      formatMoney(f.revenue, currency),
      formatMoney(f.revenue - f.cost, currency),
    ]),
    headStyles: { fillColor: TURQUOISE, textColor: 255 },
    styles: { textColor: COCOA },
  });

  // Ventas por ubicación
  const yAfterFlavors = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
    ?.finalY ?? 140;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Ventas por ubicación", 14, yAfterFlavors + 12);
  autoTable(doc, {
    startY: yAfterFlavors + 17,
    head: [["Ubicación", "Paletas", "Ventas"]],
    body: report.byLocation.map((l) => [
      l.location ?? "Sin ubicación",
      String(l.units),
      formatMoney(l.revenue, currency),
    ]),
    headStyles: { fillColor: STRAWBERRY, textColor: 255 },
    styles: { textColor: COCOA },
  });

  // Ventas por precio
  const yAfterLocations =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 210;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Ventas por precio", 14, yAfterLocations + 12);
  autoTable(doc, {
    startY: yAfterLocations + 17,
    head: [["Precio", "Paletas", "Ventas", "Ganancia"]],
    body: report.byPrice.map((p) => [
      formatMoney(p.unitPrice, currency),
      String(p.units),
      formatMoney(p.revenue, currency),
      formatMoney(p.revenue - p.cost, currency),
    ]),
    headStyles: { fillColor: [155, 126, 222], textColor: 255 },
    styles: { textColor: COCOA },
  });

  // Pie
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 240;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(117, 100, 94);
  doc.text("Reporte generado con Nalu 🍧", 14, finalY + 12);

  doc.save(`reporte-nalu-${report.range.from}-${report.range.to}.pdf`);
}

export function exportPurchasesPdf(
  report: PurchasesReport,
  businessName: string,
  currency: string,
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...TURQUOISE);
  doc.rect(0, 0, pageWidth, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(`${businessName} — Reporte de compras`, 14, 16);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${formatDateLong(report.range.from)} — ${formatDateLong(report.range.to)}`,
    14,
    25,
  );

  doc.setTextColor(...COCOA);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Resumen", 14, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Compras: ${report.totalPurchases}`, 14, 55);
  doc.text(`Paletas compradas: ${report.totalUnits}`, 14, 62);
  doc.text(`Total invertido: ${formatMoney(report.totalCost, currency)}`, 14, 69);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Análisis por proveedor", 14, 85);
  autoTable(doc, {
    startY: 90,
    head: [["Proveedor", "Compras", "Paletas", "Total"]],
    body: report.bySupplier.map((s) => [
      s.supplierName,
      String(s.purchases),
      String(s.units),
      formatMoney(s.totalCost, currency),
    ]),
    headStyles: { fillColor: TURQUOISE, textColor: 255 },
    styles: { textColor: COCOA },
  });

  const yAfter =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 130;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Detalle de compras", 14, yAfter + 12);
  autoTable(doc, {
    startY: yAfter + 17,
    head: [["Fecha", "Proveedor", "Sabores", "Total"]],
    body: report.purchases.map((p) => [
      p.purchaseDate,
      p.supplierName ?? "—",
      p.items.map((i) => `${i.flavorName ?? "?"} ×${i.quantity}`).join(", "),
      formatMoney(p.totalCost, currency),
    ]),
    headStyles: { fillColor: STRAWBERRY, textColor: 255 },
    styles: { textColor: COCOA, fontSize: 9 },
  });

  const finalY =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 240;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(117, 100, 94);
  doc.text("Reporte generado con Nalu 🍧", 14, finalY + 12);

  doc.save(`compras-nalu-${report.range.from}-${report.range.to}.pdf`);
}

/** Resultado de la exportación, para elegir el toast adecuado en la página. */
export type ImageExportResult = "compartida" | "descargada" | "cancelada";

function isAbortError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { name?: string }).name === "AbortError";
}

/**
 * Captura el nodo como PNG, intenta compartirlo y, si no se puede, lo
 * descarga. Correcciones clave: el blob viene directo de toBlob (sin
 * fetch intermedio), el <a> se adjunta al DOM antes del click (Safari/iOS
 * lo ignora si está suelto) y el objectURL se revoca con delay para no
 * cancelar la descarga en curso.
 */
export async function exportReportImage(
  node: HTMLElement,
  filename: string,
): Promise<ImageExportResult> {
  const blob = await toBlob(node, {
    // La ficha ya vive a 1080×1350: ratio 1 = tamaño exacto de salida.
    pixelRatio: 1,
    cacheBust: true,
    backgroundColor: "#FFF9EF",
    skipAutoScale: true,
  });
  if (!blob) throw new Error("No se pudo generar la imagen");

  // Intenta compartir (WhatsApp/estado) si el navegador lo permite.
  if (navigator.share && navigator.canShare) {
    const file = new File([blob], `${filename}.png`, { type: "image/png" });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Reporte Nalu" });
        return "compartida";
      } catch (err) {
        // El usuario cerró la hoja de compartir: sin error y sin descarga.
        if (isAbortError(err)) return "cancelada";
        // Otro fallo del share: fallback a descarga directa.
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revocar tarde: de inmediato varios navegadores cancelan la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "descargada";
}
