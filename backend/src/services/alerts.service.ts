import type { Business, FlavorInventory } from "../domain/types";
import { formatMoney } from "../domain/calculations/money";

// ---------------------------------------------------------------------
// Alertas por email (Cloudflare Email Sending, binding SEND_EMAIL).
//
// Estrategia (cron diario a las 07:00 hora local):
//   1. Alerta de STOCK BAJO: sabores con disponible <= min_stock.
//   2. Resumen del día anterior: ventas, ganancia, unidades y top sabores.
//
// Los constructores de contenido son FUNCIONES PURAS (testeables); el
// envío se inyecta para poder simularlo en tests y desarrollo local.
// ---------------------------------------------------------------------

export interface EmailMessage {
  to: string;
  from: { email: string; name?: string };
  subject: string;
  html: string;
  text: string;
}

/** Contrato mínimo del binding send_email (inyectable). */
export interface EmailSender {
  send(message: EmailMessage): Promise<unknown>;
}

/** Forma mínima del resumen de ventas que necesita el email. */
export interface SalesSummary {
  totalSales: number;
  unitsSold: number;
  profit: number;
  margin: number;
  byFlavor: { flavorId: string; flavorName: string; units: number; revenue: number; cost: number }[];
}

export interface DailyAlertInput {
  business: Business;
  inventory: FlavorInventory[];
  summary: SalesSummary;
  from: { email: string; name?: string };
}

/** Envoltura HTML con el estilo Nalu (inline: compatible con clientes). */
function shell(body: string): string {
  return `
    <div style="background:#FFF9EF;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#4B3832">
      <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border-radius:20px;overflow:hidden;border:1px solid #F0E4D4">
        <div style="background:linear-gradient(135deg,#36C9C6,#159E9B);padding:20px 24px">
          <h1 style="margin:0;color:#FFFFFF;font-size:22px">🍧 Nalu</h1>
          <p style="margin:4px 0 0;color:#EAFBF9;font-size:13px">Paletas artesanales</p>
        </div>
        <div style="padding:24px">${body}</div>
        <div style="background:#FFF9EF;padding:14px 24px;color:#75645E;font-size:12px;text-align:center">
          Nalu · Asistente de tu negocio 🍦
        </div>
      </div>
    </div>
  `;
}

/** Email de stock bajo, o null si no hay sabores en alerta. */
export function buildLowStockEmail(
  business: Business,
  inventory: FlavorInventory[],
  from: { email: string; name?: string },
): EmailMessage | null {
  const low = inventory.filter((i) => i.lowStock);
  if (low.length === 0) return null;
  if (!business.alertEmail) return null;

  const rows = low
    .map(
      (i) => `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #F0E4D4;font-weight:bold">
            ${i.flavor.emoji ?? "🍦"} ${i.flavor.name}
          </td>
          <td style="padding:10px;border-bottom:1px solid #F0E4D4;text-align:center">
            <span style="background:#FFD1DC;color:#B32655;border-radius:999px;padding:3px 12px;font-weight:bold">
              ${i.available} disponibles
            </span>
          </td>
          <td style="padding:10px;border-bottom:1px solid #F0E4D4;text-align:center;color:#75645E">
            mín. ${i.flavor.minStock}
          </td>
        </tr>`,
    )
    .join("");

  return {
    to: business.alertEmail,
    from,
    subject: `⚠️ ¡${low.length} sabor${low.length === 1 ? "" : "es"} con poco inventario!`,
    html: shell(`
      <h2 style="margin:0 0 8px;color:#4B3832;font-size:18px">¡Ojo con el inventario! 🍌</h2>
      <p style="margin:0 0 16px;color:#75645E;font-size:14px">
        Estos sabores están por debajo del stock mínimo y conviene reponerlos:
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:#FFF1B8;color:#4B3832">
            <th style="padding:10px;text-align:left">Sabor</th>
            <th style="padding:10px">Disponible</th>
            <th style="padding:10px">Stock mínimo</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin:18px 0 0;color:#75645E;font-size:13px">
        Registra una compra desde la app para no quedarte sin paletas. 🛒
      </p>
    `),
    text: `¡Ojo con el inventario!\n\nEstos sabores están bajos:\n${low
      .map((i) => `- ${i.flavor.name}: ${i.available} disponibles (mín. ${i.flavor.minStock})`)
      .join("\n")}\n\nRegistra una compra para reponerlos.`,
  };
}

