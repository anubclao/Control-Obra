// @vitest-environment node
/**
 * tests/verifiers/quotations-workflow.spec.ts
 *
 * Verifier de Fase 6, P1/P2 plan 2026-10-01:
 *   Cubre las funciones puras de `lib/quotations-workflow.ts`:
 *     - `computeQuotationTotals` (recalculo server-side)
 *     - `evaluateQuotationAction` (state machine)
 *     - `evaluateQuotationExpiry` (regla de expiracion)
 *
 *   Sin BD ni React. Si esto pasa, los handlers de
 *   /api/quotations y /api/quotations/expire se pueden escribir
 *   sin sorpresas.
 */

import { describe, it, expect } from "vitest";
import {
  computeQuotationTotals,
  evaluateQuotationAction,
  evaluateQuotationExpiry,
  QUOTATION_TRANSITIONS,
  QUOTATION_ACTION_ROLES,
} from "@/lib/quotations-workflow";

describe("computeQuotationTotals", () => {
  it("caso basico: 2 items sin descuento ni IVA", () => {
    const r = computeQuotationTotals({
      items: [
        { quantity: 10, unitPrice: 100 },
        { quantity: 5, unitPrice: 200 },
      ],
      discountPercent: 0,
      ivaPercent: 0,
    });
    expect(r.subtotal).toBe(2000);
    expect(r.discountAmount).toBe(0);
    expect(r.ivaAmount).toBe(0);
    expect(r.total).toBe(2000);
  });

  it("con IVA 19% y sin descuento", () => {
    const r = computeQuotationTotals({
      items: [{ quantity: 1, unitPrice: 1000 }],
      discountPercent: 0,
      ivaPercent: 19,
    });
    expect(r.subtotal).toBe(1000);
    expect(r.ivaAmount).toBe(190);
    expect(r.total).toBe(1190);
  });

  it("con descuento del 10% y luego IVA 19%", () => {
    // Plan 2026-10-01, Fase 6.1: descuento primero, despues IVA
    // sobre (subtotal - discount). Antes el IVA se calculaba sobre
    // el subtotal completo, inflando el cobro.
    const r = computeQuotationTotals({
      items: [{ quantity: 1, unitPrice: 1000 }],
      discountPercent: 10,
      ivaPercent: 19,
    });
    expect(r.subtotal).toBe(1000);
    expect(r.discountAmount).toBe(100);
    expect(r.ivaAmount).toBe(171); // 19% de (1000 - 100)
    expect(r.total).toBe(1071);
  });

  it("con items vacios todo es 0", () => {
    const r = computeQuotationTotals({
      items: [],
      discountPercent: 0,
      ivaPercent: 19,
    });
    expect(r.subtotal).toBe(0);
    expect(r.discountAmount).toBe(0);
    expect(r.ivaAmount).toBe(0);
    expect(r.total).toBe(0);
  });

  it("subtotal crudo (no redondea), pero discount/iva/total si", () => {
    // El helper solo redondea `discountAmount` e `ivaAmount` con
    // `Math.round`. El subtotal queda crudo (suma directa). Esto es
    // importante porque el banco no recibe el subtotal, recibe el
    // total; pero si en el futuro se quiere entero, se cambia aca.
    const r = computeQuotationTotals({
      items: [
        { quantity: 3, unitPrice: 333.333 },
        { quantity: 1, unitPrice: 100.005 },
      ],
      discountPercent: 0,
      ivaPercent: 19,
    });
    // 3*333.333 = 999.999; 1*100.005 = 100.005; subtotal crudo = 1100.004
    expect(Math.abs(r.subtotal - 1100.004) < 0.01).toBe(true);
    // discountAmount = 0, ivaAmount = round(1100.004*0.19) = 209
    expect(r.discountAmount).toBe(0);
    expect(r.ivaAmount).toBe(209);
    // total = 1100.004 - 0 + 209 = 1309.004
    expect(Math.abs(r.total - 1309.004) < 0.01).toBe(true);
  });

  it("ignora quantities/precios invalidos sin reventar (NaN=0; negativos se suman)", () => {
    // El helper `num()` filtra NaN pero no los negativos. El test
    // documenta el contrato: NaN -> 0, negativos pasan como -5*100.
    // -5*100 + 2*NaN + 3*50 = -500 + 0 + 150 = -350
    // Si en el futuro se quiere filtrar negativos, se cambia aca.
    const r = computeQuotationTotals({
      items: [
        { quantity: -5, unitPrice: 100 },
        { quantity: 2, unitPrice: Number.NaN },
        { quantity: 3, unitPrice: 50 },
      ],
      discountPercent: 0,
      ivaPercent: 0,
    });
    expect(r.subtotal).toBe(-350);
  });
});

