"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Expense, ExpenseItem, ExpenseStatus, ExpenseType } from "@/types";
import { MOCK_EXPENSES } from "@/mocks";

interface ExpensesStore {
  expenses: Expense[];

  getExpense: (id: string) => Expense | undefined;
  getExpensesByProject: (projectId: string) => Expense[];
  getExpensesByProvider: (providerId: string) => Expense[];

  addExpense: (data: Omit<Expense, "id" | "expenseNumber" | "createdAt" | "status">) => Expense;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;

  // Acciones de workflow
  submitForApproval: (id: string) => void;
  approve: (id: string, by: string, byName: string) => void;
  reject: (id: string, reason: string) => void;
  markPaid: (id: string) => void;

  // Items
  addItem: (expenseId: string, item: Omit<ExpenseItem, "id" | "totalPrice">) => void;
  removeItem: (expenseId: string, itemId: string) => void;
}

const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  CONTRATO_OBRA_CIVIL_POLIZAS: "Contrato obra civil (con pólizas)",
  CONTRATO_OBRA_CIVIL_SIN_POLIZAS: "Contrato obra civil (sin pólizas)",
  PRESTACION_SERVICIOS: "Prestación de servicios",
  LABORAL_OBRA: "Laboral por obra",
  LABORAL_TERMINO_INDEFINIDO: "Laboral término indefinido",
  LABORAL_TERMINO_DEFINIDO: "Laboral término definido",
  ORDEN_SERVICIO_POLIZAS: "Orden de servicio (con pólizas)",
  ORDEN_SERVICIO_SIN_POLIZAS: "Orden de servicio (sin pólizas)",
  ORDEN_COMPRA_POLIZAS: "Orden de compra (con pólizas)",
  ORDEN_COMPRA_SIN_POLIZAS: "Orden de compra (sin pólizas)",
  SOLICITUD_RECURSO: "Solicitud de recursos (viáticos, caja menor, compras)",
  SOLICITUD_REINTEGRO: "Solicitud de reintegro",
  LEGALIZACION_GASTO: "Legalización de gastos",
};

// Categoría para agrupar en UI
const CONTRACT_TYPES: ExpenseType[] = [
  "CONTRATO_OBRA_CIVIL_POLIZAS",
  "CONTRATO_OBRA_CIVIL_SIN_POLIZAS",
];
const SERVICE_ORDER_TYPES: ExpenseType[] = [
  "ORDEN_SERVICIO_POLIZAS",
  "ORDEN_SERVICIO_SIN_POLIZAS",
];
const PURCHASE_ORDER_TYPES: ExpenseType[] = [
  "ORDEN_COMPRA_POLIZAS",
  "ORDEN_COMPRA_SIN_POLIZAS",
];
const LABOR_TYPES: ExpenseType[] = [
  "LABORAL_OBRA",
  "LABORAL_TERMINO_INDEFINIDO",
  "LABORAL_TERMINO_DEFINIDO",
];

function categoryFor(t: ExpenseType): "contrato" | "orden_servicio" | "orden_compra" | "laboral" | "recurso" {
  if (CONTRACT_TYPES.includes(t)) return "contrato";
  if (SERVICE_ORDER_TYPES.includes(t)) return "orden_servicio";
  if (PURCHASE_ORDER_TYPES.includes(t)) return "orden_compra";
  if (LABOR_TYPES.includes(t)) return "laboral";
  return "recurso";
}

export { EXPENSE_TYPE_LABELS, categoryFor };

const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  DRAFT: "Borrador",
  PENDING_APPROVAL: "Pendiente aprobación",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  PAID: "Pagado",
};

const EXPENSE_STATUS_VARIANTS: Record<ExpenseStatus, "default" | "warning" | "success" | "destructive" | "info"> = {
  DRAFT: "default",
  PENDING_APPROVAL: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
  PAID: "info",
};

export { EXPENSE_STATUS_LABELS, EXPENSE_STATUS_VARIANTS };

function nextId(prefix = "ex"): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

function nextExpenseNumber(expenses: Expense[]): string {
  const year = new Date().getFullYear();
  const sameYear = expenses.filter((e) => e.expenseNumber.startsWith(`GASTO-${year}`));
  const next = sameYear.length + 1;
  return `GASTO-${year}-${String(next).padStart(4, "0")}`;
}

function computeAmount(items: ExpenseItem[]): number {
  return items.reduce((s, it) => s + it.totalPrice, 0);
}

export const useExpensesStore = create<ExpensesStore>()(
  persist(
    (set, get) => ({
      expenses: MOCK_EXPENSES,

      getExpense: (id) => get().expenses.find((e) => e.id === id),
      getExpensesByProject: (projectId) =>
        get().expenses.filter((e) => e.projectId === projectId),
      getExpensesByProvider: (providerId) =>
        get().expenses.filter((e) => e.providerId === providerId),

      addExpense: (data) => {
        const expense: Expense = {
          ...data,
          id: nextId(),
          expenseNumber: nextExpenseNumber(get().expenses),
          status: "DRAFT",
          createdAt: new Date().toISOString(),
        };
        set({ expenses: [expense, ...get().expenses] });
        return expense;
      },

      updateExpense: (id, updates) => {
        set({
          expenses: get().expenses.map((e) => {
            if (e.id !== id) return e;
            const merged = { ...e, ...updates };
            if (updates.items) {
              merged.amount = computeAmount(updates.items);
            }
            return merged;
          }),
        });
      },

      deleteExpense: (id) => {
        set({ expenses: get().expenses.filter((e) => e.id !== id) });
      },

      submitForApproval: (id) => {
        set({
          expenses: get().expenses.map((e) =>
            e.id === id ? { ...e, status: "PENDING_APPROVAL" as ExpenseStatus } : e
          ),
        });
      },

      approve: (id, by, byName) => {
        set({
          expenses: get().expenses.map((e) =>
            e.id === id
              ? {
                  ...e,
                  status: "APPROVED" as ExpenseStatus,
                  approvedBy: by,
                  approvedByName: byName,
                  approvedAt: new Date().toISOString(),
                }
              : e
          ),
        });
      },

      reject: (id, reason) => {
        set({
          expenses: get().expenses.map((e) =>
            e.id === id
              ? { ...e, status: "REJECTED" as ExpenseStatus, rejectedReason: reason }
              : e
          ),
        });
      },

      markPaid: (id) => {
        set({
          expenses: get().expenses.map((e) =>
            e.id === id ? { ...e, status: "PAID" as ExpenseStatus } : e
          ),
        });
      },

      addItem: (expenseId, item) => {
        set({
          expenses: get().expenses.map((e) => {
            if (e.id !== expenseId) return e;
            const newItem: ExpenseItem = {
              ...item,
              id: nextId("ei"),
              totalPrice: item.quantity * item.unitPrice,
            };
            const items = [...e.items, newItem];
            return { ...e, items, amount: computeAmount(items) };
          }),
        });
      },

      removeItem: (expenseId, itemId) => {
        set({
          expenses: get().expenses.map((e) => {
            if (e.id !== expenseId) return e;
            const items = e.items.filter((it) => it.id !== itemId);
            return { ...e, items, amount: computeAmount(items) };
          }),
        });
      },
    }),
    { name: "controlobra-expenses" }
  )
);
