import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { backupLocal } from "../../src/db/backup-local";
import { checkIntegrity } from "../../src/db/integrity";

// ---------------------------------------------------------------------
// Respaldo local: instantánea consistente (VACUUM INTO) que se puede
// abrir y verificar con checkIntegrity; falla limpio sin origen.
// ---------------------------------------------------------------------

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "nalu-backup-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("backupLocal", () => {
  it("crea una instantánea consistente, íntegra y verificable", () => {
    const source = join(dir, "nalu.db");
    const origin = new DatabaseSync(source);
    origin.exec("CREATE TABLE t (id TEXT PRIMARY KEY, v INTEGER)");
    origin.prepare("INSERT INTO t (id, v) VALUES ('a', 1)").run();

    const dest = join(dir, "output", "snapshot.db");
    backupLocal(source, dest);
    origin.close();

    expect(existsSync(dest)).toBe(true);

    const copy = new DatabaseSync(dest, { readOnly: true });
    try {
      const row = copy.prepare("SELECT v FROM t WHERE id = 'a'").get() as { v: number };
      expect(row.v).toBe(1);
      expect(checkIntegrity(copy).ok).toBe(true);
    } finally {
      copy.close();
    }
  });

  it("falla si la base de origen no existe (no la inventa)", () => {
    expect(() => backupLocal(join(dir, "no-existe.db"), join(dir, "out", "x.db"))).toThrow();
    expect(existsSync(join(dir, "out", "x.db"))).toBe(false);
  });

  it("falla si el destino ya existe (nunca pisa un respaldo)", () => {
    const source = join(dir, "nalu.db");
    const origin = new DatabaseSync(source);
    origin.exec("CREATE TABLE t (id TEXT PRIMARY KEY)");
    origin.close();

    const dest = join(dir, "snapshot.db");
    backupLocal(source, dest);
    expect(() => backupLocal(source, dest)).toThrow();
  });
});
