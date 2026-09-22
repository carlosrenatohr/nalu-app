import { describe, expect, it } from "vitest";
import { createMemoryDb } from "../../src/db";
import { checkIntegrity } from "../../src/db/integrity";

// ---------------------------------------------------------------------
// Verificación de integridad local: una base sana pasa limpia y los
// huérfanos que violan claves foráneas se reportan como problema.
// ---------------------------------------------------------------------

describe("checkIntegrity", () => {
  it("una base sana (con semilla) pasa sin problemas", () => {
    const { conn } = createMemoryDb(true);
    try {
      const result = checkIntegrity(conn);
      expect(result.ok).toBe(true);
      expect(result.problems).toEqual([]);
    } finally {
      conn.close();
    }
  });

  it("detecta registros huérfanos que violan claves foráneas", () => {
    const { conn } = createMemoryDb(false);
    try {
      // Tablas propias con FK y una fila que apunta a un padre inexistente.
      conn.exec("CREATE TABLE parent (id TEXT PRIMARY KEY)");
      conn.exec("CREATE TABLE child (id TEXT PRIMARY KEY, parent_id TEXT NOT NULL REFERENCES parent(id))");
      conn.exec("PRAGMA foreign_keys = OFF;");
      conn.prepare("INSERT INTO child (id, parent_id) VALUES ('c1', 'ghost')").run();

      const result = checkIntegrity(conn);
      expect(result.ok).toBe(false);
      expect(result.problems.join(" ")).toContain("child");
    } finally {
      conn.close();
    }
  });
});
