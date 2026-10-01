/**
 * tests/verifiers/contract-pricing-mode.spec.ts
 *
 * Verifier para docs/specs/gap-analysis-cliente-control-cambios.md §3.3
 * ("Modalidad de contratación en contrato").
 *
 * Cubre:
 *  - AC-1: Contract admite pricingMode ∈ {UNIT_PRICE, LUMP_SUM, COST_PLUS}.
 *  - AC-2: pricingMode es opcional y default UNIT_PRICE.
 *  - AC-3: backwards-compat — un contrato SIN pricingMode se normaliza a
 *    UNIT_PRICE (no rompe el dato viejo).
 *  - AC-4: pricingModeLabel devuelve etiqueta legible en español.
 *  - AC-5: pricingModeDescription devuelve la descripción del PDF.
 *  - AC-6: validatePricingMode rechaza valores fuera de la unión.
 *  - AC-7: códigos de error estables (no asertamos sobre texto).
 */
import { describe, it, expect } from "vitest";
import {
  CONTRACT_PRICING_MODES,
  DEFAULT_PRICING_MODE,
  pricingModeLabel,
  pricingModeDescription,
  normalizePricingMode,
  validatePricingMode,
  isPricingMode,
  type ContractPricingMode,
} from "@/lib/contracts-constants";

describe("Contract — Modalidad de contratación (AC-1..AC-7)", () => {
  describe("AC-1: unión de pricingMode", () => {
    it("UNIT_PRICE está en la unión", () => {
      expect(CONTRACT_PRICING_MODES).toContain("UNIT_PRICE");
    });

    it("LUMP_SUM está en la unión", () => {
      expect(CONTRACT_PRICING_MODES).toContain("LUMP_SUM");
    });

    it("COST_PLUS está en la unión", () => {
      expect(CONTRACT_PRICING_MODES).toContain("COST_PLUS");
    });

    it("exatamente 3 modalidades (no se añade ruido)", () => {
      expect(CONTRACT_PRICING_MODES.length).toBe(3);
    });
  });

  describe("AC-2: default UNIT_PRICE", () => {
    it("DEFAULT_PRICING_MODE === 'UNIT_PRICE'", () => {
      expect(DEFAULT_PRICING_MODE).toBe("UNIT_PRICE");
    });
  });

  describe("AC-3: backwards-compat", () => {
    it("normalizePricingMode(undefined) → UNIT_PRICE", () => {
      expect(normalizePricingMode(undefined)).toBe("UNIT_PRICE");
    });

    it("normalizePricingMode(null) → UNIT_PRICE", () => {
      expect(normalizePricingMode(null)).toBe("UNIT_PRICE");
    });

    it("normalizePricingMode('') → UNIT_PRICE", () => {
      expect(normalizePricingMode("")).toBe("UNIT_PRICE");
    });

    it("normalizePricingMode('UNIT_PRICE') → UNIT_PRICE (no muta)", () => {
      expect(normalizePricingMode("UNIT_PRICE")).toBe("UNIT_PRICE");
    });

    it("normalizePricingMode('LUMP_SUM') → LUMP_SUM", () => {
      expect(normalizePricingMode("LUMP_SUM")).toBe("LUMP_SUM");
    });
  });

  describe("AC-4: etiqueta legible", () => {
    it("UNIT_PRICE → 'Precios unitarios'", () => {
      expect(pricingModeLabel("UNIT_PRICE")).toBe("Precios unitarios");
    });

    it("LUMP_SUM → 'Suma alzada (llave en mano)'", () => {
      expect(pricingModeLabel("LUMP_SUM")).toBe("Suma alzada (llave en mano)");
    });

    it("COST_PLUS → 'Administración delegada'", () => {
      expect(pricingModeLabel("COST_PLUS")).toBe("Administración delegada");
    });
  });

  describe("AC-5: descripción del PDF", () => {
    it("UNIT_PRICE describe el caso del PDF (precios unitarios del contrato 0000025-0703)", () => {
      const d = pricingModeDescription("UNIT_PRICE");
      expect(d).toBeTruthy();
      expect(d.toLowerCase()).toContain("cantidad");
    });

    it("LUMP_SUM describe 'todo costo'", () => {
      const d = pricingModeDescription("LUMP_SUM");
      expect(d.toLowerCase()).toContain("global");
    });

    it("COST_PLUS describe 'reembolso'", () => {
      const d = pricingModeDescription("COST_PLUS");
      expect(d.toLowerCase()).toMatch(/honorari|reembolso/);
    });
  });

  describe("AC-6: validación rechaza valores fuera de la unión", () => {
    it("'PRECIOS_UNITARIOS' (string humano) → rechaza", () => {
      const r = validatePricingMode("PRECIOS_UNITARIOS");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("PRICING_MODE_INVALID");
    });

    it("'SUMA_ALZADA' (string humano) → rechaza", () => {
      const r = validatePricingMode("SUMA_ALZADA");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("PRICING_MODE_INVALID");
    });

    it("'UNIT_PRICE' → ok", () => {
      const r = validatePricingMode("UNIT_PRICE");
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBe("UNIT_PRICE");
    });

    it("null → ok con default UNIT_PRICE (no rompe datos viejos)", () => {
      const r = validatePricingMode(null);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBe("UNIT_PRICE");
    });

    it("undefined → ok con default UNIT_PRICE", () => {
      const r = validatePricingMode(undefined);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBe("UNIT_PRICE");
    });

    it("tipo equivocado (número) → rechaza", () => {
      const r = validatePricingMode(42 as unknown as string);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("PRICING_MODE_INVALID");
    });
  });

  describe("AC-7: type guard", () => {
    it("isPricingMode('UNIT_PRICE') === true", () => {
      expect(isPricingMode("UNIT_PRICE")).toBe(true);
    });

    it("isPricingMode('LUMP_SUM') === true", () => {
      expect(isPricingMode("LUMP_SUM")).toBe(true);
    });

    it("isPricingMode('COST_PLUS') === true", () => {
      expect(isPricingMode("COST_PLUS")).toBe(true);
    });

    it("isPricingMode('LO_QUERA') === false", () => {
      expect(isPricingMode("LO_QUERA")).toBe(false);
    });

    it("isPricingMode(undefined) === false", () => {
      expect(isPricingMode(undefined)).toBe(false);
    });
  });
});
