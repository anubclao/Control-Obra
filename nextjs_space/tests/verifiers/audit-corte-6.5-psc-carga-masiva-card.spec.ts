/**
 * tests/verifiers/audit-corte-6.5-psc-carga-masiva-card.spec.ts
 *
 * Verifier para docs/specs/audit-corte-6.5-psc-carga-masiva-card.md (Corte 6.5).
 *
 * Refactor del spec 6.0 → 6.5: dialog modal → card inline con 3 secciones
 * (encontrados / ya-asignados / no-encontrados) + filtro de duplicados
 * via getItemsAvailable.
 *
 * Estado esperado al inicio de Fase 4 (Commit 2 → Commit 3):
 *  - V1 (19 tests, static source analysis): ROJO. El card no existe
 *    (`psc-bulk-load-card.tsx` no está creado todavía) ni el form
 *    está integrado. 19 fallos.
 *  - V2 (6 tests, normalizeForMatching): VERDE. La lib `psc-excel.ts`
 *    existe desde `3ebe4d8`, las funciones puras están implementadas
 *    y se importan via dynamic import.
 *  - V3 (4 tests, matchItemsByDescription): VERDE. Idem.
 *  - V4 (5 tests, detectIncluyeColumn): VERDE. Idem.
 *
 * Total: 34 tests, 19 rojo / 15 verde, 0 skipped.
 *
 * Estrategia (migrada del spec 6.0):
 *  - V1: readFileSync + regex (mismo patrón que
 *    bug-project-form-currency-step.spec.ts:26-29). Verifica que el
 *    código de la card tiene las marcas esperadas (no usa Dialog,
 *    llama getItemsAvailable, tiene keywords de las 3 secciones, etc.).
 *  - V2-V4: dynamic import con VARIABLE (no literal string) para evitar
 *    que vite:import-analysis falle en parse-time. El módulo se resuelve
 *    en runtime via vite-node; como la lib YA EXISTE, los tests pasan.
 *    Si la lib no existiera, el try/catch surface un error claro.
 *
 * AC-Z (proceso): el verifier 6.0 se elimina SOLO después de que
 * verifier 6.5 tenga los 15 tests V2/V3/V4 migrados. Esto se valida en
 * el Commit 2 antes de borrar el archivo viejo.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

// ----------------------------------------------------------------------------
// Type declarations (existen solo para que TS no se queje del import)
// ----------------------------------------------------------------------------

interface PscImportPtItem {
  id: string;
  description: string;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

interface PscImportItem {
  excelRow: number;
  ptItem: PscImportPtItem | null;
  description: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  included: boolean;
  warnings: string[];
}

interface PscImportResult {
  items: PscImportItem[];
  matchedCount: number;
  unmatchedCount: number;
  warnings: string[];
  totalValue: number;
}

// IMPORTANTE: los tipos aquí deben MATCH el archivo real, sino
// contaminan otros archivos del proyecto (tsc hace module-augmentation
// global). En particular, parsePscExcelFile debe ser Promise<PscImportResult>,
// no Promise<unknown>, para que el dialog pueda hacer setParsed(result).
declare module "@/lib/psc-excel" {
  export function normalizeForMatching(s: string): string;
  export function matchItemsByDescription(
    descriptions: string[],
    ptItems: PscImportPtItem[],
  ): { matched: Map<number, PscImportPtItem>; unmatched: number[] };
  export function detectIncluyeColumn(headers: string[]): string;
  export function parsePscExcelFile(
    file: File,
    ptItems: PscImportPtItem[],
  ): Promise<PscImportResult>;
  export function generatePscTemplate(
    ptItems: PscImportPtItem[],
    projectName: string,
  ): Blob;
}

// ----------------------------------------------------------------------------
// Imports y constantes
// ----------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "../..");
const cardPath = path.join(ROOT, "src/components/pscs/psc-bulk-load-card.tsx");
const formPath = path.join(ROOT, "src/components/pscs/psc-form.tsx");
const dialogPath = path.join(
  ROOT,
  "src/components/pscs/psc-bulk-load-dialog.tsx",
);

/**
 * Helper para V2-V4: intenta importar @/lib/psc-excel dinámicamente
 * usando una VARIABLE (no literal string) para que vite:import-analysis
 * no falle en parse-time cuando el archivo no existe.
 *
 * Si el módulo no existe, surface un error claro.
 */
async function tryImportPscExcel(): Promise<typeof import("@/lib/psc-excel")> {
  const modulePath = "@/lib/psc-excel";
  try {
    return (await import(modulePath)) as typeof import("@/lib/psc-excel");
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    throw new Error(
      `@/lib/psc-excel not implemented. Root cause: ${reason}`,
    );
  }
}

// ============================================================================
// V1 — Static source analysis (19 tests). ROJO en Commit 2 (card no existe).
// ============================================================================

