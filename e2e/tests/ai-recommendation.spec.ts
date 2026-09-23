// ---------------------------------------------------------------------
// Tests e2e de la tarjeta ✨ de recomendación IA (Jev / System One).
//
// La tarjeta vive en el inventario, acepta cambiar la ventana de días y,
// al analizar, muestra SIEMPRE uno de tres estados definidos:
//   1. Recomendación real (probabilidades de Jev) — local con API key,
//   2. Aviso de datos insuficientes,
//   3. Error amigable (p. ej. sin API key en CI).
// Nunca un estado colgado, nunca un stack trace y sin romper la app.
// No dependemos del proveedor externo: el test acepta los tres caminos.
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

test.describe("Recomendación IA de inventario", () => {
  test("la tarjeta vive en el inventario con su selector de ventana", async ({ page }) => {
    await login(page);
    await page.goto("/inventory");

    await expect(page.getByRole("heading", { name: "Recomendación IA" })).toBeVisible();
    await expect(page.getByText(/Jev analiza tu inventario y ventas recientes/)).toBeVisible();
    await expect(page.getByRole("group", { name: "Ventana de análisis" })).toBeVisible();
    await expect(page.getByRole("button", { name: "7 días" })).toBeVisible();
    await expect(page.getByRole("button", { name: "30 días" })).toBeVisible();
    await expect(page.getByRole("button", { name: "90 días" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Analizar inventario/ })).toBeVisible();
  });

  test("analizar muestra un estado definido y la app sigue funcionando", async ({ page }) => {
    await login(page);
    await page.goto("/inventory");
    await page.getByRole("button", { name: /Analizar inventario/ }).click();

    // Uno de los tres desenlaces válidos (el proveedor puede fallar o
    // faltar la API key en CI): recomendación, datos insuficientes o error.
    const success = page.getByText("Probabilidades de Jev");
    const insufficient = page.getByText(/Aún no hay una recomendación clara/);
    // Cualquier código de error (429, timeout, no configurado…) muestra
    // copia específica + el botón de reintento: ese botón marca el fallo.
    const failed = page.getByRole("button", { name: /Reintentar/ });
    await expect(success.or(insufficient).or(failed)).toBeVisible({ timeout: 20_000 });

    // Con recomendación real se ven sabor + confianza de Jev.
    if (await success.isVisible()) {
      await expect(page.getByText("Confianza de Jev")).toBeVisible();
      await expect(page.getByRole("progressbar")).toBeVisible();
      await expect(page.getByRole("button", { name: /Analizar nuevamente/ })).toBeVisible();
    }

    // La app no se rompe: el listado de inventario sigue visible.
    await expect(page.getByText("Coco").first()).toBeVisible();

    // Nunca se filtra un stack trace en la UI.
    await expect(page.getByText(/at .*\.ts:\d+/)).toHaveCount(0);
  });

  test("el toggle oculta y muestra la tarjeta sin romper la página", async ({ page }) => {
    await login(page);
    await page.goto("/inventory");

    const hideToggle = page.getByRole("button", { name: /Ocultar recomendación de Jev/ });
    await expect(hideToggle).toHaveAttribute("aria-expanded", "true");

    await hideToggle.click();
    await expect(
      page.getByRole("button", { name: /Mostrar recomendación de Jev/ }),
    ).toHaveAttribute("aria-expanded", "false");
    // La página sigue operable: el listado de inventario se ve igual.
    await expect(page.getByText("Coco").first()).toBeVisible();

    await page.getByRole("button", { name: /Mostrar recomendación de Jev/ }).click();
    await expect(page.getByRole("group", { name: "Ventana de análisis" })).toBeVisible();
  });
});
