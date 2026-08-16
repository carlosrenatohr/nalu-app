// ---------------------------------------------------------------------
// Tests de las alertas por email (stock bajo + resumen diario).
// Los builders son funciones puras: se prueban sin depender de envíos.
// ---------------------------------------------------------------------
import { describe, expect, it } from "vitest";
import {
  buildLowStockEmail,
  buildDailySummaryEmail,
  runDailyAlerts,
  type SalesSummary,
} from "../../src/services/alerts.service";
import type { Business, FlavorInventory } from "../../src/domain/types";

const business: Business = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Nalu",
  currency: "NIO",
  defaultPurchaseCost: 28,
  defaultHomePrice: 60,
  primaryColor: "#36C9C6",
  secondaryColor: "#FF6F91",
  contact: "Hola Nalu",
  reportFooter: "¡Gracias por tu compra!",
  alertEmail: "dueno@nalu.example",
  createdAt: "2026-08-15T00:00:00.000Z",
  updatedAt: "2026-08-15T00:00:00.000Z",
};

const from = { email: "alertas@nalu.example", name: "Nalu" };

function flavorInv(name: string, available: number, minStock: number): FlavorInventory {
  return {
    flavor: {
      id: `id-${name}`,
      businessId: business.id,
      name,
      slug: name.toLowerCase(),
      emoji: "🍦",
      color: null,
      minStock,
      active: true,
      createdAt: "",
      updatedAt: "",
    },
    available,
    lastCost: 28,
    purchased: 10,
    sold: 0,
    gifted: 0,
    personalUse: 0,
    lost: 0,
    adjusted: 0,
    returned: 0,
    value: 0,
    lowStock: available <= minStock,
  };
}

const summary: SalesSummary = {
  totalSales: 780,
  unitsSold: 13,
  profit: 416,
  margin: 53.3,
  byFlavor: [
    { flavorId: "a", flavorName: "Coco", units: 10, revenue: 600, cost: 280 },
    { flavorId: "b", flavorName: "Oreo", units: 3, revenue: 180, cost: 84 },
  ],
};

describe("buildLowStockEmail", () => {
  it("genera el email solo si hay sabores con stock bajo", () => {
    const email = buildLowStockEmail(
      business,
      [flavorInv("Coco", 4, 10), flavorInv("Oreo", 12, 10)],
      from,
    );
    expect(email).not.toBeNull();
    expect(email!.subject).toContain("1 sabor");
    expect(email!.html).toContain("Coco");
    expect(email!.text).toContain("Coco");
    expect(email!.to).toBe("dueno@nalu.example");
  });

  it("devuelve null sin stock bajo o sin email configurado", () => {
    const sinStockBajo = buildLowStockEmail(
      business,
      [flavorInv("Oreo", 12, 10)],
      from,
    );
    expect(sinStockBajo).toBeNull();

    const sinEmail = buildLowStockEmail(
      { ...business, alertEmail: null },
      [flavorInv("Coco", 4, 10)],
      from,
    );
    expect(sinEmail).toBeNull();
  });
});

describe("buildDailySummaryEmail", () => {
  it("incluye ventas, ganancia, unidades y sabores más vendidos", () => {
    const email = buildDailySummaryEmail(business, summary, from);
    expect(email.subject).toContain("780");
    expect(email.html).toContain("416");
    expect(email.text).toContain("13");
    expect(email.text).toContain("Coco");
  });
});

describe("runDailyAlerts", () => {
  it("envía stock bajo + resumen cuando hay alertas y no envía nada sin email", async () => {
    const sent: string[] = [];
    const sender = { send: async (m: { subject: string }) => { sent.push(m.subject); } };

    const count = await runDailyAlerts({
      business,
      inventory: [flavorInv("Coco", 4, 10)],
      summary,
      from,
      sender,
    });
    expect(count).toBe(2);
    expect(sent).toHaveLength(2);

    const countSinEmail = await runDailyAlerts({
      business: { ...business, alertEmail: null },
      inventory: [flavorInv("Coco", 4, 10)],
      summary,
      from,
      sender,
    });
    expect(countSinEmail).toBe(0);
    expect(sent).toHaveLength(2); // no se envió nada extra
  });
});
