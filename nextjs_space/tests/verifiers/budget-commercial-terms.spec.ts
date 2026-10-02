/**
 * tests/verifiers/budget-commercial-terms.spec.ts
 *
 * Verifier para docs/specs/gap-analysis-cliente-control-cambios.md §3.1
 * ("Condiciones comerciales en cotización").
 *
 * Cubre:
 *  - AC-1: paymentTerms (anticipo + cortes + contra_entrega) suma 100.
 *  - AC-2: paymentTerms rechaza si suma ≠ 100.
 *  - AC-3: paymentTerms rechaza si cualquier porcentaje es negativo o > 100.
 *  - AC-4: deliveryDays y offerValidityDays son enteros >= 0.
 *  - AC-5: asesor comercial — campos opcionales; email validado si presente.
 *  - AC-6: commercialTerms opcional — omitir todo el bloque pasa.
 *  - AC-7: backwards-compat — un budget SIN commercialTerms pasa igual
 *    (no rompe datos viejos con `payment_terms_json = NULL`).
 *  - AC-8: codigos de error estables (no asertamos sobre texto).
 */
import { describe, it, expect } from "vitest";
import {
  validatePaymentTerms,
  validateCommercialAdvisor,
  validateBudgetCommercialTerms,
  isPaymentTermsComplete,
  type PaymentTermsInput,
  type CommercialAdvisorInput,
} from "@/lib/budgets-validation";

const okTerms: PaymentTermsInput = {
  anticipoPct: 50,
  cortesPct: 40,
  contraEntregaPct: 10,
};

const okAdvisor: CommercialAdvisorInput = {
  name: "Julia Naranjo",
  role: "Gerente de Proyectos",
  phone: "3203001000",
  email: "julia.naranjo@marzotriangular.com",
};

describe("Budgets — Condiciones comerciales (AC-1..AC-8)", () => {
  describe("AC-1/AC-2: paymentTerms suman 100", () => {
    it("50/40/10 → ok", () => {
      const r = validatePaymentTerms(okTerms);
      expect(r.ok).toBe(true);
    });

    it("30/40/30 → ok", () => {
      const r = validatePaymentTerms({
        anticipoPct: 30,
        cortesPct: 40,
        contraEntregaPct: 30,
      });
      expect(r.ok).toBe(true);
    });

    it("0/0/100 → ok (sin anticipo, todo contra entrega)", () => {
      const r = validatePaymentTerms({
        anticipoPct: 0,
        cortesPct: 0,
        contraEntregaPct: 100,
      });
      expect(r.ok).toBe(true);
    });

    it("50/40/5 → 95%, rechaza", () => {
      const r = validatePaymentTerms({
        anticipoPct: 50,
        cortesPct: 40,
        contraEntregaPct: 5,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("PAYMENT_TERMS_NOT_100");
    });

    it("60/40/10 → 110%, rechaza", () => {
      const r = validatePaymentTerms({
        anticipoPct: 60,
        cortesPct: 40,
        contraEntregaPct: 10,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("PAYMENT_TERMS_NOT_100");
    });

    it("acepta tolerancias de redondeo ±0.01", () => {
      // 33.33 + 33.33 + 33.34 = 100.00
      const r = validatePaymentTerms({
        anticipoPct: 33.33,
        cortesPct: 33.33,
        contraEntregaPct: 33.34,
      });
      expect(r.ok).toBe(true);
    });
  });

  describe("AC-3: rangos por porcentaje", () => {
    it("rechaza anticipoPct < 0", () => {
      const r = validatePaymentTerms({
        anticipoPct: -1,
        cortesPct: 51,
        contraEntregaPct: 50,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("PAYMENT_TERMS_OUT_OF_RANGE");
    });

    it("rechaza cortesPct > 100", () => {
      const r = validatePaymentTerms({
        anticipoPct: 0,
        cortesPct: 150,
        contraEntregaPct: 0,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("PAYMENT_TERMS_OUT_OF_RANGE");
    });
  });

  describe("AC-4: deliveryDays / offerValidityDays", () => {
    it("deliveryDays 45 / offerValidityDays 30 → ok", () => {
      const r = validateBudgetCommercialTerms({
        paymentTerms: okTerms,
        deliveryDays: 45,
        offerValidityDays: 30,
      });
      expect(r.ok).toBe(true);
    });

    it("deliveryDays negativo → rechaza", () => {
      const r = validateBudgetCommercialTerms({
        paymentTerms: okTerms,
        deliveryDays: -5,
        offerValidityDays: 30,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("DELIVERY_DAYS_INVALID");
    });

    it("deliveryDays no entero → rechaza", () => {
      const r = validateBudgetCommercialTerms({
        paymentTerms: okTerms,
        deliveryDays: 45.5,
        offerValidityDays: 30,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("DELIVERY_DAYS_INVALID");
    });

    it("offerValidityDays 0 → ok (sin caducidad)", () => {
      const r = validateBudgetCommercialTerms({
        paymentTerms: okTerms,
        deliveryDays: 45,
        offerValidityDays: 0,
      });
      expect(r.ok).toBe(true);
    });
  });

  describe("AC-5: asesor comercial opcional", () => {
    it("asesor con email inválido → rechaza", () => {
      const r = validateCommercialAdvisor({
        ...okAdvisor,
        email: "no-es-email",
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("ADVISOR_EMAIL_INVALID");
    });

    it("asesor con email vacío → rechazado (si lo manda, debe ser válido)", () => {
      const r = validateCommercialAdvisor({ ...okAdvisor, email: "" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("ADVISOR_EMAIL_INVALID");
    });

    it("asesor con email válido + name + role → ok", () => {
      const r = validateCommercialAdvisor(okAdvisor);
      expect(r.ok).toBe(true);
    });
  });

  describe("AC-6: commercialTerms opcional (backwards-compat)", () => {
    it("undefined → ok (no se rompió nada)", () => {
      const r = validateBudgetCommercialTerms(undefined);
      expect(r.ok).toBe(true);
    });

    it("objeto vacío {} → ok (módulo opcional, defaults)", () => {
      const r = validateBudgetCommercialTerms({});
      expect(r.ok).toBe(true);
    });

    it("solo paymentTerms sin advisor → ok", () => {
      const r = validateBudgetCommercialTerms({ paymentTerms: okTerms });
      expect(r.ok).toBe(true);
    });
  });

  describe("AC-7: backwards-compat budgets viejos", () => {
    it("isPaymentTermsComplete(undefined) === false", () => {
      expect(isPaymentTermsComplete(undefined)).toBe(false);
    });

    it("isPaymentTermsComplete({anticipoPct:0, ...}) === false", () => {
      // falta cuando todos los campos son null
      expect(
        isPaymentTermsComplete({
          anticipoPct: null as unknown as number,
          cortesPct: null as unknown as number,
          contraEntregaPct: null as unknown as number,
        }),
      ).toBe(false);
    });

    it("isPaymentTermsComplete(okTerms) === true", () => {
      expect(isPaymentTermsComplete(okTerms)).toBe(true);
    });
  });

  describe("AC-8: códigos de error estables", () => {
    it("union literal de códigos", () => {
      const r = validatePaymentTerms({
        anticipoPct: 50,
        cortesPct: 40,
        contraEntregaPct: 5,
      });
      if (!r.ok) {
        // NO asertamos sobre texto; solo el code.
        expect(typeof r.code).toBe("string");
        expect([
          "PAYMENT_TERMS_NOT_100",
          "PAYMENT_TERMS_OUT_OF_RANGE",
        ]).toContain(r.code);
      }
    });
  });
});
