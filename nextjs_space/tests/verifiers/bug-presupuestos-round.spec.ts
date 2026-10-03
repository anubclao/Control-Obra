/**
 * tests/verifiers/bug-presupuestos-round.spec.ts
 * Verifier para docs/specs/bug-presupuestos-round.md
 *
 * STATUS: GREEN una vez aplicados los fixes de AC-1 a AC-7.
 *
 * Cubre:
 *  - AC-1/AC-2: existe parseExcelFile() que acepta un File y devuelve ParsedExcel.
 *  - AC-3: la página de carga llama parseExcelFile (no muestra "Mock").
 *  - AC-4/AC-5/AC-6: parseNumber maneja formatos colombiano y anglosajón sin
 *    perder precisión.
 *  - AC-5: los inputs de cantidad/vr unit en presupuestos/[id] usan step="any".
 *  - AC-7: el parser preserva los valores exactos (incluyendo decimales).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseNumber, parseExcelContent, parseExcelFile } from "@/lib/excel-parser";

const here = dirname(fileURLToPath(import.meta.url));
const DETAIL_PAGE = resolve(
  here,
  "../../src/app/tecnico/presupuestos/[id]/page.tsx",
);
const CARGAR_PAGE = resolve(
  here,
  "../../src/app/tecnico/presupuestos/cargar/page.tsx",
);

describe("Bug presupuestos — parser numérico no redondea (AC-4, AC-5, AC-6)", () => {
  it("parseNumber: formato colombiano 1.234,56 → 1234.56", () => {
    expect(parseNumber("1.234,56")).toBe(1234.56);
  });

  it("parseNumber: formato anglosajón 1,234.56 → 1234.56", () => {
    expect(parseNumber("1,234.56")).toBe(1234.56);
  });

  it("parseNumber: entero simple '8500000' → 8500000 (sin redondeo)", () => {
    expect(parseNumber("8500000")).toBe(8500000);
  });

  it("parseNumber: decimal puro '0,99' → 0.99 (NO a 1)", () => {
    expect(parseNumber("0,99")).toBe(0.99);
  });

  it("parseNumber: con símbolo de moneda '$ 1.234.567,89' → 1234567.89", () => {
    expect(parseNumber("$ 1.234.567,89")).toBe(1234567.89);
  });

  it("parseNumber: vacío → 0 (no NaN)", () => {
    expect(parseNumber("")).toBe(0);
    expect(parseNumber(undefined)).toBe(0);
  });
});

describe("Bug presupuestos — parseExcelContent preserva totales (AC-7)", () => {
  it("AC-7: las filas mantienen los valores exactos (sin redondear)", () => {
    const rows = [
      {
        Código: "1",
        Descripción: "CIMENTACIÓN",
        Unidad: "",
        Cantidad: "",
        "P. Unitario": "",
        Total: "",
      },
      {
        Código: "1.1",
        Descripción: "Concreto",
        Unidad: "M3",
        Cantidad: "1,99",
        "P. Unitario": "720.000,50",
        Total: "1.432.800,995",
      },
    ];
    const parsed = parseExcelContent(rows);
    const item = parsed.rows.find((r) => r.layerType !== "CHAPTER")!;
    expect(item.quantity).toBe(1.99);
    expect(item.unitPrice).toBe(720000.5);
    expect(item.totalPrice).toBe(1432800.995);
  });

  it("AC-7: el total agregado del PT suma exacto (no redondea al millar)", () => {
    const rows = [
      {
        Código: "1.1",
        Descripción: "Item 1",
        Unidad: "UN",
        Cantidad: "3",
        "P. Unitario": "1234,56",
        Total: "3703,68",
      },
      {
        Código: "1.2",
        Descripción: "Item 2",
        Unidad: "UN",
        Cantidad: "1",
        "P. Unitario": "0,99",
        Total: "0,99",
      },
    ];
    const parsed = parseExcelContent(rows);
    expect(parsed.totalValue).toBeCloseTo(3704.67, 2);
  });
});

describe("Bug presupuestos — parseNumber no rompe moneda solo-comas (caso 2026-10-03)", () => {
  it("BUG 2026-10-03: '$ 7,434,742' (solo comas) → 7434742, NO 7.434742", () => {
    // Antes del fix el parser trataba la unica coma como decimal,
    // dando 7.434742 en vez de 7.434.742 (un millon de veces menor).
    expect(parseNumber("$ 7,434,742")).toBe(7434742);
  });

  it("BUG 2026-10-03: '7,434,742' sin símbolo → 7434742", () => {
    expect(parseNumber("7,434,742")).toBe(7434742);
  });

  it("BUG 2026-10-03: '$ 5,556,464,503' → 5556464503 (miles sin punto)", () => {
    // VALOR TOTAL PRESUPUESTO del Excel real de Parques del Valle.
    expect(parseNumber("$ 5,556,464,503")).toBe(5556464503);
  });

  it("BUG 2026-10-03: '$ 1,984,208' → 1984208", () => {
    expect(parseNumber("$ 1,984,208")).toBe(1984208);
  });

  it("BUG 2026-10-03: '$ 15,000,000.00' → 15000000 (US: coma miles + punto decimal)", () => {
    expect(parseNumber("$ 15,000,000.00")).toBe(15000000);
  });

  it("REGRESION: '$ 1.234,56' (EU: punto miles + coma decimal) → 1234.56", () => {
    expect(parseNumber("$ 1.234,56")).toBe(1234.56);
  });

  it("REGRESION: '$ 1,234.56' (US: coma miles + punto decimal) → 1234.56", () => {
    expect(parseNumber("$ 1,234.56")).toBe(1234.56);
  });
});

describe("Bug presupuestos — parseExcelFile expuesto para la página de carga (AC-1, AC-2, AC-3, AC-5)", () => {
  it("AC-1/AC-2: parseExcelFile está exportado desde excel-parser", () => {
    expect(typeof parseExcelFile).toBe("function");
  });

  it("AC-3: la página de carga importa y usa parseExcelFile (no Mock)", () => {
    const src = readFileSync(CARGAR_PAGE, "utf8");
    expect(src).toMatch(
      /import\s*\{[^}]*parseExcelFile[^}]*\}\s*from\s*["']@\/lib\/excel-parser["']/,
    );
    expect(src).toMatch(/parseExcelFile\s*\(/);
    // No debe quedar la rama "Mock" del fix anterior.
    expect(src).not.toMatch(/Mock:\s*en\s*producci[oó]n/);
  });

  it("AC-5: los inputs de cantidad y vr unit usan step='any' (no fuerzan step numérico)", () => {
    const src = readFileSync(DETAIL_PAGE, "utf8");
    // El UnforeseenDialog define 2 inputs numéricos (Cantidad + Vr Unit).
    // Ambos deben usar step="any" para no forzar redondeo.
    const stepAnyCount = (src.match(/step="any"/g) || []).length;
    expect(stepAnyCount).toBeGreaterThanOrEqual(2);
    // No debe quedar step numérico para Cantidad ni Vr Unit.
    expect(src).not.toMatch(/step="0\.01"/);
    expect(src).not.toMatch(/step="1000"/);
  });
});
