// filepath: tests/verifiers/document-filler-oc.spec.ts
// Verifier del filler OC — Refactor F2.
// Usa OcRow (row de `expenses` con type ORDEN_COMPRA_*).
//
// Usa la plantilla real copiada a src/lib/document-generator/formatos-snapshots/OC.xlsx
// para que el test no dependa de rutas externas.
//
// NOTA DE PERFORMANCE: XLSX.write con cellStyles:true tarda ~3-5s por test
// en Windows (el archivo OC.xlsx tiene 504KB con muchos estilos). Usamos
// timeout de 20s por test para no depender del default de 5s.

import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as XLSX from "xlsx";
import { ocFiller } from "@/lib/document-generator/fillers/oc";
import type { FillerContext } from "@/lib/document-generator/fillers/types";
import type { OcRow } from "@/lib/document-generator/fillers/entity-data";

const TIMEOUT = 20_000;

const SNAPSHOTS = path.join(
  process.cwd(),
  "src/lib/document-generator/formatos-snapshots",
);

async function loadOcTemplate(): Promise<Buffer> {
  return await fs.readFile(path.join(SNAPSHOTS, "OC.xlsx"));
}

function buildContext(): FillerContext {
  return {
    templateBytes: Buffer.alloc(0),
    data: {},
    context: {
      project: {
        code: "P001",
        name: "Edificio Aurora",
        client: "Consorcio Norte",
        location: "Cl. 5 # 24 A-91 CALI",
      },
      provider: {
        name: "Suministros del Valle S.A.S",
        nit: "900.123.456-7",
        email: "ventas@sdv.co",
        phone: "602 555 1234",
      },
      today: "2026-09-29",
    },
  };
}

function rowBase(overrides: Partial<OcRow> = {}): OcRow {
  return {
    type: "ORDEN_COMPRA_SIN_POLIZAS",
    expenseNumber: "EXP-OC-TEST",
    description: "X",
    amount: 100,
    ...overrides,
  };
}

describe("document-generator/fillers/oc", () => {
  it(
    "genera un xlsx con tamaño > 0",
    async () => {
      const ctx = buildContext();
      ctx.templateBytes = await loadOcTemplate();
      ctx.data = rowBase({
        description: "Cuñete pintura epóxica",
        amount: 701_680,
      });
      const result = await ocFiller(ctx);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.mimetype).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
    },
    TIMEOUT,
  );

  it(
    "preserva las fórmulas L<r>, O<r>, S<r> tras regenerar",
    async () => {
      const ctx = buildContext();
      ctx.templateBytes = await loadOcTemplate();
      ctx.data = rowBase({
        description: "Cuñete pintura",
        amount: 701_680,
      });
      const result = await ocFiller(ctx);
      const wb = XLSX.read(result.content, {
        type: "buffer",
        cellFormula: true,
      });
      const ws = wb.Sheets[wb.SheetNames[0]!]!;
      expect(ws["L19"]?.f, "L19 debería tener fórmula").toBeDefined();
      expect(ws["L22"]?.f, "L22 debería tener fórmula =SUM").toBeDefined();
      expect(ws["S19"]?.f, "S19 debería tener fórmula").toBeDefined();
    },
    TIMEOUT,
  );

  it(
    "escribe el nombre del proyecto en G9 (OBRA)",
    async () => {
      const ctx = buildContext();
      ctx.templateBytes = await loadOcTemplate();
      ctx.data = rowBase();
      const result = await ocFiller(ctx);
      const wb = XLSX.read(result.content, {
        type: "buffer",
        cellFormula: true,
      });
      const ws = wb.Sheets[wb.SheetNames[0]!]!;
      expect(ws["G9"]?.v).toBe("Edificio Aurora");
    },
    TIMEOUT,
  );

  it(
    "escribe el NIT del proveedor en G11 (IDENTIFICACION)",
    async () => {
      const ctx = buildContext();
      ctx.templateBytes = await loadOcTemplate();
      ctx.data = rowBase();
      const result = await ocFiller(ctx);
      const wb = XLSX.read(result.content, {
        type: "buffer",
        cellFormula: true,
      });
      const ws = wb.Sheets[wb.SheetNames[0]!]!;
      expect(ws["G11"]?.v).toBe("900.123.456-7");
    },
    TIMEOUT,
  );

  it(
    "escribe la descripción del row en H19 (item principal)",
    async () => {
      const ctx = buildContext();
      ctx.templateBytes = await loadOcTemplate();
      ctx.data = rowBase({
        description: "Cementos Argos x 50 bultos",
        amount: 1_200_000,
      });
      const result = await ocFiller(ctx);
      const wb = XLSX.read(result.content, {
        type: "buffer",
        cellFormula: true,
      });
      const ws = wb.Sheets[wb.SheetNames[0]!]!;
      expect(ws["H19"]?.v).toBe("Cementos Argos x 50 bultos");
      expect(ws["I19"]?.v).toBe(1);
      expect(ws["R19"]?.v).toBe(1_200_000);
    },
    TIMEOUT,
  );

  it(
    "escribe 'Forma de pago: Contado' en C28",
    async () => {
      const ctx = buildContext();
      ctx.templateBytes = await loadOcTemplate();
      ctx.data = rowBase();
      const result = await ocFiller(ctx);
      const wb = XLSX.read(result.content, {
        type: "buffer",
        cellFormula: true,
      });
      const ws = wb.Sheets[wb.SheetNames[0]!]!;
      expect(String(ws["C28"]?.v ?? "")).toContain("Forma de pago");
    },
    TIMEOUT,
  );
});
