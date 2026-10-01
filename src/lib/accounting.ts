/**
 * lib/accounting.ts
 *
 * Cálculos del módulo de Contabilidad: saldos, resumen del panel,
 * agrupaciones, serie mensual, avance de metas y exportación a CSV.
 *
 * Todo es puro y sin dependencias de React para poder verificarse en
 * tests/verifiers/accounting-module.spec.ts.
 *
 * Spec: /docs/specs/accounting-module.md
 */

import type {
  AccountingAccount,
  AccountingExpense,
  AccountingGoal,
  AccountingIncome,
  AccountingTaxMovement,
} from "@/types";
import { ACCOUNTING_ACCOUNT_TYPE_LABELS } from "./accounting-constants";

export interface AccountingDataset {
  incomes: AccountingIncome[];
  expenses: AccountingExpense[];
  taxMovements: AccountingTaxMovement[];
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Valor final del ingreso: valor − impuestos (nunca negativo). AC-4. */
export function incomeNetAmount(income: Pick<AccountingIncome, "amount" | "taxes">): number {
  return Math.max(0, num(income.amount) - num(income.taxes));
}

/** Valor efectivamente recibido de un ingreso cobrado. */
export function incomeReceivedAmount(income: AccountingIncome): number {
  if (income.status !== "PAGADO") return 0;
  return income.paidAmount != null ? num(income.paidAmount) : incomeNetAmount(income);
}

/**
 * Saldo actual de una cuenta: saldo inicial + cobros − pagos − impuestos
 * pagados imputados a esa cuenta. Nunca se persiste. AC-11.
 */
export function accountBalance(
  account: AccountingAccount,
  data: AccountingDataset,
): number {
  const inflow = data.incomes
    .filter((i) => i.status === "PAGADO" && i.accountId === account.id)
    .reduce((sum, i) => sum + incomeReceivedAmount(i), 0);
  const outflow = data.expenses
    .filter((e) => e.status === "PAGADO" && e.accountId === account.id)
    .reduce((sum, e) => sum + num(e.amount), 0);
  const taxes = data.taxMovements
    .filter((t) => t.status === "PAGADO" && t.accountId === account.id)
    .reduce((sum, t) => sum + num(t.amount), 0);
  return num(account.openingBalance) + inflow - outflow - taxes;
}

export interface AccountingSummary {
  totalIncome: number;
  totalOperatingExpenses: number;
  totalTaxes: number;
  totalExpenses: number;
  balance: number;
  /** Margen en % sobre los ingresos (0 si no hay ingresos). */
  margin: number;
}

/** KPIs del panel. Los impuestos se cuentan solo del año indicado. AC-15. */
export function summarize(
  data: AccountingDataset,
  year: number = new Date().getFullYear(),
): AccountingSummary {
  const totalIncome = data.incomes.reduce((sum, i) => sum + num(i.amount), 0);
  const totalOperatingExpenses = data.expenses.reduce(
    (sum, e) => sum + num(e.amount),
    0,
  );
  const totalTaxes = data.taxMovements
    .filter((t) => String(t.date ?? "").startsWith(String(year)))
    .reduce((sum, t) => sum + num(t.amount), 0);
  const totalExpenses = totalOperatingExpenses + totalTaxes;
  const balance = totalIncome - totalExpenses;
  return {
    totalIncome,
    totalOperatingExpenses,
    totalTaxes,
    totalExpenses,
    balance,
    margin: totalIncome > 0 ? (balance / totalIncome) * 100 : 0,
  };
}

export interface GroupRow {
  key: string;
  total: number;
}

/** Agrupa y suma, ordenado de mayor a menor. AC-16. */
export function groupSum<T>(
  rows: T[],
  keyOf: (row: T) => string | null | undefined,
  valueOf: (row: T) => number,
  fallbackKey = "Sin asignar",
): GroupRow[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const rawKey = keyOf(row);
    const key = rawKey && String(rawKey).trim() ? String(rawKey).trim() : fallbackKey;
    map.set(key, (map.get(key) ?? 0) + num(valueOf(row)));
  }
  return Array.from(map.entries())
    .map(([key, total]) => ({ key, total }))
    .sort((a, b) => b.total - a.total);
}

export interface MonthPoint {
  month: string;
  incomes: number;
  expenses: number;
}

