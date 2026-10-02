// filepath: tests/verifiers/document-filler-xlsx.spec.ts
// Verifiers de los fillers xlsx (anticipo, legalizacion, os, corte, ausencia).
// Refactor F2: cada filler consume el row de la BD normalizado (camelCase).
//
// Estrategia: cargar la plantilla real, aplicar el filler con un row
// sintético, re-leer y verificar que las celdas clave tienen los valores.

import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { anticipoFiller } from "@/lib/document-generator/fillers/anticipo";
import { legalizacionFiller } from "@/lib/document-generator/fillers/legalizacion";
import { osFiller } from "@/lib/document-generator/fillers/os";
import { corteFiller } from "@/lib/document-generator/fillers/corte";
import type { FillerContext } from "@/lib/document-generator/fillers/types";
import {
  readWorkbook,
  getSheet,
} from "@/lib/document-generator/fillers/xlsx-helpers";
import type {
  AnticipoRow,
  LegalizacionRow,
  OsRow,
  CorteRow,
} from "@/lib/document-generator/fillers/entity-data";

const SNAPSHOTS = path.join(
  process.cwd(),
  "src/lib/document-generator/formatos-snapshots",
);
const TIMEOUT = 20_000;

async function load(name: string): Promise<Buffer> {
  return await fs.readFile(path.join(SNAPSHOTS, name));
}

function ctxBase(): FillerContext {
  return {
    templateBytes: Buffer.alloc(0),
    data: {},
    context: {
      project: {
        code: "P001",
        name: "Edificio Aurora",
        client: "Consorcio Norte S.A.S",
        location: "Cl. 5 # 24 A-91 CALI",
      },
      provider: {
        name: "Suministros del Valle",
        nit: "900.123.456-7",
        email: "ventas@sdv.co",
        phone: "602 555 1234",
      },
      today: "2026-09-29",
    },
  };
}

// ─── ANTICIPO ──────────────────────────────────────────────────────

describe("document-generator/fillers/anticipo", () => {
  it(
    "rellena beneficiario, monto y justificación desde row de payment_requests",
    async () => {
      const row: AnticipoRow = {
        type: "ANTICIPO",
        amount: 5_000_000,
        beneficiaryName: "Suministros del Valle",
        beneficiaryNit: "900.123.456-7",
        bankName: "Bancolombia",
        accountType: "SAVINGS",
        accountNumber: "123-456789-00",
        description: "Cimentación fase 1\nMateriales y mano de obra",
        requestNumber: "PAY-001",
      };
      const ctx = ctxBase();
      ctx.templateBytes = await load("AD-0033.xlsx");
      ctx.data = row;
      const r = await anticipoFiller(ctx);
      expect(r.content.length).toBeGreaterThan(1000);
      const wb = readWorkbook(r.content);
      const ws = getSheet(wb);
      expect(ws["B7"]?.v).toBe("Suministros del Valle");
      expect(ws["D7"]?.v).toBe("900.123.456-7");
      expect(ws["B12"]?.v).toBe("900.123.456-7");
      expect(ws["B22"]?.v).toBe(5_000_000);
    },
    TIMEOUT,
  );

  it(
    "monto en letras se calcula correctamente",
    async () => {
      const row: AnticipoRow = {
        type: "ANTICIPO",
        amount: 1_500_000,
        beneficiaryName: "Suministros del Valle",
        beneficiaryNit: "900.123.456-7",
        bankName: "Bancolombia",
        accountType: "SAVINGS",
        accountNumber: "123-456789-00",
        description: "Acero de refuerzo",
      };
      const ctx = ctxBase();
      ctx.templateBytes = await load("AD-0033.xlsx");
      ctx.data = row;
      const r = await anticipoFiller(ctx);
      const wb = readWorkbook(r.content);
      const ws = getSheet(wb);
      expect(ws["E22"]?.v).toContain("1 MILLONES");
      expect(ws["E22"]?.v).toContain("500 MIL");
    },
    TIMEOUT,
  );
});

// ─── LEGALIZACION ──────────────────────────────────────────────────

