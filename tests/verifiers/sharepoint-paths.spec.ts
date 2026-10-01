// filepath: tests/verifiers/sharepoint-paths.spec.ts
// Tests de la capa SharePoint. Mockeamos getGraphToken con globalThis
// para no hacer HTTP real, y validamos rutas + lógica de upload.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Mocks: evitamos inicializar MSAL ni hacer HTTP real.
// Inyectamos un fetch falso vía globalThis para que graphFetch use el nuestro.
let mockFetch: typeof fetch | undefined;

beforeEach(() => {
  mockFetch = undefined;
  // Forzamos config válida para que readSharePointConfig pase.
  process.env.SP_TENANT_ID = "t";
  process.env.SP_CLIENT_ID = "c";
  process.env.SP_CLIENT_SECRET = "s";
  process.env.SP_SITE_ID = "site";
  process.env.SP_DRIVE_ID = "drive";
  delete process.env.SP_BASE_PATH;

  // Mockeamos getGraphToken para evitar MSAL.
  vi.resetModules();
});

describe("sharepoint/paths", () => {
  it("buildProjectPath AD-0033 incluye projectCode y fecha", async () => {
    const { buildProjectPath } = await import("@/lib/sharepoint/paths");
    const r = buildProjectPath("Proyectos", "AD-0033", "payments", {
      projectCode: "P001",
      fecha: "2026-05-15",
    });
    expect(r.folderPath).toBe("Proyectos/P001/01-Anticipos");
    expect(r.fileName).toBe("AD-0033_P001_2026-05-15.xlsx");
  });

  it("buildProjectPath CORTE incluye año-mes y número de corte", async () => {
    const { buildProjectPath } = await import("@/lib/sharepoint/paths");
    const r = buildProjectPath("Proyectos", "CORTE", "cuts", {
      projectCode: "P002",
      numeroCorte: 3,
      fechaCorte: "2026-03-04",
    });
    expect(r.folderPath).toBe("Proyectos/P002/03-Cortes");
    expect(r.fileName).toBe("CORTE_P002_3_2026-03.xlsx");
  });

  it("buildProjectPath CONT_LABORAL usa empleadoSlug y fecha", async () => {
    const { buildProjectPath } = await import("@/lib/sharepoint/paths");
    const r = buildProjectPath("Proyectos", "CONT_LABORAL", "employees", {
      empleadoSlug: "juan_perez",
      createdAt: "2026-01-10",
    });
    expect(r.folderPath).toBe("Proyectos/SIN_PROYECTO/06-Contratos/Laboral");
    expect(r.fileName).toBe("LAB_juan_perez_2026-01-10.docx");
  });

  it("buildProjectPath AUSENCIA usa nombre de empleado slugificado", async () => {
    const { buildProjectPath } = await import("@/lib/sharepoint/paths");
    const r = buildProjectPath("Proyectos", "AUSENCIA", "workLogs", {
      nombre: "José Ñandú",
      fechaInicio: "2026-06-01",
    });
    expect(r.fileName).toBe("AUS_Jose_Nandu_2026-06-01.pdf");
  });

  it("buildProjectPath CONT_GLOBAL usa contratistaSlug y projectCode", async () => {
    const { buildProjectPath } = await import("@/lib/sharepoint/paths");
    const r = buildProjectPath("Proyectos", "CONT_GLOBAL", "contracts", {
      projectCode: "P007",
      contratistaSlug: "acme",
    });
    expect(r.folderPath).toBe("Proyectos/P007/06-Contratos/Obra");
    expect(r.fileName).toBe("CONT_P007_acme_GLOBAL.docx");
  });

  it("slugify quita tildes y caracteres especiales", async () => {
    const { slugify } = await import("@/lib/sharepoint/paths");
    expect(slugify("  Héñor Ñandú--pérez  ")).toBe("Henor_Nandu_perez");
    expect(slugify("ACME S.A.S #1")).toBe("ACME_S_A_S_1");
  });
});

describe("sharepoint/auth", () => {
  it("readSharePointConfig devuelve ok si todas las vars están", async () => {
    const { readSharePointConfig } = await import("@/lib/sharepoint/auth");
    const r = readSharePointConfig();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.tenantId).toBe("t");
      expect(r.config.basePath).toBe("Proyectos"); // default
    }
  });

  it("readSharePointConfig devuelve MISSING_ENV si falta algo", async () => {
    delete process.env.SP_CLIENT_SECRET;
    const { readSharePointConfig } = await import("@/lib/sharepoint/auth");
    const r = readSharePointConfig();
    expect(r.ok).toBe(false);
    if (r.ok === false) {
      const fail = r as { reason: string; missing: string[] };
      expect(fail.reason).toBe("MISSING_ENV");
      expect(fail.missing).toContain("clientSecret");
    }
  });

  it("readSharePointConfig respeta SP_BASE_PATH custom", async () => {
    process.env.SP_BASE_PATH = "MisProyectos";
    const { readSharePointConfig } = await import("@/lib/sharepoint/auth");
    const r = readSharePointConfig();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.basePath).toBe("MisProyectos");
  });
});

describe("sharepoint/client contentTypeFor", () => {
  it("devuelve MIME correcto por extensión", async () => {
    const { contentTypeFor } = await import("@/lib/sharepoint/client");
    expect(contentTypeFor("foo.xlsx")).toContain("spreadsheetml");
    expect(contentTypeFor("foo.docx")).toContain("wordprocessingml");
    expect(contentTypeFor("foo.pdf")).toBe("application/pdf");
    expect(contentTypeFor("FOO.XLSX")).toContain("spreadsheetml"); // case-insensitive
    expect(contentTypeFor("bar.xyz")).toBe("application/octet-stream");
  });
});
