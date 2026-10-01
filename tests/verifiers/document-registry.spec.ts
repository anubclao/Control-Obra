// filepath: tests/verifiers/document-registry.spec.ts
// Verifier del registry. Cubre docs/specs/document-generation-sharepoint.md §6.1.

import { describe, it, expect } from "vitest";
import {
  resolveTemplate,
  listGeneratableTypes,
} from "@/lib/document-generator/registry";

/**
 * Helper: extrae el error tipado. Cast explícito porque TS no narrowa
 * correctamente con strict:false en este patrón de unión discriminada.
 */
function err(r: ReturnType<typeof resolveTemplate>): { code: string } {
  if (r.ok === true) throw new Error("expected error result");
  return (r as { error: { code: string } }).error;
}

describe("document-generator/registry — resolveTemplate", () => {
  // ── payments ──────────────────────────────────────────────────────────
  it("payments.type=ANTICIPO → AD-0033", () => {
    const r = resolveTemplate("payments", { type: "ANTICIPO" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.templateId).toBe("AD-0033");
  });

  it("payments sin type → TEMPLATE_MISSING", () => {
    const r = resolveTemplate("payments", {});
    expect(r.ok).toBe(false);
    expect(err(r).code).toBe("TEMPLATE_MISSING");
  });

  it("payments.type=CORTE_OBRA (no genera) → TEMPLATE_MISMATCH", () => {
    const r = resolveTemplate("payments", { type: "CORTE_OBRA" });
    expect(r.ok).toBe(false);
    expect(err(r).code).toBe("TEMPLATE_MISMATCH");
  });

  // ── expenses ──────────────────────────────────────────────────────────
  it("expenses.type=ORDEN_COMPRA_POLIZAS → OC", () => {
    const r = resolveTemplate("expenses", { type: "ORDEN_COMPRA_POLIZAS" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.templateId).toBe("OC");
  });

  it("expenses.type=ORDEN_SERVICIO_SIN_POLIZAS → OS", () => {
    const r = resolveTemplate("expenses", {
      type: "ORDEN_SERVICIO_SIN_POLIZAS",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.templateId).toBe("OS");
  });

  it("expenses.type=LEGALIZACION_GASTO → LEG", () => {
    const r = resolveTemplate("expenses", { type: "LEGALIZACION_GASTO" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.templateId).toBe("LEG");
  });

  it("expenses.type=CONTRATO_OBRA_CIVIL_POLIZAS → TEMPLATE_MISMATCH (no es OC/OS)", () => {
    const r = resolveTemplate("expenses", {
      type: "CONTRATO_OBRA_CIVIL_POLIZAS",
    });
    expect(r.ok).toBe(false);
    expect(err(r).code).toBe("TEMPLATE_MISMATCH");
  });

  // ── contracts ────────────────────────────────────────────────────────
  it("contracts.OBRA + LUMP_SUM → CONT_GLOBAL", () => {
    const r = resolveTemplate("contracts", {
      contractType: "OBRA",
      pricingMode: "LUMP_SUM",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.templateId).toBe("CONT_GLOBAL");
  });

  it("contracts.OBRA + UNIT_PRICE → CONT_UNITARIO", () => {
    const r = resolveTemplate("contracts", {
      contractType: "OBRA",
      pricingMode: "UNIT_PRICE",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.templateId).toBe("CONT_UNITARIO");
  });

  it("contracts.OBRA + COST_PLUS → TEMPLATE_MISMATCH (no hay plantilla oficial)", () => {
    const r = resolveTemplate("contracts", {
      contractType: "OBRA",
      pricingMode: "COST_PLUS",
    });
    expect(r.ok).toBe(false);
    expect(err(r).code).toBe("TEMPLATE_MISMATCH");
  });

  it("contracts.DISENOS → CONT_DISENOS", () => {
    const r = resolveTemplate("contracts", { contractType: "DISENOS" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.templateId).toBe("CONT_DISENOS");
  });

  it("contracts.LABORAL → CONT_LABORAL", () => {
    const r = resolveTemplate("contracts", { contractType: "LABORAL" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.templateId).toBe("CONT_LABORAL");
  });

  // ── workLogs ─────────────────────────────────────────────────────────
  it("workLogs.type=AUSENCIA → AUSENCIA", () => {
    const r = resolveTemplate("workLogs", { workLogType: "AUSENCIA" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.templateId).toBe("AUSENCIA");
  });

  it("workLogs sin tipo → AUSENCIA (default)", () => {
    const r = resolveTemplate("workLogs", {});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.templateId).toBe("AUSENCIA");
  });

  // ── employees / cuts (siempre generan) ───────────────────────────────
  it("employees → CONT_LABORAL sin más datos", () => {
    const r = resolveTemplate("employees", {});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.templateId).toBe("CONT_LABORAL");
  });

  it("cuts → CORTE sin más datos", () => {
    const r = resolveTemplate("cuts", {});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.templateId).toBe("CORTE");
  });
});

describe("document-generator/registry — listGeneratableTypes", () => {
  it("payments: solo ANTICIPO", () => {
    expect(listGeneratableTypes("payments")).toEqual(["ANTICIPO"]);
  });

  it("expenses: contiene OC, OS, LEG", () => {
    const types = listGeneratableTypes("expenses");
    expect(types).toContain("ORDEN_COMPRA_POLIZAS");
    expect(types).toContain("ORDEN_SERVICIO_SIN_POLIZAS");
    expect(types).toContain("LEGALIZACION_GASTO");
    expect(types.length).toBeGreaterThanOrEqual(6);
  });

  it("contracts: 3 tipos (OBRA, DISENOS, LABORAL)", () => {
    expect(listGeneratableTypes("contracts")).toEqual([
      "OBRA",
      "DISENOS",
      "LABORAL",
    ]);
  });

  it("employees: [] (siempre genera)", () => {
    expect(listGeneratableTypes("employees")).toEqual([]);
  });

  it("cuts: [] (siempre genera)", () => {
    expect(listGeneratableTypes("cuts")).toEqual([]);
  });
});