/** Email de resumen diario del negocio. */
export function buildDailySummaryEmail(
  business: Business,
  summary: SalesSummary,
  from: { email: string; name?: string },
): EmailMessage {
  const { totalSales, unitsSold, profit, margin } = summary;
  const top = summary.byFlavor.slice(0, 3)
    .map((f) => `  • ${f.flavorName}: ${f.units} paletas · ${formatMoney(f.revenue, business.currency)}`)
    .join("\n");

  return {
    to: business.alertEmail!,
    from,
    subject: `📊 Resumen de ayer · ${formatMoney(totalSales, business.currency)} en ventas`,
    html: shell(`
      <h2 style="margin:0 0 16px;color:#4B3832;font-size:18px">Resumen del día 📊</h2>
      <table style="width:100%;border-collapse:separate;border-spacing:8px;font-size:14px">
        <tr>
          <td style="background:#E7F8F7;border-radius:14px;padding:14px;text-align:center">
            <div style="color:#75645E;font-size:12px">Ventas</div>
            <div style="font-size:20px;font-weight:bold;color:#159E9B">${formatMoney(totalSales, business.currency)}</div>
          </td>
          <td style="background:#FFE9EF;border-radius:14px;padding:14px;text-align:center">
            <div style="color:#75645E;font-size:12px">Ganancia</div>
            <div style="font-size:20px;font-weight:bold;color:#D63A6A">${formatMoney(profit, business.currency)}</div>
          </td>
        </tr>
        <tr>
          <td style="background:#FFF6DC;border-radius:14px;padding:14px;text-align:center">
            <div style="color:#75645E;font-size:12px">Paletas vendidas</div>
            <div style="font-size:20px;font-weight:bold;color:#B8860B">${unitsSold}</div>
          </td>
          <td style="background:#EAF6DE;border-radius:14px;padding:14px;text-align:center">
            <div style="color:#75645E;font-size:12px">Margen</div>
            <div style="font-size:20px;font-weight:bold;color:#5A9E2F">${margin}%</div>
          </td>
        </tr>
      </table>
      <h3 style="margin:16px 0 8px;color:#4B3832;font-size:15px">Sabores más vendidos 🏆</h3>
      <pre style="font-family:Arial;font-size:14px;color:#4B3832;margin:0">${top}</pre>
      <p style="margin:18px 0 0;color:#75645E;font-size:13px">
        Abre la app para ver el reporte completo y las ventas por ubicación. ☀️
      </p>
    `),
    text: `Resumen de ayer\n\nVentas: ${formatMoney(totalSales, business.currency)}\nGanancia: ${formatMoney(profit, business.currency)}\nPaletas vendidas: ${unitsSold}\nMargen: ${margin}%\n\nSabores más vendidos:\n${top}`,
  };
}

/**
 * Orquesta la alerta diaria: stock bajo + resumen de ayer.
 * Devuelve cuántos emails se intentaron enviar (0 si no está configurado).
 */
export async function runDailyAlerts(input: DailyAlertInput & { sender: EmailSender }): Promise<number> {
  const { business, inventory, summary, from, sender } = input;
  let sent = 0;

  if (!business.alertEmail) return 0;

  const lowStock = buildLowStockEmail(business, inventory, from);
  if (lowStock) {
    await sender.send(lowStock);
    sent += 1;
  }

  const daily = buildDailySummaryEmail(business, summary, from);
  await sender.send(daily);
  sent += 1;

  return sent;
}
