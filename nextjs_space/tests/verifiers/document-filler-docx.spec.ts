// filepath: tests/verifiers/document-filler-docx.spec.ts
// Verifiers de los fillers docx (contrato-global, unitario, diseños, laboral)
// + helpers docx (renderDocx, replaceInDocx, listDocxPlaceholders).
// Refactor F2: cada filler consume el row de la BD normalizado (camelCase).

import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import PizZip from "pizzip";
import {
  renderDocx,
  replaceInDocx,
  listDocxPlaceholders,
} from "@/lib/document-generator/fillers/docx-helpers";
import { contratoGlobalFiller } from "@/lib/document-generator/fillers/contrato-global";
import { contratoUnitarioFiller } from "@/lib/document-generator/fillers/contrato-unitario";
import { contratoDisenosFiller } from "@/lib/document-generator/fillers/contrato-disenos";
import { contratoLaboralFiller } from "@/lib/document-generator/fillers/contrato-laboral";
import type { FillerContext } from "@/lib/document-generator/fillers/types";
import type {
  ContratoObraRow,
  ContratoDisenosRow,
  ContratoLaboralRow,
} from "@/lib/document-generator/fillers/entity-data";

const SNAPSHOTS = path.join(
  process.cwd(),
  "src/lib/document-generator/formatos-snapshots",
);

async function load(name: string): Promise<Buffer> {
  return await fs.readFile(path.join(SNAPSHOTS, name));
}

function extractText(docxBytes: Buffer): string {
  const zip = new PizZip(docxBytes);
  const file = zip.file("word/document.xml");
  if (!file) return "";
  const xml = file.asText();
  const out: string[] = [];
  const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out.join(" ");
}

function ctxBase(): FillerContext {
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
        name: "Constructora XYZ",
        nit: "800.555.111-1",
        email: "info@xyz.co",
        phone: "601 999 0000",
      },
      today: "2026-09-29",
    },
  };
}

// ─── HELPERS ──────────────────────────────────────────────────────

describe("docx-helpers — replaceInDocx", () => {
  it("reemplaza texto literal y preserva el resto", async () => {
    const bytes = await load("CONT_LABORAL.docx");
    const r = replaceInDocx(bytes, { XXXXXX: "RESIDENTE DE OBRA" });
    const text = extractText(r);
    expect(text).toContain("RESIDENTE DE OBRA");
    expect(text).toMatch(/CLAUSULAS/i);
  });

  it("salta reemplazos cuyo buscar no existe (no falla)", async () => {
    const bytes = await load("CONT_GLOBAL.docx");
    const r = replaceInDocx(bytes, { TEXTO_QUE_NO_EXISTE: "nuevo" });
    expect(r.length).toBeGreaterThan(1000);
  });

  it("salta reemplazos con valor undefined o null", async () => {
    const bytes = await load("CONT_LABORAL.docx");
    const r = replaceInDocx(bytes, { XXXXXX: undefined, OTRO: null });
    const zip = new PizZip(r);
    expect(zip.file("word/document.xml")).toBeDefined();
  });
});

describe("docx-helpers — renderDocx (placeholder-based)", () => {
  it("CONT_GLOBAL no tiene {campo} (es ejemplo)", async () => {
    const ph = listDocxPlaceholders(await load("CONT_GLOBAL.docx"));
    expect(ph).toEqual([]);
  });
});

describe("docx-helpers — listDocxPlaceholders", () => {
  it("CONT_LABORAL no tiene {campo}", async () => {
    const ph = listDocxPlaceholders(await load("CONT_LABORAL.docx"));
    expect(ph).toEqual([]);
  });
  it("CONT_DISENOS no tiene {campo}", async () => {
    const ph = listDocxPlaceholders(await load("CONT_DISENOS.docx"));
    expect(ph).toEqual([]);
  });
});

// ─── CONTRATO GLOBAL ──────────────────────────────────────────────

describe("document-generator/fillers/contrato-global", () => {
  it("sustituye XXXXXXXX por scopeOfWork del row de contracts", async () => {
    const row: ContratoObraRow = {
      type: "OBRA",
      pricingMode: "LUMP_SUM",
      contractNumber: "CONT-001",
      value: 120_000_000,
      startDate: "2026-10-01",
      endDate: "2027-04-01",
      scopeOfWork: "mano de obra para instalación eléctrica",
      providerName: "Constructora XYZ",
      providerNit: "800.555.111-1",
    };
    const ctx = ctxBase();
    ctx.templateBytes = await load("CONT_GLOBAL.docx");
    ctx.data = row;
    const r = await contratoGlobalFiller(ctx);
    expect(r.content.length).toBeGreaterThan(1000);
    const text = extractText(r.content);
    expect(text).toContain("mano de obra para instalación eléctrica");
    expect(text).not.toContain("XXXXXXXX");
  });
});

// ─── CONTRATO UNITARIO ────────────────────────────────────────────

describe("document-generator/fillers/contrato-unitario", () => {
  it("sustituye XXXXXXXX con scopeOfWork del row de contracts", async () => {
    const row: ContratoObraRow = {
      type: "OBRA",
      pricingMode: "UNIT_PRICE",
      contractNumber: "CONT-002",
      value: 80_000_000,
      startDate: "2026-10-01",
      endDate: "2027-01-01",
      scopeOfWork: "Excavación y relleno 50m3",
      providerName: "Constructora XYZ",
      providerNit: "800.555.111-1",
    };
    const ctx = ctxBase();
    ctx.templateBytes = await load("CONT_UNITARIO.docx");
    ctx.data = row;
    const r = await contratoUnitarioFiller(ctx);
    const text = extractText(r.content);
    expect(text).toContain("Excavación y relleno");
    expect(text).not.toContain("XXXXXXXX");
  });
});

// ─── CONTRATO DISEÑOS ─────────────────────────────────────────────

describe("document-generator/fillers/contrato-disenos", () => {
  it("sustituye XXXXXXXX con scopeOfWork", async () => {
    const row: ContratoDisenosRow = {
      type: "DISENOS",
      contractNumber: "CONT-DIS-001",
      value: 8_000_000,
      startDate: "2026-10-01",
      endDate: "2026-12-01",
      scopeOfWork: "Planos arquitectónicos y estructurales",
      providerName: "Estudio ArqSur",
      providerNit: "900.222.111-3",
    };
    const ctx = ctxBase();
    ctx.templateBytes = await load("CONT_DISENOS.docx");
    ctx.data = row;
    const r = await contratoDisenosFiller(ctx);
    const text = extractText(r.content);
    expect(text).toContain("Planos arquitectónicos y estructurales");
    expect(text).not.toContain("XXXXXXXX");
  });
});

// ─── CONTRATO LABORAL ─────────────────────────────────────────────

describe("document-generator/fillers/contrato-laboral", () => {
  it("sustituye XXXXXX (cargo) y empleador desde el row de employees", async () => {
    const row: ContratoLaboralRow = {
      employeeNumber: "EMP-001",
      fullName: "Juan Pérez",
      documentId: "79.123.456",
      position: "INGENIERO RESIDENTE",
      startDate: "2026-10-01",
      salary: 3_500_000,
    };
    const ctx = ctxBase();
    ctx.templateBytes = await load("CONT_LABORAL.docx");
    ctx.data = row;
    const r = await contratoLaboralFiller(ctx);
    const text = extractText(r.content);
    expect(text).toContain("INGENIERO RESIDENTE");
    expect(text).not.toContain("XXXXXX");
  });
});
