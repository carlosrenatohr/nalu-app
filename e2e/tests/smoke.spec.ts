// ---------------------------------------------------------------------
// Tests e2e básicos de Nalu.
//
// Cubren el flujo crítico del negocio de punta a punta:
//   1. La API responde (health, pública).
//   2. Login con PIN (1234 de la semilla) y dashboard con sus stats.
//   3. Venta rápida: elegir ubicación → sumar sabores → confirmar →
//      la venta queda registrada y se ve en la lista.
//   4. Inventario: sabores con su disponibilidad.
//
// Nota: la base e2e se limpia en el comando del webServer, así que
// siempre partimos de los datos semilla (PIN 1234, sabores, precios).
// Cada test abre un contexto nuevo (sin sesión) → hace login.
// ---------------------------------------------------------------------
import { test, expect, type Page } from "@playwright/test";

const PIN = "1234";

/** Inicia sesión con el PIN de la semilla y espera el dashboard. */
async function login(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByLabel("PIN de acceso").fill(PIN);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: /¡Hola/ })).toBeVisible();
}

test.describe("Smoke básico de Nalu", () => {
  test("la API responde en /api/health (público)", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("el login rechaza un PIN incorrecto", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("PIN de acceso").fill("0000");
    await page.getByRole("button", { name: "Entrar" }).click();
    // El toast de error aparece y seguimos en la pantalla de login
    await expect(page.getByText(/PIN incorrecto|No se pudo iniciar/)).toBeVisible();
    await expect(page.getByLabel("PIN de acceso")).toBeVisible();
  });

  test("el dashboard carga estadísticas y acciones tras el login", async ({ page }) => {
    await login(page);

    // Tarjetas de estadísticas del día. "Ventas de hoy" aparece dos veces
    // (tarjeta de stats + sección de ventas recientes) → tomamos la primera.
    await expect(page.getByText("Ventas de hoy").first()).toBeVisible();
    await expect(page.getByText("Ganancia de hoy")).toBeVisible();

    // Acciones rápidas principales
    await expect(page.getByRole("button", { name: "Registrar venta" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrar compra" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrar salida" })).toBeVisible();
  });

  test("venta rápida end-to-end (ubicación → sabores → confirmar)", async ({ page }) => {
    await login(page);

    // Entrar al flujo de venta desde la acción dominante del dashboard
    await page.getByRole("button", { name: "Registrar venta" }).click();
    await expect(page.getByRole("heading", { name: "Venta rápida ⚡" })).toBeVisible();

    // 1) Elegir ubicación (semilla: Casa, Puesto, Otro)
    await page.getByRole("radio", { name: "Casa" }).click();

    // 2) Sumar 2 paletas del primer sabor con inventario disponible
    const firstFlavor = page.locator("li").filter({ has: page.getByRole("button", { name: "Agregar uno" }) }).first();
    const addButton = firstFlavor.getByRole("button", { name: "Agregar uno" });
    await addButton.click();
    await addButton.click();

    // El resumen muestra la cantidad y el precio por defecto de la semilla (C$60)
    await expect(page.getByText("2 paletas")).toBeVisible();

    // 3) Confirmar la venta → redirige a la lista de ventas
    await page.getByRole("button", { name: "Confirmar venta" }).click();
    await expect(page).toHaveURL(/\/sales$/);

    // La venta aparece en el listado del día ("Casa" puede repetirse
    // si hay varias ventas de la semilla en la misma ubicación)
    await expect(page.getByText(/ventas ·/)).toBeVisible();
    await expect(page.getByText("Casa").first()).toBeVisible();
  });

  test("el inventario lista los sabores con su disponibilidad", async ({ page }) => {
    await login(page);
    await page.goto("/inventory");
    // Sabores de la semilla
    await expect(page.getByText("Coco")).toBeVisible();
    await expect(page.getByText("Oreo")).toBeVisible();
    // Hay al menos un sabor con unidades disponibles
    await expect(page.getByText(/disponibles/i).first()).toBeVisible();
  });
});
