// @vitest-environment node
/**
 * tests/verifiers/advances-suggestion.spec.ts
 *
 * Verifier de Fase 6.4 plan 2026-10-01:
 *   Cubre `suggestAdvanceDeduction(balance, netValue)` de
 *   `lib/advances.ts`. Esta funcion decide cuanto anticipo se puede
 *   amortizar en un corte sin que el monto supere lo que falta por
 *   pagar al proveedor (limite por contrato) ni el valor neto del
 *   corte (limite por factura).
 *
 *   `computeAdvanceBalance` no se testea aca porque requiere una
 *   conexion MySQL; queda cubierto por los tests de integracion de
 *   /api/cuts/advance-suggestion (manuales / DB real).
 */

import { describe, it, expect } from "vitest";
import { suggestAdvanceDeduction, type AdvanceBalance } from "@/lib/advances";

function balance(remaining: number): AdvanceBalance {
  return {
    contractValue: 1_000_000,
    advancePercent: 30,
    authorized: 300_000,
    disbursed: 0,
    remaining,
  };
}

describe("suggestAdvanceDeduction", () => {
  it("si el corte cubre exactamente el saldo pendiente, sugiere todo el saldo", () => {
    const r = suggestAdvanceDeduction(balance(200_000), 1_000_000);
    expect(r).toBe(200_000);
  });

  it("si el saldo es 0 (ya amortizado), sugiere 0", () => {
    const r = suggestAdvanceDeduction(balance(0), 500_000);
    expect(r).toBe(0);
  });

  it("si el saldo es mayor al neto del corte, sugiere el neto (no mas)", () => {
    const r = suggestAdvanceDeduction(balance(500_000), 200_000);
    expect(r).toBe(200_000);
  });

  it("si el saldo es negativo (no deberia pasar), sugiere 0 (defensivo)", () => {
    const r = suggestAdvanceDeduction(balance(-100), 500_000);
    expect(r).toBe(0);
  });

  it("si el neto del corte es 0 o negativo, sugiere 0", () => {
    expect(suggestAdvanceDeduction(balance(100_000), 0)).toBe(0);
    expect(suggestAdvanceDeduction(balance(100_000), -50)).toBe(0);
  });

  it("contrato sin anticipo configurado (0%) -> deduce 0", () => {
    const zero = {
      contractValue: 1_000_000,
      advancePercent: 0,
      authorized: 0,
      disbursed: 0,
      remaining: 0,
    } as AdvanceBalance;
    expect(suggestAdvanceDeduction(zero, 1_000_000)).toBe(0);
  });

  it("resultado siempre >= 0 (no devuelve negativos)", () => {
    const r = suggestAdvanceDeduction(balance(100_000), 1_000_000);
    expect(r).toBeGreaterThanOrEqual(0);
  });
});
