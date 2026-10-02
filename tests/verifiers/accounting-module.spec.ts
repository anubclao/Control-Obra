// VERIFIER: Módulo de Contabilidad
// SPEC: /docs/specs/accounting-module.md

import { describe, it, expect } from "vitest";
import {
  ACCOUNTING_EXPENSE_STATUS_LABELS,
  ACCOUNTING_INCOME_STATUS_LABELS,
  ACCOUNTING_TAX_STATUS_LABELS,
  canTransitionExpense,
  canTransitionIncome,
  canTransitionTaxMovement,
  validateIncome,
  validateExpense,
  validateTaxMovement,
} from "@/lib/accounting-constants";
import {
  accountBalance,
  buildFullReportCsv,
  goalProgress,
  groupSum,
  incomeNetAmount,
  monthlySeries,
  summarize,
} from "@/lib/accounting";
import type {
  AccountingAccount,
  AccountingExpense,
  AccountingIncome,
  AccountingTaxMovement,
} from "@/types";

const year = new Date().getFullYear();
const d = (month: number, day = 15) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const account: AccountingAccount = {
  id: "acc1",
  name: "Bancolombia",
  type: "CORRIENTE",
  openingBalance: 1_000_000,
  notes: "",
  isActive: true,
  createdAt: d(1),
};

function income(over: Partial<AccountingIncome> = {}): AccountingIncome {
  return {
    id: "i1",
    date: d(1),
    projectId: null,
    costCenter: "Administración",
    creator: "Ana",
    clientName: "Cliente A",
    invoice: "FE-1",
    amount: 1_000_000,
    taxes: 40_000,
    status: "POR_PAGAR",
    accountId: null,
    paidAmount: null,
    createdAt: d(1),
    ...over,
  };
}

function expense(over: Partial<AccountingExpense> = {}): AccountingExpense {
  return {
    id: "g1",
    date: d(1),
    projectId: null,
    costCenter: "Administración",
    responsible: "Ana",
    providerName: "Proveedor X",
    concept: "Cemento",
    detail: "",
    amount: 300_000,
    status: "POR_PAGAR",
    accountId: null,
    createdAt: d(1),
    ...over,
  };
}

function tax(over: Partial<AccountingTaxMovement> = {}): AccountingTaxMovement {
  return {
    id: "t1",
    date: d(1),
    projectId: null,
    authority: "DIAN",
    description: "IVA",
    amount: 100_000,
    status: "DECLARADO",
    accountId: null,
    createdAt: d(1),
    ...over,
  };
}

describe("Contabilidad — estados y workflow", () => {
  it("AC-3/AC-6/AC-13: expone etiquetas para todos los estados", () => {
    expect(Object.keys(ACCOUNTING_INCOME_STATUS_LABELS)).toEqual([
      "POR_PAGAR",
      "PAGADO",
    ]);
    expect(Object.keys(ACCOUNTING_EXPENSE_STATUS_LABELS)).toEqual([
      "POR_PAGAR",
      "APROBADO",
      "URGENTE",
      "NO_PAGAR",
      "RETEGARANTIA",
      "PAGADO",
    ]);
    expect(Object.keys(ACCOUNTING_TAX_STATUS_LABELS)).toEqual([
      "DECLARADO",
      "PAGADO",
    ]);
  });

  it("AC-7: permite las transiciones válidas de gasto", () => {
    expect(canTransitionExpense("POR_PAGAR", "APROBADO")).toBe(true);
    expect(canTransitionExpense("POR_PAGAR", "URGENTE")).toBe(true);
    expect(canTransitionExpense("URGENTE", "APROBADO")).toBe(true);
    expect(canTransitionExpense("APROBADO", "PAGADO")).toBe(true);
    expect(canTransitionExpense("RETEGARANTIA", "PAGADO")).toBe(true);
    expect(canTransitionExpense("NO_PAGAR", "POR_PAGAR")).toBe(true);
  });

  it("AC-7: rechaza transiciones inválidas y trata PAGADO como terminal", () => {
    expect(canTransitionExpense("POR_PAGAR", "PAGADO")).toBe(false);
    expect(canTransitionExpense("URGENTE", "PAGADO")).toBe(false);
    expect(canTransitionExpense("PAGADO", "POR_PAGAR")).toBe(false);
    expect(canTransitionExpense("PAGADO", "APROBADO")).toBe(false);
  });

  it("AC-7: mantener el mismo estado siempre es válido", () => {
    expect(canTransitionExpense("PAGADO", "PAGADO")).toBe(true);
    expect(canTransitionIncome("PAGADO", "PAGADO")).toBe(true);
  });

  it("AC-5/AC-14: ingresos e impuestos no vuelven atrás desde PAGADO", () => {
    expect(canTransitionIncome("POR_PAGAR", "PAGADO")).toBe(true);
    expect(canTransitionIncome("PAGADO", "POR_PAGAR")).toBe(false);
    expect(canTransitionTaxMovement("DECLARADO", "PAGADO")).toBe(true);
    expect(canTransitionTaxMovement("PAGADO", "DECLARADO")).toBe(false);
  });
});

