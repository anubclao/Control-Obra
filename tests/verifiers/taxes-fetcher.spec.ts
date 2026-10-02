// @vitest-environment node
/**
 * tests/verifiers/taxes-fetcher.spec.ts
 *
 * Verifier de Fase 5, P2 (seccion 4.3): el helper `resolveTaxRates`
 * y `getTaxRate` que reemplazan los valores hardcoded 10%/19%
 * del dashboard administrativo. Cubre:
 *
 *   - Fallback a defaults si no hay tax.
 *   - usingDefaults se marca por campo.
 *   - Orden de busqueda para retencion (FUENTE -> ICA -> IVA).
 *   - Inactivos se ignoran.
 *   - Filtro por appliesTo.
 */

import { describe, it, expect } from "vitest";
import {
  resolveTaxRates,
  getTaxRate,
  DEFAULT_RETENTION_RATE,
  DEFAULT_IVA_RATE,
} from "@/lib/taxes-fetcher";
import type { TaxConfig } from "@/types";

function makeTax(overrides: Partial<TaxConfig> = {}): TaxConfig {
  return {
    id: "t1",
    name: "IVA 19%",
    rate: 0.19,
    type: "IVA",
    appliesTo: "AMBOS",
    isActive: true,
    createdAt: "2026-10-01",
    ...overrides,
  };
}

describe("getTaxRate", () => {
  it("devuelve undefined si no hay taxes", () => {
    expect(getTaxRate(undefined, "IVA")).toBeUndefined();
    expect(getTaxRate([], "IVA")).toBeUndefined();
  });

  it("ignora taxes inactivos", () => {
    const taxes = [makeTax({ rate: 0.21, isActive: false })];
    expect(getTaxRate(taxes, "IVA")).toBeUndefined();
  });

  it("encuentra el primer tax activo del tipo pedido", () => {
    const taxes = [
      makeTax({ id: "a", rate: 0.1, type: "RETENCION_FUENTE" }),
      makeTax({ id: "b", rate: 0.05, type: "RETENCION_ICA" }),
    ];
    expect(getTaxRate(taxes, "RETENCION_FUENTE")).toBe(0.1);
    expect(getTaxRate(taxes, "RETENCION_ICA")).toBe(0.05);
  });

  it("respeta el filtro appliesTo", () => {
    const taxes = [
      makeTax({ id: "v", rate: 0.19, type: "IVA", appliesTo: "VENTAS" }),
      makeTax({ id: "c", rate: 0.05, type: "IVA", appliesTo: "COMPRAS" }),
    ];
    expect(getTaxRate(taxes, "IVA", "VENTAS")).toBe(0.19);
    expect(getTaxRate(taxes, "IVA", "COMPRAS")).toBe(0.05);
    // Sin filtro: la implementacion devuelve el primer match sin
    // discriminar appliesTo. El caller decide si usar el AMBOS o
    // pasarlo explicitamente. Aqui verificamos ese comportamiento.
    expect(getTaxRate(taxes, "IVA")).toBe(0.19);
  });

  it("AMBOS coincide con cualquier filtro", () => {
    const taxes = [makeTax({ type: "IVA", appliesTo: "AMBOS", rate: 0.19 })];
    expect(getTaxRate(taxes, "IVA", "VENTAS")).toBe(0.19);
    expect(getTaxRate(taxes, "IVA", "COMPRAS")).toBe(0.19);
  });
});

describe("resolveTaxRates", () => {
  it("si no hay taxes, devuelve defaults y marca usingDefaults", () => {
    const r = resolveTaxRates(undefined);
    expect(r.retention).toBe(DEFAULT_RETENTION_RATE);
    expect(r.iva).toBe(DEFAULT_IVA_RATE);
    expect(r.usingDefaults).toEqual({ retention: true, iva: true });
  });

  it("si solo hay IVA configurado, retencion cae al default", () => {
    const r = resolveTaxRates([makeTax({ type: "IVA", rate: 0.21 })]);
    expect(r.iva).toBe(0.21);
    expect(r.retention).toBe(DEFAULT_RETENTION_RATE);
    expect(r.usingDefaults).toEqual({ retention: true, iva: false });
  });

  it("orden de retencion: FUENTE > ICA > IVA", () => {
    const r = resolveTaxRates([
      makeTax({ type: "RETENCION_IVA", rate: 0.04 }),
      makeTax({ type: "RETENCION_ICA", rate: 0.05 }),
      makeTax({ type: "RETENCION_FUENTE", rate: 0.07 }),
    ]);
    expect(r.retention).toBe(0.07);
    expect(r.usingDefaults.retention).toBe(false);
  });

  it("si solo hay RETENCION_ICA, se usa esa", () => {
    const r = resolveTaxRates([
      makeTax({ type: "RETENCION_ICA", rate: 0.035 }),
    ]);
    expect(r.retention).toBe(0.035);
  });

  it("taxes inactivos no se toman", () => {
    const r = resolveTaxRates([
      makeTax({ type: "IVA", rate: 0.21, isActive: false }),
    ]);
    expect(r.iva).toBe(DEFAULT_IVA_RATE);
    expect(r.usingDefaults.iva).toBe(true);
  });
});