describe("document-generator/fillers/legalizacion", () => {
  it(
    "rellena beneficiario + monto en fila 7 y preserva fórmulas SUM en fila 16",
    async () => {
      const row: LegalizacionRow = {
        type: "LEGALIZACION",
        amount: 22_200,
        beneficiaryName: "BBI Colombia",
        beneficiaryNit: "900860284-9",
        bankName: "Bancolombia",
        accountNumber: "123-456789-00",
        description: "Desayunos",
      };
      const ctx = ctxBase();
      ctx.templateBytes = await load("LEG.xlsx");
      ctx.data = row;
      const r = await legalizacionFiller(ctx);
      expect(r.content.length).toBeGreaterThan(1000);
      const wb = readWorkbook(r.content);
      const ws = getSheet(wb);
      expect(ws["B7"]?.v).toBe("BBI Colombia");
      expect(ws["C7"]?.v).toBe("900860284-9");
      expect(ws["E7"]?.v).toBe("Desayunos");
      expect(ws["F7"]?.v).toBe(22_200);
      expect(ws["F16"]?.f).toBe("SUM(F7:F15)");
      expect(ws["G16"]?.f).toBe("SUM(G7:G14)");
      expect(ws["H16"]?.f).toBe("SUM(H7:H15)");
    },
    TIMEOUT,
  );
});

// ─── OS ────────────────────────────────────────────────────────────

describe("document-generator/fillers/os", () => {
  it(
    "rellena proveedor, descripción, monto en fila 19 y NOTA 2",
    async () => {
      const row: OsRow = {
        type: "ORDEN_SERVICIO_POLIZAS",
        expenseNumber: "EXP-OS-9999",
        description: "Traslado de camión",
        amount: 1_600_000,
        hasPolizas: true,
        cotizacionAprobada: true,
      };
      const ctx = ctxBase();
      ctx.templateBytes = await load("OS.xlsx");
      ctx.data = row;
      const r = await osFiller(ctx);
      expect(r.content.length).toBeGreaterThan(1000);
      const wb = readWorkbook(r.content);
      const ws = getSheet(wb);
      expect(ws["B19"]?.v).toBe(1);
      expect(ws["C19"]?.v).toBe("Traslado de camión");
      expect(ws["AC19"]?.v).toBe(1);
      expect(ws["AJ19"]?.v).toBe(1_600_000);
      expect(ws["B26"]?.v).toContain("Contado");
    },
    TIMEOUT,
  );
});

// ─── CORTE ─────────────────────────────────────────────────────────

describe("document-generator/fillers/corte", () => {
  it(
    "rellena encabezado + item + resumen financiero desde work_cuts",
    async () => {
      const row: CorteRow = {
        cutNumber: "CUT-001",
        description: "Cimentación fase 1",
        grossValue: 27_000_000,
        retentionPercent: 10,
        retentionValue: 2_700_000,
        advanceDeduction: 12_500_000,
        netValue: 11_800_000,
        periodStart: "2026-09-01",
        periodEnd: "2026-09-30",
        providerName: "Constructora XYZ",
      };
      const ctx = ctxBase();
      ctx.templateBytes = await load("CORTE.xlsx");
      ctx.data = row;
      const r = await corteFiller(ctx);
      expect(r.content.length).toBeGreaterThan(1000);
      const wb = readWorkbook(r.content);
      const ws = getSheet(wb);
      expect(ws["C2"]?.v).toBe("Edificio Aurora");
      expect(ws["H2"]?.v).toBe("CUT-001");
      expect(ws["C6"]?.v).toBe("Cimentación fase 1");
      expect(ws["E6"]?.v).toBe("GLB");
      expect(ws["G14"]?.v).toBe(12_500_000);
      expect(ws["H26"]?.v).toBe(11_800_000);
    },
    TIMEOUT,
  );
});

// ─── AUSENCIA (stub) ──────────────────────────────────────────────

describe("document-generator/fillers/ausencia", () => {
  it("lanza error NOT_IMPLEMENTED (PDF escaneado)", async () => {
    const { ausenciaFiller } =
      await import("@/lib/document-generator/fillers/ausencia");
    const ctx = ctxBase();
    ctx.templateBytes = await load("AUSENCIA.pdf");
    await expect(ausenciaFiller(ctx)).rejects.toThrow(
      /AUSENCIA_FILLER_NOT_IMPLEMENTED/,
    );
  });
});
