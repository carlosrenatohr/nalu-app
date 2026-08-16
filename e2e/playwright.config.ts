// ---------------------------------------------------------------------
// Configuración de Playwright para los tests e2e de Nalu.
//
// Los e2e arrancan ambos servidores automáticamente:
//   1. API local (Express + node:sqlite) en :3002 con una base LIMPIA
//      (backend/data/e2e.db) para que cada ejecución sea determinista.
//   2. Frontend (Vite dev) en :5173 con proxy /api → :3002.
//
// Requisito: no tener `pnpm dev` corriendo (puertos en uso estrictos).
// ---------------------------------------------------------------------
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  fullyParallel: false, // flujos que escriben en la misma BD → secuencial
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      // IMPORTANTE: Playwright arranca los webServers ANTES de globalSetup,
      // así que la limpieza de la base debe ocurrir aquí (antes de abrirla),
      // no en global-setup: borrar el archivo con el server abierto deja la
      // BD en un inode desvinculado donde las escrituras fallan.
      command:
        "rm -f data/e2e.db data/e2e.db-wal data/e2e.db-shm && pnpm exec tsx src/server.ts",
      cwd: "../backend",
      url: "http://localhost:3002/api/health",
      timeout: 60_000,
      reuseExistingServer: false,
      // Base limpia y puerto fijo para los e2e.
      env: { ...process.env, DB_PATH: "data/e2e.db", PORT: "3002" },
    },
    {
      command: "pnpm exec vite --port 5173 --strictPort",
      cwd: "../frontend",
      url: "http://localhost:5173",
      timeout: 60_000,
      reuseExistingServer: false,
    },
  ],
});