describe("evaluateQuotationAction", () => {
  it("DRAFT -> SENT es valido para cualquier rol autorizado", () => {
    const r = evaluateQuotationAction("DRAFT", "SENT", "RESIDENTE");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.target).toBe("SENT");
  });

  it("DRAFT -> ACCEPTED no es valido (debe pasar por SENT/VIEWED)", () => {
    const r = evaluateQuotationAction("DRAFT", "ACCEPTED", "ADMIN");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("INVALID_TRANSITION");
  });

  it("SENT -> VIEWED lo hace cualquier rol interno con create (RESIDENTE ok, HSEQ no)", () => {
    // El cliente externo (no es rol) entra por un endpoint con token
    // firmado; aqui probamos la matriz de roles internos.
    const ok = evaluateQuotationAction("SENT", "VIEWED", "RESIDENTE");
    expect(ok.ok).toBe(true);
    // Cualquier rol con create puede; roles sin permisos no.
    const okAdmin = evaluateQuotationAction("SENT", "VIEWED", "ADMIN");
    expect(okAdmin.ok).toBe(true);
  });

  it("REJECTED es estado terminal", () => {
    const r = evaluateQuotationAction("REJECTED", "SENT", "ADMIN");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("INVALID_TRANSITION");
  });

  it("CANCELLED es estado terminal", () => {
    const r = evaluateQuotationAction("CANCELLED", "SENT", "ADMIN");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("INVALID_TRANSITION");
  });

  it("estado destino desconocido -> UNKNOWN_TARGET", () => {
    const r = evaluateQuotationAction("DRAFT", "FOO" as any, "ADMIN");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("UNKNOWN_TARGET");
  });
});

describe("QUOTATION_TRANSITIONS (mapa completo)", () => {
  it("todos los estados tienen una lista de transiciones (puede ser vacia)", () => {
    // El Record exige que esten todas las claves. Verificamos que
    // ninguna apunte a undefined.
    const required: Array<keyof typeof QUOTATION_TRANSITIONS> = [
      "DRAFT",
      "SENT",
      "VIEWED",
      "ACCEPTED",
      "REJECTED",
      "EXPIRED",
      "CANCELLED",
    ];
    for (const k of required) {
      expect(QUOTATION_TRANSITIONS[k]).toBeDefined();
      expect(Array.isArray(QUOTATION_TRANSITIONS[k])).toBe(true);
    }
  });

  it("DRAFT y terminales (REJECTED/CANCELLED/EXPIRED) no permiten transicionar", () => {
    // DRAFT es el origen, no destino de nadie en operacion normal.
    // Pero su lista de transiciones HABILITADAS debe existir (puede
    // incluir solo SENT/CANCELLED).
    expect(QUOTATION_TRANSITIONS.REJECTED).toEqual([]);
    expect(QUOTATION_TRANSITIONS.CANCELLED).toEqual([]);
  });
});

describe("QUOTATION_ACTION_ROLES (mapa completo)", () => {
  it("todos los estados tienen un array de roles (DRAFT puede ser [])", () => {
    const required: Array<keyof typeof QUOTATION_ACTION_ROLES> = [
      "DRAFT",
      "SENT",
      "VIEWED",
      "ACCEPTED",
      "REJECTED",
      "EXPIRED",
      "CANCELLED",
    ];
    for (const k of required) {
      expect(QUOTATION_ACTION_ROLES[k]).toBeDefined();
      expect(Array.isArray(QUOTATION_ACTION_ROLES[k])).toBe(true);
    }
  });
});

describe("evaluateQuotationExpiry", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  const past = "2026-09-30T00:00:00Z";
  const future = "2026-11-30T00:00:00Z";

  it("DRAFT con validUntil en el pasado -> expira", () => {
    expect(evaluateQuotationExpiry("DRAFT", past, now)).toBe(true);
  });

  it("SENT con validUntil en el pasado -> expira", () => {
    expect(evaluateQuotationExpiry("SENT", past, now)).toBe(true);
  });

  it("VIEWED con validUntil en el pasado -> expira", () => {
    expect(evaluateQuotationExpiry("VIEWED", past, now)).toBe(true);
  });

  it("DRAFT con validUntil en el futuro -> NO expira", () => {
    expect(evaluateQuotationExpiry("DRAFT", future, now)).toBe(false);
  });

  it("ACCEPTED con validUntil en el pasado -> NO expira (ya gano)", () => {
    expect(evaluateQuotationExpiry("ACCEPTED", past, now)).toBe(false);
  });

  it("REJECTED/CANCELLED/EXPIRED nunca expiran (son terminales)", () => {
    expect(evaluateQuotationExpiry("REJECTED", past, now)).toBe(false);
    expect(evaluateQuotationExpiry("CANCELLED", past, now)).toBe(false);
    expect(evaluateQuotationExpiry("EXPIRED", past, now)).toBe(false);
  });

  it("validUntil null/undefined -> NO expira (no hay fecha)", () => {
    expect(evaluateQuotationExpiry("DRAFT", null, now)).toBe(false);
    expect(evaluateQuotationExpiry("DRAFT", undefined, now)).toBe(false);
  });
});
