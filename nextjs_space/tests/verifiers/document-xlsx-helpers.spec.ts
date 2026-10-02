// filepath: tests/verifiers/document-xlsx-helpers.spec.ts
// Verifier para los helpers xlsx compartidos (readWorkbook, setVal,
// setIfEmpty, todayAsExcelSerial, writeWorkbook, numeroALetrasCOP).

import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as XLSX from "xlsx";
import {
  readWorkbook,
  getSheet,
  setVal,
  setIfEmpty,
  todayAsExcelSerial,
  writeWorkbook,
  numeroALetrasCOP,
} from "@/lib/document-generator/fillers/xlsx-helpers";

const SNAPSHOTS = path.join(
  process.cwd(),
  "src/lib/document-generator/formatos-snapshots",
);

async function load(name: string): Promise<Buffer> {
  return await fs.readFile(path.join(SNAPSHOTS, name));
}

/** Crea un workbook vacío en memoria (WorkBook) — útil para tests sin I/O. */
function newEmptyWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    [null, null, null],
    [null, null, null],
  ]);
  wb.Sheets["Sheet1"] = ws;
  wb.SheetNames.push("Sheet1");
  return wb;
}

describe("xlsx-helpers — setVal preserva fórmulas", () => {
  it("asignar valor a celda sin fórmula crea cell nuevo", () => {
    const ws = newEmptyWorkbook().Sheets["Sheet1"]!;
    setVal(ws, "A1", "hola");
    expect(ws["A1"].v).toBe("hola");
    expect(ws["A1"].t).toBe("s");
  });

  it("asignar número crea cell tipo 'n'", () => {
    const ws = newEmptyWorkbook().Sheets["Sheet1"]!;
    setVal(ws, "A1", 42);
    expect(ws["A1"].v).toBe(42);
    expect(ws["A1"].t).toBe("n");
  });

  it("asignar valor a celda CON fórmula solo cambia v, deja f intacta", async () => {
    const bytes = await load("OC.xlsx");
    const wb = readWorkbook(bytes);
    const ws = getSheet(wb);
    // OC tiene fórmula en L19 (=I19*G19)
    const before = ws["L19"];
    expect(before).toBeDefined();
    expect(before.f).toBeDefined();
    const originalFormula = before.f;
    setVal(ws, "L19", 99999);
    expect(ws["L19"].v).toBe(99999);
    expect(ws["L19"].f).toBe(originalFormula); // ¡fórmula intacta!
  }, 20_000);
});

describe("xlsx-helpers — setIfEmpty", () => {
  it("rellena celda vacía", () => {
    const ws = newEmptyWorkbook().Sheets["Sheet1"]!;
    setIfEmpty(ws, "A1", "default");
    expect(ws["A1"].v).toBe("default");
  });

  it("NO sobrescribe celda con valor", () => {
    const ws = newEmptyWorkbook().Sheets["Sheet1"]!;
    setVal(ws, "A1", "existente");
    setIfEmpty(ws, "A1", "nuevo");
    expect(ws["A1"].v).toBe("existente");
  });
});

describe("xlsx-helpers — todayAsExcelSerial", () => {
  it("2026-01-01 → 46023 (serial Excel conocido)", () => {
    const serial = todayAsExcelSerial("2026-01-01");
    expect(serial).toBe(46023);
  });
  it("2026-09-29 (hoy del test) → serial > 0", () => {
    expect(todayAsExcelSerial("2026-09-29")).toBeGreaterThan(46000);
  });
});

describe("xlsx-helpers — numeroALetrasCOP", () => {
  it("0 → 'CERO PESOS M/CTE'", () => {
    expect(numeroALetrasCOP(0)).toBe("CERO PESOS M/CTE");
  });
  it("100000 → contiene '100 MIL'", () => {
    expect(numeroALetrasCOP(100_000)).toContain("100 MIL");
  });
  it("1234567 → contiene MILLONES y MIL", () => {
    const out = numeroALetrasCOP(1_234_567);
    expect(out).toContain("1 MILLONES");
    expect(out).toContain("234 MIL");
  });
});

describe("xlsx-helpers — readWorkbook + writeWorkbook roundtrip", () => {
  it("lee plantilla real, modifica celda, escribe y re-lee", async () => {
    const bytes = await load("AD-0033.xlsx");
    const wb = readWorkbook(bytes);
    const ws = getSheet(wb);
    setVal(ws, "B7", "PROBANDO_ROUNDTRIP");
    const out = writeWorkbook(wb);
    expect(out.length).toBeGreaterThan(1000);
    // Re-leer
    const wb2 = readWorkbook(out);
    const ws2 = getSheet(wb2);
    expect(ws2["B7"].v).toBe("PROBANDO_ROUNDTRIP");
  });
});