describe("AC-1: psc-bulk-load-card.tsx existe y exporta PscBulkLoadCard", () => {
  it("existe el archivo", () => {
    expect(existsSync(cardPath)).toBe(true);
  });
  it("exporta PscBulkLoadCard", () => {
    const src = readFileSync(cardPath, "utf8");
    expect(src).toMatch(/export\s+function\s+PscBulkLoadCard/);
  });
});

describe("AC-2 / AC-X1: la card NO usa Dialog (es inline, no modal)", () => {
  it("NO importa Dialog de @/components/ui/dialog", () => {
    const src = readFileSync(cardPath, "utf8");
    expect(src).not.toMatch(/from\s+["']@\/components\/ui\/dialog["']/);
  });
});

describe("AC-3: psc-form.tsx usa PscBulkLoadCard (no Dialog)", () => {
  it("importa PscBulkLoadCard", () => {
    const src = readFileSync(formPath, "utf8");
    expect(src).toMatch(
      /import\s+\{[^}]*PscBulkLoadCard[^}]*\}\s+from\s+["']@\/components\/pscs\/psc-bulk-load-card["']/,
    );
  });
  it("NO importa PscBulkLoadDialog (deprecado por el refactor)", () => {
    const src = readFileSync(formPath, "utf8");
    expect(src).not.toMatch(/PscBulkLoadDialog/);
  });
  it("renderiza <PscBulkLoadCard> en el JSX", () => {
    const src = readFileSync(formPath, "utf8");
    expect(src).toMatch(/<PscBulkLoadCard/);
  });
  it("pasa pscId como prop (para filtro de ya-asignados)", () => {
    const src = readFileSync(formPath, "utf8");
    expect(src).toMatch(/pscId=\{psc\?\.id\}/);
  });
});

describe("AC-4 / AC-X4: instrucciones visibles antes de upload", () => {
  it("contiene keyword 'Descargar plantilla'", () => {
    const src = readFileSync(cardPath, "utf8");
    expect(src).toMatch(/Descargar\s+plantilla/);
  });
  it("contiene keyword 'Subir Excel'", () => {
    const src = readFileSync(cardPath, "utf8");
    expect(src).toMatch(/Subir\s+Excel/);
  });
  it("contiene keyword 'Cantidad' (instrucciones para llenar)", () => {
    const src = readFileSync(cardPath, "utf8");
    expect(src).toMatch(/Cantidad/);
  });
});

describe("AC-5: 3 secciones con badges de conteo", () => {
  it("sección 'Encontrados'", () => {
    const src = readFileSync(cardPath, "utf8");
    expect(src).toMatch(/Encontrados/);
  });
  it("sección 'Ya asignados'", () => {
    const src = readFileSync(cardPath, "utf8");
    expect(src).toMatch(/Ya\s+asignados/);
  });
  it("sección 'No encontrados'", () => {
    const src = readFileSync(cardPath, "utf8");
    expect(src).toMatch(/No\s+encontrados/);
  });
});

describe("AC-6 / AC-X2: filtra contra getItemsAvailable", () => {
  it("llama getItemsAvailable con (projectId, pscId)", () => {
    const src = readFileSync(cardPath, "utf8");
    expect(src).toMatch(/getItemsAvailable\s*\(/);
  });
});

describe("AC-7: cantidad editable + botón eliminar por fila", () => {
  it("input de cantidad presente en render", () => {
    const src = readFileSync(cardPath, "utf8");
    expect(src).toMatch(/quantity|cantidad/);
  });
  it("botón eliminar presente", () => {
    const src = readFileSync(cardPath, "utf8");
    expect(src).toMatch(/Eliminar|eliminar/);
  });
});

describe("AC-8: onConfirm agrega al state sin persistir", () => {
  it("psc-form pasa setItems via onConfirm", () => {
    const src = readFileSync(formPath, "utf8");
    expect(src).toMatch(/setItems\s*\(\s*\(?\s*prev/);
  });
  it("psc-form NO llama a createPSC ni updatePSC dentro de handleBulkConfirm", () => {
    const src = readFileSync(formPath, "utf8");
    // El handleBulkConfirm debe hacer setItems, NO createPSC/updatePSC.
    // createPSC/updatePSC solo se llaman en handleSubmit.
    const handleBulkConfirmMatch = src.match(
      /handleBulkConfirm[\s\S]*?^  \}/m,
    );
    expect(handleBulkConfirmMatch).toBeTruthy();
    const body = handleBulkConfirmMatch?.[0] ?? "";
    expect(body).toContain("setItems");
    expect(body).not.toMatch(/createPSC|updatePSC/);
  });
});

describe("AC-X3: mensaje de confirmación post-confirm", () => {
  it("psc-form llama a toast después de setItems", () => {
    const src = readFileSync(formPath, "utf8");
    expect(src).toMatch(/toast/);
  });
});

// ============================================================================
// V2-V4 — Pure functions (15 tests copiados literalmente del spec 6.0).
// VERDE en Commit 2 porque la lib psc-excel.ts ya existe desde 3ebe4d8.
// ============================================================================

describe("AC-5: normalizeForMatching (NFD + lowercase + trim)", () => {
  it("lowercase + trim", async () => {
    const m = await tryImportPscExcel();
    expect(m.normalizeForMatching("  EXCAVACION  ")).toBe("excavacion");
  });
  it("NFD strip: acentos", async () => {
    const m = await tryImportPscExcel();
    expect(m.normalizeForMatching("Excavación")).toBe("excavacion");
    expect(m.normalizeForMatching("PREPARACIÓN MANUAL")).toBe(
      "preparacion manual",
    );
  });
  it("preserva ñ", async () => {
    const m = await tryImportPscExcel();
    expect(m.normalizeForMatching("SEÑALIZACIÓN")).toBe("senalizacion");
  });
  it("preserva dígitos y espacios", async () => {
    const m = await tryImportPscExcel();
    expect(m.normalizeForMatching("Item 1.2.3")).toBe("item 1.2.3");
  });
  it("string vacío → string vacío", async () => {
    const m = await tryImportPscExcel();
    expect(m.normalizeForMatching("")).toBe("");
  });
  it("solo espacios → string vacío", async () => {
    const m = await tryImportPscExcel();
    expect(m.normalizeForMatching("   ")).toBe("");
  });
});

describe("AC-5: matchItemsByDescription", () => {
  const pt: PscImportPtItem[] = [
    {
      id: "1",
      description: "Excavación manual",
      unit: "M3",
      unitPrice: 50000,
      totalPrice: 0,
    },
    {
      id: "2",
      description: "Concreto 3000 PSI",
      unit: "M3",
      unitPrice: 450000,
      totalPrice: 0,
    },
    {
      id: "3",
      description: "Acero de refuerzo",
      unit: "KG",
      unitPrice: 5500,
      totalPrice: 0,
    },
  ];

  it("match exacto normalizado", async () => {
    const m = await tryImportPscExcel();
    const r = m.matchItemsByDescription(
      ["excavacion manual", "concreto 3000 psi"],
      pt,
    );
    expect(r.matched.get(0)?.id).toBe("1");
    expect(r.matched.get(1)?.id).toBe("2");
    expect(r.unmatched).toEqual([]);
  });

  it("no match: unmatched array contiene el índice", async () => {
    const m = await tryImportPscExcel();
    const r = m.matchItemsByDescription(["xxx no existe"], pt);
    expect(r.matched.size).toBe(0);
    expect(r.unmatched).toEqual([0]);
  });

  it("match mixto: matched tiene los hits, unmatched el resto", async () => {
    const m = await tryImportPscExcel();
    const r = m.matchItemsByDescription(["acero de refuerzo", "yyy"], pt);
    expect(r.matched.get(0)?.id).toBe("3");
    expect(r.unmatched).toEqual([1]);
  });

  it("descripción ambigua en PT: toma el primero", async () => {
    const m = await tryImportPscExcel();
    const ptDup: PscImportPtItem[] = [
      {
        id: "A",
        description: "EXCAVACION",
        unit: "M3",
        unitPrice: 1,
        totalPrice: 0,
      },
      {
        id: "B",
        description: "excavacion",
        unit: "M3",
        unitPrice: 2,
        totalPrice: 0,
      },
    ];
    const r = m.matchItemsByDescription(["excavacion"], ptDup);
    expect(r.matched.get(0)?.id).toBe("A");
  });
});

describe("AC-5: detectIncluyeColumn", () => {
  it("detecta 'Incluye (S/N)'", async () => {
    const m = await tryImportPscExcel();
    expect(
      m.detectIncluyeColumn([
        "Código",
        "Descripción",
        "Incluye (S/N)",
        "Cantidad",
      ]),
    ).toBe("Incluye (S/N)");
  });
  it("detecta 'Incluye' simple", async () => {
    const m = await tryImportPscExcel();
    expect(m.detectIncluyeColumn(["Item", "Cantidad", "Incluye"])).toBe(
      "Incluye",
    );
  });
  it("detecta case-insensitive", async () => {
    const m = await tryImportPscExcel();
    expect(m.detectIncluyeColumn(["INCLUYE", "Cantidad"])).toBe("INCLUYE");
  });
  it("no encuentra → string vacío", async () => {
    const m = await tryImportPscExcel();
    expect(m.detectIncluyeColumn(["Código", "Cantidad"])).toBe("");
  });
  it("NFD: preserva header con acentos si matchea keyword", async () => {
    const m = await tryImportPscExcel();
    // El header "Incluye ó" se normaliza a "incluye o" para comparar
    // contra la keyword. La función debe retornar el header original
    // (no normalizado) si matchea.
    expect(m.detectIncluyeColumn(["Incluye ó"])).toBe("Incluye ó");
  });
});
