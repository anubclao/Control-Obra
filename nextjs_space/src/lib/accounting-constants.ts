/**
 * lib/accounting-constants.ts
 *
 * Etiquetas, workflow de estados y validaciones del módulo de Contabilidad.
 * Es código puro (sin React ni fetch) para poder usarse tanto en las API
 * routes (validación server-side) como en la UI.
 *
 * Spec: /docs/specs/accounting-module.md
 */

import type {
  AccountingAccountType,
  AccountingExpense,
  AccountingExpenseStatus,
  AccountingIncome,
  AccountingIncomeStatus,
  AccountingTaxMovement,
  AccountingTaxStatus,
} from "@/types";

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "info";

export const ACCOUNTING_INCOME_STATUS_LABELS: Record<AccountingIncomeStatus, string> = {
  POR_PAGAR: "Por cobrar",
  PAGADO: "Cobrado",
};

export const ACCOUNTING_INCOME_STATUS_VARIANTS: Record<
  AccountingIncomeStatus,
  BadgeVariant
> = {
  POR_PAGAR: "destructive",
  PAGADO: "success",
};

export const ACCOUNTING_EXPENSE_STATUS_LABELS: Record<AccountingExpenseStatus, string> = {
  POR_PAGAR: "Por pagar",
  APROBADO: "Aprobado",
  URGENTE: "Urgente",
  NO_PAGAR: "No pagar",
  RETEGARANTIA: "Retegarantía",
  PAGADO: "Pagado",
};

export const ACCOUNTING_EXPENSE_STATUS_VARIANTS: Record<
  AccountingExpenseStatus,
  BadgeVariant
> = {
  POR_PAGAR: "outline",
  APROBADO: "info",
  URGENTE: "warning",
  NO_PAGAR: "destructive",
  RETEGARANTIA: "secondary",
  PAGADO: "success",
};

export const ACCOUNTING_TAX_STATUS_LABELS: Record<AccountingTaxStatus, string> = {
  DECLARADO: "Declarado",
  PAGADO: "Pagado",
};

export const ACCOUNTING_TAX_STATUS_VARIANTS: Record<AccountingTaxStatus, BadgeVariant> = {
  DECLARADO: "warning",
  PAGADO: "success",
};

export const ACCOUNTING_ACCOUNT_TYPE_LABELS: Record<AccountingAccountType, string> = {
  CORRIENTE: "Cuenta corriente",
  AHORROS: "Cuenta de ahorros",
  TARJETA_CREDITO: "Tarjeta de crédito",
  EFECTIVO: "Efectivo / caja menor",
  PAYPAL: "PayPal",
  OTRA: "Otra",
};

/** Alcance "General" (sin proyecto) tal como viaja por querystring. */
export const ACCOUNTING_GENERAL_SCOPE = "general";

// ---------------------------------------------------------------------------
// Workflow de estados (AC-7, AC-5, AC-14)
// ---------------------------------------------------------------------------

export const ACCOUNTING_EXPENSE_TRANSITIONS: Record<
  AccountingExpenseStatus,
  AccountingExpenseStatus[]
> = {
  POR_PAGAR: ["APROBADO", "URGENTE", "NO_PAGAR", "RETEGARANTIA"],
  URGENTE: ["APROBADO", "NO_PAGAR", "RETEGARANTIA"],
  APROBADO: ["PAGADO", "URGENTE", "NO_PAGAR", "RETEGARANTIA"],
  RETEGARANTIA: ["APROBADO", "PAGADO", "NO_PAGAR"],
  NO_PAGAR: ["POR_PAGAR"],
  PAGADO: [],
};

export const ACCOUNTING_INCOME_TRANSITIONS: Record<
  AccountingIncomeStatus,
  AccountingIncomeStatus[]
> = {
  POR_PAGAR: ["PAGADO"],
  PAGADO: [],
};

export const ACCOUNTING_TAX_TRANSITIONS: Record<
  AccountingTaxStatus,
  AccountingTaxStatus[]
> = {
  DECLARADO: ["PAGADO"],
  PAGADO: [],
};

function allows<S extends string>(
  map: Record<S, S[]>,
  from: S | undefined | null,
  to: S,
): boolean {
  if (!from || from === to) return true; // no hay cambio de estado
  return (map[from] ?? []).includes(to);
}

export function canTransitionExpense(
  from: AccountingExpenseStatus | undefined | null,
  to: AccountingExpenseStatus,
): boolean {
  return allows(ACCOUNTING_EXPENSE_TRANSITIONS, from, to);
}

export function canTransitionIncome(
  from: AccountingIncomeStatus | undefined | null,
  to: AccountingIncomeStatus,
): boolean {
  return allows(ACCOUNTING_INCOME_TRANSITIONS, from, to);
}

export function canTransitionTaxMovement(
  from: AccountingTaxStatus | undefined | null,
  to: AccountingTaxStatus,
): boolean {
  return allows(ACCOUNTING_TAX_TRANSITIONS, from, to);
}

/** Estados a los que se puede mover un gasto desde `from` (para pintar botones). */
export function nextExpenseStatuses(
  from: AccountingExpenseStatus,
): AccountingExpenseStatus[] {
  return ACCOUNTING_EXPENSE_TRANSITIONS[from] ?? [];
}

// ---------------------------------------------------------------------------
// Validaciones (AC-4, AC-5, AC-8, AC-14)
// ---------------------------------------------------------------------------

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

const OK: ValidationResult = { ok: true };
const fail = (error: string): ValidationResult => ({ ok: false, error });

function isMoney(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function validateIncome(
  income: Partial<AccountingIncome>,
): ValidationResult {
  if (!income.date) return fail("La fecha es obligatoria");
  if (!isMoney(income.amount)) return fail("El valor debe ser un número positivo");
  const taxes = income.taxes ?? 0;
  if (!isMoney(taxes)) return fail("Los impuestos deben ser un número positivo");
  if (taxes > (income.amount ?? 0)) {
    return fail("Los impuestos no pueden superar el valor del ingreso");
  }
  if (income.status === "PAGADO") {
    if (!income.accountId) return fail("Debe indicar la cuenta donde se recibió el pago");
    const net = (income.amount ?? 0) - taxes;
    const paid = income.paidAmount ?? net;
    if (!isMoney(paid) || paid <= 0) {
      return fail("El valor pagado debe ser mayor que cero");
    }
    if (paid > net) return fail("El valor pagado no puede superar el valor final");
  }
  return OK;
}

export function validateExpense(
  expense: Partial<AccountingExpense>,
): ValidationResult {
  if (!expense.date) return fail("La fecha es obligatoria");
  if (!isMoney(expense.amount)) return fail("El valor debe ser un número positivo");
  if (expense.status === "PAGADO" && !expense.accountId) {
    return fail("Debe indicar la cuenta de pago");
  }
  return OK;
}

export function validateTaxMovement(
  movement: Partial<AccountingTaxMovement>,
): ValidationResult {
  if (!movement.date) return fail("La fecha es obligatoria");
  if (!isMoney(movement.amount)) return fail("El valor debe ser un número positivo");
  if (movement.status === "PAGADO" && !movement.accountId) {
    return fail("Debe indicar la cuenta de pago");
  }
  return OK;
}
