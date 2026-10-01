// filepath: tests/verifiers/document-render.spec.ts
// Verifier del dispatcher render.ts — Refactor F2.
// Los fillers consumen directamente rows normalizados de la BD.

import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import {
  renderDocument,
  FILLERS,
  resolveTemplatePath,
  type RenderResult,
} from "@/lib/document-generator/render";
import type { FillerContext } from "@/lib/document-generator/fillers/types";

const SNAPSHOTS = path.join(
  process.cwd(),
  "src/lib/document-generator/formatos-snapshots",
);

const SNAPSHOT_BY_TEMPLATE: Record<string, string> = {
  OC: "OC.xlsx",
  "AD-0033": "AD-0033.xlsx",
  LEG: "LEG.xlsx",
  OS: "OS.xlsx",
  CORTE: "CORTE.xlsx",
  AUSENCIA: "AUSENCIA.pdf",
  CONT_GLOBAL: "CONT_GLOBAL.docx",
  CONT_UNITARIO: "CONT_UNITARIO.docx",
  CONT_DISENOS: "CONT_DISENOS.docx",
  CONT_LABORAL: "CONT_LABORAL.docx",
};

async function load(name: string): Promise<Buffer> {
  return await fs.readFile(path.join(SNAPSHOTS, name));
}

function snapshotLoader(): (p: string) => Promise<Buffer> {
  return async (p: string) => {
    const base = path.basename(p);
    for (const [tplId, snapName] of Object.entries(SNAPSHOT_BY_TEMPLATE)) {
      const realName = resolveTemplatePath(tplId as never, "/x")
        .split(/[\\/]/)
        .pop();
      if (realName === base) return await load(snapName);
    }
    return await load(base);
  };
}

function err(r: RenderResult): { code: string; reason?: string } {
  if (r.ok === true) throw new Error("expected error");
  return (r as { error: { code: string; reason?: string } }).error;
}

const ctxBase: FillerContext["context"] = {
  project: {
    code: "P001",
    name: "Edificio Aurora",
    client: "Consorcio Norte",
    location: "Cl. 5 # 24 A-91 CALI",
  },
  provider: {
    name: "Suministros del Valle",
    nit: "900.123.456-7",
    email: "ventas@sdv.co",
    phone: "602 555 1234",
  },
  today: "2026-09-29",
};

describe("FILLERS — registro de los 10 templates", () => {
  it("OC está registrado", () => expect(FILLERS.OC).toBeDefined());
  it("AD-0033 está registrado", () => expect(FILLERS["AD-0033"]).toBeDefined());
  it("LEG está registrado", () => expect(FILLERS.LEG).toBeDefined());
  it("OS está registrado", () => expect(FILLERS.OS).toBeDefined());
  it("CORTE está registrado", () => expect(FILLERS.CORTE).toBeDefined());
  it("AUSENCIA registrado pero lanza NOT_IMPLEMENTED", () => {
    expect(FILLERS.AUSENCIA).toBeDefined();
    expect(FILLERS.AUSENCIA).not.toBeNull();
  });
  it("CONT_GLOBAL está registrado", () =>
    expect(FILLERS.CONT_GLOBAL).toBeDefined());
  it("CONT_UNITARIO está registrado", () =>
    expect(FILLERS.CONT_UNITARIO).toBeDefined());
  it("CONT_DISENOS está registrado", () =>
    expect(FILLERS.CONT_DISENOS).toBeDefined());
  it("CONT_LABORAL está registrado", () =>
    expect(FILLERS.CONT_LABORAL).toBeDefined());
});

describe("resolveTemplatePath", () => {
  it("OC → .xlsx", () => {
    const p = resolveTemplatePath("OC", "/Formatos");
    expect(p).toContain("FORMATO OC_");
    expect(p.endsWith(".xlsx")).toBe(true);
  });
  it("CONT_LABORAL → .docx", () => {
    const p = resolveTemplatePath("CONT_LABORAL", "/Formatos");
    expect(p.endsWith(".docx")).toBe(true);
  });
  it("AUSENCIA → .pdf", () => {
    const p = resolveTemplatePath("AUSENCIA", "/Formatos");
    expect(p.endsWith(".pdf")).toBe(true);
  });
});

