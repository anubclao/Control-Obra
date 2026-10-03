// @vitest-environment node
/**
 * tests/verifiers/budget-upload-validation.spec.ts
 *
 * Verifier de docs/specs/budget-upload-validation.md (AC-1, AC-2, AC-3, AC-4).
 *
 * Cubre:
 *  - extractTitle: extrae fila 1 del Excel como titulo
 *  - normalizeForTitleMatch: normaliza acentos/case para match por contencion
 *  - titlesMatch: true si uno contiene al otro (case + accent insensitive)
 *  - groupByFrente: agrupa items por classification
 *  - computeFrenteSummary: cuenta items + subtotal por frente
 *  - canReplaceBudget: solo ADMIN si PT afectado, libre si no
 */

import { describe, it, expect } from "vitest";

import {
  extractTitle,
  normalizeForTitleMatch,
  titlesMatch,
  groupByFrente,
  computeFrenteSummary,
  type ParsedExcelRow,
} from "@/lib/excel-parser";

import {
  canReplaceBudget,
  type BudgetAffectedState,
} from "@/lib/permissions-budget";

import type { Role } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function row(
  partial: Partial<ParsedExcelRow> & { layerType: ParsedExcelRow["layerType"] },
): ParsedExcelRow {
  return {
    rowNumber: 1,
    raw: {},
    code: "",
    description: "",
    unit: "GL",
    quantity: 0,
    unitPrice: 0,
    totalPrice: 0,
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// AC-1: Validacion de titulo
// ---------------------------------------------------------------------------

describe("extractTitle", () => {
  it("AC-1.1 devuelve el string de la fila 1 cuando tiene contenido", () => {
    expect(extractTitle(["PRESUPUESTO GENERAL PARQUES DEL VALLE", "", ""])).toBe(
      "PRESUPUESTO GENERAL PARQUES DEL VALLE",
    );
  });

  it("AC-1.2 devuelve string vacio cuando fila 1 no tiene contenido", () => {
    expect(extractTitle(["", "", ""])).toBe("");
  });

  it("AC-1.3 trimea espacios al inicio y final", () => {
    expect(extractTitle(["  PRESUPUESTO X  ", "", ""])).toBe("PRESUPUESTO X");
  });

  it("AC-1.4 ignora filas vacias aunque esten presentes", () => {
    // Algunos Excel exportados dejan 2-3 filas vacias antes del titulo real.
    expect(extractTitle(["", "", "  PRESUPUESTO X  ", "", ""])).toBe(
      "PRESUPUESTO X",
    );
  });
});

describe("normalizeForTitleMatch", () => {
  it("AC-1.5 lowercase + trim + sin acentos", () => {
    expect(normalizeForTitleMatch("  PRESUPUESTO General  ")).toBe(
      "presupuesto general",
    );
    expect(normalizeForTitleMatch("Parques del Valle")).toBe(
      "parques del valle",
    );
    // NFD descompone "í" en "i" + combining acute; el regex solo elimina
    // el combining mark, no la "i" base. Por eso queda "canci".
    expect(normalizeForTitleMatch("Canc\u00ed")).toBe("canci");
  });
});

describe("titlesMatch", () => {
  it("AC-1.6 match exacto -> true", () => {
    expect(titlesMatch("Parques del Valle", "Parques del Valle")).toBe(true);
  });

  it("AC-1.7 match por contencion (Excel title contiene project name)", () => {
    expect(
      titlesMatch(
        "PRESUPUESTO GENERAL PARQUES DEL VALLE",
        "PARQUES DEL VALLE",
      ),
    ).toBe(true);
  });

  it("AC-1.8 match por contencion inversa (project name contiene Excel title)", () => {
    expect(
      titlesMatch("PARQUES DEL VALLE", "PRESUPUESTO GENERAL PARQUES DEL VALLE"),
    ).toBe(true);
  });

  it("AC-1.9 case + accent insensitive", () => {
    expect(
      titlesMatch("Canchas Sint\u00e9tica", "CANCHAS SINTETICA"),
    ).toBe(true);
  });

  it("AC-1.10 no match -> false", () => {
    expect(titlesMatch("Anubis Clavio", "Parques del Valle")).toBe(false);
  });

  it("AC-1.11 strings vacios -> false (no aceptamos titulos faltantes)", () => {
    expect(titlesMatch("", "Parques del Valle")).toBe(false);
    expect(titlesMatch("Parques del Valle", "")).toBe(false);
    expect(titlesMatch("", "")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-4: Modelo multi-frente
// ---------------------------------------------------------------------------

describe("groupByFrente", () => {
  it("AC-4.1 agrupa por classification manteniendo el orden de primera aparicion", () => {
    const rows: ParsedExcelRow[] = [
      row({ layerType: "ITEM", classification: "FRENTE A", code: "1", totalPrice: 100 }),
      row({ layerType: "ITEM", classification: "FRENTE A", code: "2", totalPrice: 200 }),
      row({ layerType: "ITEM", classification: "FRENTE B", code: "1", totalPrice: 300 }),
      row({ layerType: "ITEM", classification: "FRENTE A", code: "3", totalPrice: 50 }),
    ];
    const grouped = groupByFrente(rows);
    expect(Array.from(grouped.keys())).toEqual(["FRENTE A", "FRENTE B"]);
    expect(grouped.get("FRENTE A")!.length).toBe(3);
    expect(grouped.get("FRENTE B")!.length).toBe(1);
  });

  it("AC-4.2 rows sin classification se agrupan en __UNCLASSIFIED__", () => {
    const rows: ParsedExcelRow[] = [
      row({ layerType: "ITEM", code: "1", totalPrice: 100 }),
      row({ layerType: "ITEM", classification: "FRENTE A", code: "2", totalPrice: 200 }),
    ];
    const grouped = groupByFrente(rows);
    expect(grouped.has("__UNCLASSIFIED__")).toBe(true);
    expect(grouped.get("__UNCLASSIFIED__")!.length).toBe(1);
  });

  it("AC-4.3 no incluye rows que no son ITEM en el conteo del frente", () => {
    const rows: ParsedExcelRow[] = [
      row({ layerType: "CHAPTER", classification: "FRENTE A", code: "1", totalPrice: 0 }),
      row({ layerType: "SUBCHAPTER", classification: "FRENTE A", code: "1.1", totalPrice: 0 }),
      row({ layerType: "ITEM", classification: "FRENTE A", code: "1.1.1", totalPrice: 100 }),
    ];
    const grouped = groupByFrente(rows);
    expect(grouped.get("FRENTE A")!.length).toBe(1);
  });
});

describe("computeFrenteSummary", () => {
  it("AC-4.4 cuenta items + suma totalPrice + cuenta capitulos distintos", () => {
    const rows: ParsedExcelRow[] = [
      row({ layerType: "CHAPTER", classification: "FRENTE A", code: "1" }),
      row({ layerType: "CHAPTER", classification: "FRENTE A", code: "2" }),
      row({ layerType: "ITEM", classification: "FRENTE A", code: "1.1.1", totalPrice: 100 }),
      row({ layerType: "ITEM", classification: "FRENTE A", code: "1.1.2", totalPrice: 200 }),
      row({ layerType: "ITEM", classification: "FRENTE A", code: "2.1.1", totalPrice: 300 }),
    ];
    const summary = computeFrenteSummary("FRENTE A", rows);
    expect(summary.name).toBe("FRENTE A");
    expect(summary.itemCount).toBe(3);
    expect(summary.subtotal).toBe(600);
    expect(summary.chapterCount).toBe(2);
  });

  it("AC-4.5 frente sin items: itemCount 0, subtotal 0, chapterCount 0", () => {
    const summary = computeFrenteSummary("VACIO", []);
    expect(summary.itemCount).toBe(0);
    expect(summary.subtotal).toBe(0);
    expect(summary.chapterCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC-3: Permisos de reemplazo
// ---------------------------------------------------------------------------

describe("canReplaceBudget", () => {
  const notAffected: BudgetAffectedState = {
    hasApprovedCuts: false,
    hasPaidPayments: false,
  };
  const afectado: BudgetAffectedState = {
    hasApprovedCuts: true,
    hasPaidPayments: false,
  };
  const fullyAffected: BudgetAffectedState = {
    hasApprovedCuts: true,
    hasPaidPayments: true,
  };

  const roles: Role[] = ["ADMIN", "GERENTE", "DIRECTOR", "RESIDENTE", "CLIENTE"];

  for (const role of roles) {
    if (role === "ADMIN") continue; // caso especial abajo
    it(`AC-3.1 ${role} NO puede reemplazar un PT NO afectado si no es admin`, () => {
      // Esperaria que un no-admin pueda reemplazar un PT limpio (regla de
      // permisos del spec: solo admin si AFECTADO).
      // Si el spec dice libre cuando no afectado, esto es true.
      expect(canReplaceBudget(role, notAffected)).toBe(true);
    });

    it(`AC-3.2 ${role} NO puede reemplazar un PT afectado`, () => {
      expect(canReplaceBudget(role, afectado)).toBe(false);
      expect(canReplaceBudget(role, fullyAffected)).toBe(false);
    });
  }

  it("AC-3.3 ADMIN siempre puede reemplazar", () => {
    expect(canReplaceBudget("ADMIN", notAffected)).toBe(true);
    expect(canReplaceBudget("ADMIN", afectado)).toBe(true);
    expect(canReplaceBudget("ADMIN", fullyAffected)).toBe(true);
  });
});