describe("Contabilidad — validaciones", () => {
  it("AC-4: los impuestos no pueden superar el valor del ingreso", () => {
    const r = validateIncome(income({ amount: 100, taxes: 200 }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/impuesto/i);
  });

  it("AC-5: ingreso PAGADO exige cuenta y valor pagado válido", () => {
    expect(validateIncome(income({ status: "PAGADO" })).ok).toBe(false);
    expect(
      validateIncome(income({ status: "PAGADO", accountId: "acc1", paidAmount: 0 })).ok,
    ).toBe(false);
    expect(
      validateIncome(
        income({ status: "PAGADO", accountId: "acc1", paidAmount: 5_000_000 }),
      ).ok,
    ).toBe(false);
    expect(
      validateIncome(
        income({ status: "PAGADO", accountId: "acc1", paidAmount: 960_000 }),
      ).ok,
    ).toBe(true);
  });

  it("AC-8: gasto PAGADO exige cuenta de pago", () => {
    expect(validateExpense(expense({ status: "PAGADO" })).ok).toBe(false);
    expect(
      validateExpense(expense({ status: "PAGADO", accountId: "acc1" })).ok,
    ).toBe(true);
  });

  it("AC-14: impuesto PAGADO exige cuenta de pago", () => {
    expect(validateTaxMovement(tax({ status: "PAGADO" })).ok).toBe(false);
    expect(validateTaxMovement(tax({ status: "PAGADO", accountId: "acc1" })).ok).toBe(
      true,
    );
  });

  it("rechaza montos negativos", () => {
    expect(validateExpense(expense({ amount: -1 })).ok).toBe(false);
    expect(validateIncome(income({ amount: -1 })).ok).toBe(false);
    expect(validateTaxMovement(tax({ amount: -1 })).ok).toBe(false);
  });
});

describe("Contabilidad — cálculos", () => {
  it("AC-4: valor final = valor − impuestos", () => {
    expect(incomeNetAmount(income({ amount: 1_000_000, taxes: 40_000 }))).toBe(960_000);
  });

  it("AC-11: el saldo de cuenta se calcula desde los movimientos PAGADOS", () => {
    const saldo = accountBalance(account, {
      incomes: [
        income({ id: "i1", status: "PAGADO", accountId: "acc1", paidAmount: 500_000 }),
        income({ id: "i2", status: "POR_PAGAR", accountId: "acc1", paidAmount: 999 }),
        income({ id: "i3", status: "PAGADO", accountId: "otra", paidAmount: 700_000 }),
      ],
      expenses: [
        expense({ id: "g1", status: "PAGADO", accountId: "acc1", amount: 200_000 }),
        expense({ id: "g2", status: "APROBADO", accountId: "acc1", amount: 900_000 }),
      ],
      taxMovements: [
        tax({ id: "t1", status: "PAGADO", accountId: "acc1", amount: 100_000 }),
        tax({ id: "t2", status: "DECLARADO", accountId: "acc1", amount: 800_000 }),
      ],
    });
    // 1.000.000 + 500.000 − 200.000 − 100.000
    expect(saldo).toBe(1_200_000);
  });

  it("AC-15: resumen con impuestos del año en curso y margen", () => {
    const s = summarize(
      {
        incomes: [income({ amount: 1_000_000 }), income({ id: "i2", amount: 1_000_000 })],
        expenses: [expense({ amount: 500_000 })],
        taxMovements: [
          tax({ amount: 100_000 }),
          tax({ id: "t2", date: `${year - 1}-05-01`, amount: 999_999 }),
        ],
      },
      year,
    );
    expect(s.totalIncome).toBe(2_000_000);
    expect(s.totalOperatingExpenses).toBe(500_000);
    expect(s.totalTaxes).toBe(100_000);
    expect(s.totalExpenses).toBe(600_000);
    expect(s.balance).toBe(1_400_000);
    expect(s.margin).toBeCloseTo(70, 5);
  });

  it("AC-15: margen 0 cuando no hay ingresos", () => {
    const s = summarize({ incomes: [], expenses: [], taxMovements: [] }, year);
    expect(s.margin).toBe(0);
    expect(s.balance).toBe(0);
  });

  it("AC-16: agrupa y ordena de mayor a menor", () => {
    const rows = groupSum(
      [
        expense({ id: "a", providerName: "P1", amount: 100 }),
        expense({ id: "b", providerName: "P2", amount: 500 }),
        expense({ id: "c", providerName: "P1", amount: 50 }),
        expense({ id: "d", providerName: "", amount: 10 }),
      ],
      (e) => e.providerName,
      (e) => e.amount,
      "Sin proveedor",
    );
    expect(rows).toEqual([
      { key: "P2", total: 500 },
      { key: "P1", total: 150 },
      { key: "Sin proveedor", total: 10 },
    ]);
  });

  it("AC-16: serie mensual ascendente de ingresos vs gastos", () => {
    const serie = monthlySeries(
      [income({ date: d(3), amount: 100 }), income({ id: "i2", date: d(1), amount: 50 })],
      [expense({ date: d(3), amount: 70 })],
    );
    expect(serie.map((m) => m.month)).toEqual([`${year}-01`, `${year}-03`]);
    expect(serie[1]).toEqual({ month: `${year}-03`, incomes: 100, expenses: 70 });
  });

  it("AC-18: avance de metas del mes en curso", () => {
    const month = new Date().toISOString().slice(0, 7);
    const p = goalProgress(
      {
        id: "m1",
        projectId: null,
        monthlyIncome: 1000,
        maxExpense: 500,
        monthlySavings: 200,
      },
      {
        incomes: [income({ date: `${month}-05`, amount: 500 })],
        expenses: [expense({ date: `${month}-06`, amount: 600 })],
      },
      month,
    );
    expect(p.incomePercent).toBe(50);
    expect(p.expensePercent).toBe(120);
    expect(p.expenseExceeded).toBe(true);
    expect(p.savings).toBe(-100);
  });

  it("AC-17: el CSV del reporte incluye todas las secciones y BOM", () => {
    const csv = buildFullReportCsv({
      scopeLabel: "General",
      incomes: [income()],
      expenses: [expense()],
      accounts: [account],
      taxMovements: [tax()],
      year,
    });
    expect(csv.startsWith("﻿")).toBe(true);
    for (const section of ["RESUMEN", "INGRESOS", "GASTOS", "CUENTAS", "IMPUESTOS"]) {
      expect(csv).toContain(section);
    }
    // Los campos con el separador o comillas se escapan
    const escaped = buildFullReportCsv({
      scopeLabel: "x",
      incomes: [income({ clientName: 'Cliente; "A"' })],
      expenses: [],
      accounts: [],
      taxMovements: [],
      year,
    });
    expect(escaped).toContain('"Cliente; ""A"""');
  });
});