describe("renderDocument — happy path por templateId", () => {
  // Cada caso usa el shape row-BD normalizado que el filler espera.
  const cases: Array<{
    templateId:
      | "OC"
      | "AD-0033"
      | "LEG"
      | "OS"
      | "CORTE"
      | "CONT_GLOBAL"
      | "CONT_UNITARIO"
      | "CONT_DISENOS"
      | "CONT_LABORAL";
    data: unknown;
    expectedExt: "xlsx" | "docx";
  }> = [
    {
      templateId: "OC",
      data: {
        type: "ORDEN_COMPRA_SIN_POLIZAS",
        expenseNumber: "EXP-OC-001",
        description: "x",
        amount: 100,
      },
      expectedExt: "xlsx",
    },
    {
      templateId: "AD-0033",
      data: {
        type: "ANTICIPO",
        amount: 100000,
        beneficiaryName: "Suministros del Valle",
        beneficiaryNit: "900.123.456-7",
        bankName: "Bancolombia",
        accountType: "SAVINGS",
        accountNumber: "123-456789-00",
        description: "Anticipo x",
      },
      expectedExt: "xlsx",
    },
    {
      templateId: "LEG",
      data: {
        type: "LEGALIZACION",
        amount: 50000,
        beneficiaryName: "Suministros del Valle",
        beneficiaryNit: "900.123.456-7",
        bankName: "Bancolombia",
        accountNumber: "123-456789-00",
        description: "Legalización x",
      },
      expectedExt: "xlsx",
    },
    {
      templateId: "OS",
      data: {
        type: "ORDEN_SERVICIO_POLIZAS",
        expenseNumber: "EXP-OS-001",
        description: "x",
        amount: 1,
      },
      expectedExt: "xlsx",
    },
    {
      templateId: "CORTE",
      data: {
        cutNumber: "CUT-001",
        description: "x",
        grossValue: 1,
        retentionPercent: 10,
        retentionValue: 0,
        advanceDeduction: 0,
        netValue: 100,
        periodStart: "2026-09-01",
        periodEnd: "2026-09-30",
        providerName: "Suministros del Valle",
      },
      expectedExt: "xlsx",
    },
    {
      templateId: "CONT_GLOBAL",
      data: {
        type: "OBRA",
        pricingMode: "LUMP_SUM",
        contractNumber: "CONT-001",
        value: 100000,
        startDate: "2026-10-01",
        endDate: "2027-04-01",
        scopeOfWork: "X",
        providerName: "Constructora XYZ",
        providerNit: "800.555.111-1",
      },
      expectedExt: "docx",
    },
    {
      templateId: "CONT_UNITARIO",
      data: {
        type: "OBRA",
        pricingMode: "UNIT_PRICE",
        contractNumber: "CONT-002",
        value: 100000,
        startDate: "2026-10-01",
        endDate: "2027-01-01",
        scopeOfWork: "X",
        providerName: "Constructora XYZ",
        providerNit: "800.555.111-1",
      },
      expectedExt: "docx",
    },
    {
      templateId: "CONT_DISENOS",
      data: {
        type: "DISENOS",
        contractNumber: "CONT-DIS-001",
        value: 100000,
        startDate: "2026-10-01",
        endDate: "2026-12-01",
        scopeOfWork: "X",
        providerName: "Estudio ArqSur",
        providerNit: "900.222.111-3",
      },
      expectedExt: "docx",
    },
    {
      templateId: "CONT_LABORAL",
      data: {
        employeeNumber: "EMP-001",
        fullName: "Juan Pérez",
        documentId: "79.123.456",
        position: "X",
        startDate: "2026-10-01",
        salary: 100000,
      },
      expectedExt: "docx",
    },
  ];

  for (const c of cases) {
    it(`${c.templateId} → mimetype ${c.expectedExt}`, async () => {
      const r = await renderDocument(c.templateId, c.data, ctxBase, {
        formatosRoot: "/dummy",
        loader: snapshotLoader(),
      });
      if (!r.ok) {
        throw new Error(
          `renderDocument(${c.templateId}) falló: ${JSON.stringify(err(r))}`,
        );
      }
      expect(r.content.length).toBeGreaterThan(500);
      if (c.expectedExt === "xlsx") {
        expect(r.mimetype).toContain("spreadsheetml");
      } else {
        expect(r.mimetype).toContain("wordprocessingml");
      }
    }, 20_000);
  }
});

describe("renderDocument — manejo de errores", () => {
  it("templateId desconocido → TEMPLATE_NOT_REGISTERED", async () => {
    const r = await renderDocument("INVALIDO" as unknown as "OC", {}, ctxBase, {
      formatosRoot: "/dummy",
      loader: async () => Buffer.from(""),
    });
    expect(r.ok).toBe(false);
    expect(err(r).code).toBe("TEMPLATE_NOT_REGISTERED");
  });

  it("AUSENCIA → FILLER_THREW (PDF no implementado)", async () => {
    const r = await renderDocument("AUSENCIA", {}, ctxBase, {
      formatosRoot: "/dummy",
      loader: snapshotLoader(),
    });
    expect(r.ok).toBe(false);
    expect(err(r).code).toBe("FILLER_THREW");
  });
});
