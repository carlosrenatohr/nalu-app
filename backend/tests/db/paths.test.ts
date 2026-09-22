import { describe, expect, it } from "vitest";
import { isAbsolute } from "node:path";
import { REPO_ROOT, resolveDbPath } from "../../src/db/paths";

// ---------------------------------------------------------------------
// Resolvedor de rutas de los CLI de BD: `pnpm --filter` ejecuta los
// scripts con cwd = backend/, así que las rutas relativas del usuario
// (invocado desde la raíz) deben poder resolverse desde el repo.
// ---------------------------------------------------------------------

describe("resolveDbPath", () => {
  it("las rutas absolutas se devuelven tal cual", () => {
    expect(resolveDbPath("/tmp/abs.db")).toBe("/tmp/abs.db");
  });

  it("una ruta existente dentro de backend/ se resuelve contra backend/", () => {
    // package.json siempre existe en backend/ (cwd de los tests).
    const resolved = resolveDbPath("package.json");
    expect(isAbsolute(resolved)).toBe(true);
    expect(resolved.endsWith("backend/package.json")).toBe(true);
  });

  it("una ruta existente solo en la raíz se resuelve contra el repo", () => {
    // pnpm-workspace.yaml vive solo en la raíz del monorepo.
    const resolved = resolveDbPath("pnpm-workspace.yaml");
    expect(resolved).toBe(`${REPO_ROOT}/pnpm-workspace.yaml`);
  });

  it("una ruta inexistente cae relativa a la raíz del repo", () => {
    expect(resolveDbPath("backups/nada.db")).toBe(`${REPO_ROOT}/backups/nada.db`);
  });
});