/** Serie mensual YYYY-MM ascendente de ingresos vs gastos. AC-16. */
export function monthlySeries(
  incomes: AccountingIncome[],
  expenses: AccountingExpense[],
): MonthPoint[] {
  const map = new Map<string, MonthPoint>();
  const bucket = (date: string): MonthPoint | null => {
    const month = String(date ?? "").slice(0, 7);
    if (month.length !== 7) return null;
    let point = map.get(month);
    if (!point) {
      point = { month, incomes: 0, expenses: 0 };
      map.set(month, point);
    }
    return point;
  };
  for (const i of incomes) {
    const point = bucket(i.date);
    if (point) point.incomes += num(i.amount);
  }
  for (const e of expenses) {
    const point = bucket(e.date);
    if (point) point.expenses += num(e.amount);
  }
  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

export interface GoalProgress {
  incomeTotal: number;
  expenseTotal: number;
  incomePercent: number;
  expensePercent: number;
  expenseExceeded: boolean;
  savings: number;
  savingsPercent: number;
}

/** Avance de las metas para el mes indicado (YYYY-MM). AC-18. */
export function goalProgress(
  goal: AccountingGoal | null | undefined,
  data: Pick<AccountingDataset, "incomes" | "expenses">,
  month: string = new Date().toISOString().slice(0, 7),
): GoalProgress {
  const incomeTotal = data.incomes
    .filter((i) => String(i.date ?? "").startsWith(month))
    .reduce((sum, i) => sum + num(i.amount), 0);
  const expenseTotal = data.expenses
    .filter((e) => String(e.date ?? "").startsWith(month))
    .reduce((sum, e) => sum + num(e.amount), 0);
  const savings = incomeTotal - expenseTotal;
  const pct = (value: number, target: number) =>
    target > 0 ? (value / target) * 100 : 0;
  return {
    incomeTotal,
    expenseTotal,
    incomePercent: pct(incomeTotal, num(goal?.monthlyIncome)),
    expensePercent: pct(expenseTotal, num(goal?.maxExpense)),
    expenseExceeded: num(goal?.maxExpense) > 0 && expenseTotal > num(goal?.maxExpense),
    savings,
    savingsPercent: pct(savings, num(goal?.monthlySavings)),
  };
}

// ---------------------------------------------------------------------------
// Exportación CSV (AC-17)
// ---------------------------------------------------------------------------

const SEP = ";"; // separador que Excel es-CO abre sin asistente

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function rowsToCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(cell).join(SEP)).join("\r\n");
}

export interface FullReportInput {
  scopeLabel: string;
  incomes: AccountingIncome[];
  expenses: AccountingExpense[];
  accounts: AccountingAccount[];
  taxMovements: AccountingTaxMovement[];
  year?: number;
  projectNameOf?: (projectId: string | null | undefined) => string;
}

/** Reporte completo en CSV (UTF-8 con BOM) con las 5 secciones. */
export function buildFullReportCsv(input: FullReportInput): string {
  const year = input.year ?? new Date().getFullYear();
  const dataset: AccountingDataset = {
    incomes: input.incomes,
    expenses: input.expenses,
    taxMovements: input.taxMovements,
  };
  const s = summarize(dataset, year);
  const projectName = input.projectNameOf ?? (() => "General");

  const blocks: string[] = [];

  blocks.push(
    rowsToCsv([
      ["RESUMEN"],
      ["Alcance", input.scopeLabel],
      ["Generado", new Date().toISOString().slice(0, 19).replace("T", " ")],
      ["Ingresos totales", s.totalIncome],
      ["Gastos operativos", s.totalOperatingExpenses],
      [`Impuestos ${year}`, s.totalTaxes],
      ["Gastos totales", s.totalExpenses],
      ["Balance", s.balance],
      ["Margen (%)", s.margin.toFixed(1)],
    ]),
  );

  blocks.push(
    rowsToCsv([
      ["INGRESOS"],
      [
        "Fecha",
        "Proyecto",
        "Centro de costo",
        "Creador",
        "Cliente",
        "Factura",
        "Valor",
        "Impuestos",
        "Valor final",
        "Estado",
        "Valor pagado",
      ],
      ...input.incomes.map((i) => [
        i.date,
        projectName(i.projectId),
        i.costCenter,
        i.creator,
        i.clientName,
        i.invoice,
        num(i.amount),
        num(i.taxes),
        incomeNetAmount(i),
        i.status,
        i.status === "PAGADO" ? incomeReceivedAmount(i) : "",
      ]),
    ]),
  );

  blocks.push(
    rowsToCsv([
      ["GASTOS"],
      [
        "Fecha",
        "Proyecto",
        "Centro de costo",
        "Responsable",
        "Proveedor",
        "Concepto",
        "Detalle",
        "Valor",
        "Estado",
      ],
      ...input.expenses.map((e) => [
        e.date,
        projectName(e.projectId),
        e.costCenter,
        e.responsible,
        e.providerName,
        e.concept,
        e.detail ?? "",
        num(e.amount),
        e.status,
      ]),
    ]),
  );

  blocks.push(
    rowsToCsv([
      ["CUENTAS"],
      ["Nombre", "Tipo", "Saldo inicial", "Saldo actual", "Notas"],
      ...input.accounts.map((a) => [
        a.name,
        ACCOUNTING_ACCOUNT_TYPE_LABELS[a.type] ?? a.type,
        num(a.openingBalance),
        accountBalance(a, dataset),
        a.notes ?? "",
      ]),
    ]),
  );

  blocks.push(
    rowsToCsv([
      ["IMPUESTOS"],
      ["Fecha", "Entidad", "Descripción", "Valor", "Estado"],
      ...input.taxMovements.map((t) => [
        t.date,
        t.authority,
        t.description,
        num(t.amount),
        t.status,
      ]),
    ]),
  );

  return `﻿${blocks.join("\r\n\r\n")}\r\n`;
}

/** Dispara la descarga del CSV en el navegador. */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
