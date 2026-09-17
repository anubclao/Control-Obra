/**
 * lib/accounting-store.ts
 *
 * Store Zustand del módulo de Contabilidad. Vive aparte de data-store.ts
 * porque necesita algo que las demás colecciones no tienen: un **alcance**
 * (proyecto o General) que se propaga a los 4 endpoints a la vez.
 *
 * Uso:
 *   const { incomes, load, setScope } = useAccountingStore();
 *
 * Spec: /docs/specs/accounting-module.md
 */

import { create } from "zustand";
import { api } from "./api";
import { ACCOUNTING_GENERAL_SCOPE } from "./accounting-constants";
import type {
  AccountingAccount,
  AccountingExpense,
  AccountingGoal,
  AccountingIncome,
  AccountingTaxMovement,
} from "@/types";

/** "ALL" = consolidado, "general" = sin proyecto, o el id del proyecto. */
export type AccountingScope = "ALL" | typeof ACCOUNTING_GENERAL_SCOPE | string;

interface AccountingState {
  scope: AccountingScope;
  accounts: AccountingAccount[];
  incomes: AccountingIncome[];
  expenses: AccountingExpense[];
  taxMovements: AccountingTaxMovement[];
  goals: AccountingGoal[];
  loaded: boolean;
  loading: boolean;
  error: string | null;

  setScope: (scope: AccountingScope) => Promise<void>;
  load: () => Promise<void>;

  addAccount: (data: Partial<AccountingAccount>) => Promise<boolean>;
  updateAccount: (id: string, data: Partial<AccountingAccount>) => Promise<boolean>;
  deleteAccount: (id: string) => Promise<boolean>;

  addIncome: (data: Partial<AccountingIncome>) => Promise<boolean>;
  updateIncome: (id: string, data: Partial<AccountingIncome>) => Promise<boolean>;
  deleteIncome: (id: string) => Promise<boolean>;

  addExpense: (data: Partial<AccountingExpense>) => Promise<boolean>;
  updateExpense: (id: string, data: Partial<AccountingExpense>) => Promise<boolean>;
  deleteExpense: (id: string) => Promise<boolean>;

  addTaxMovement: (data: Partial<AccountingTaxMovement>) => Promise<boolean>;
  updateTaxMovement: (
    id: string,
    data: Partial<AccountingTaxMovement>,
  ) => Promise<boolean>;
  deleteTaxMovement: (id: string) => Promise<boolean>;

  saveGoal: (data: Partial<AccountingGoal>) => Promise<boolean>;
  clearError: () => void;
}

const BASE = "/api/accounting";

function scopeQuery(scope: AccountingScope): string {
  return scope === "ALL" ? "" : `?projectId=${encodeURIComponent(scope)}`;
}

export const useAccountingStore = create<AccountingState>()((set, get) => {
  /** Ejecuta una mutación, refresca y traduce el error a estado. */
  async function mutate(fn: () => Promise<unknown>): Promise<boolean> {
    set({ error: null });
    try {
      await fn();
      await get().load();
      return true;
    } catch (e) {
      const message = (e as Error)?.message ?? "Error";
      console.error("[accounting mutate]", message);
      set({ error: message });
      return false;
    }
  }

  return {
    scope: "ALL",
    accounts: [],
    incomes: [],
    expenses: [],
    taxMovements: [],
    goals: [],
    loaded: false,
    loading: false,
    error: null,

    setScope: async (scope) => {
      set({ scope });
      await get().load();
    },

    load: async () => {
      set({ loading: true, error: null });
      const q = scopeQuery(get().scope);
      try {
        const [accounts, incomes, expenses, taxMovements, goals] = await Promise.all([
          api.get<AccountingAccount[]>(`${BASE}/accounts`),
          api.get<AccountingIncome[]>(`${BASE}/incomes${q}`),
          api.get<AccountingExpense[]>(`${BASE}/expenses${q}`),
          api.get<AccountingTaxMovement[]>(`${BASE}/tax-movements${q}`),
          api.get<AccountingGoal[]>(`${BASE}/goals`),
        ]);
        set({
          accounts,
          incomes,
          expenses,
          taxMovements,
          goals,
          loaded: true,
          loading: false,
        });
      } catch (e) {
        const message = (e as Error)?.message ?? "Error al cargar";
        console.error("[accounting load]", message);
        set({ error: message, loading: false });
      }
    },

    addAccount: (data) => mutate(() => api.post(`${BASE}/accounts`, data)),
    updateAccount: (id, data) => mutate(() => api.put(`${BASE}/accounts`, { id, ...data })),
    deleteAccount: (id) =>
      mutate(() => api.del(`${BASE}/accounts?id=${encodeURIComponent(id)}`)),

    addIncome: (data) => mutate(() => api.post(`${BASE}/incomes`, data)),
    updateIncome: (id, data) => mutate(() => api.put(`${BASE}/incomes`, { id, ...data })),
    deleteIncome: (id) =>
      mutate(() => api.del(`${BASE}/incomes?id=${encodeURIComponent(id)}`)),

    addExpense: (data) => mutate(() => api.post(`${BASE}/expenses`, data)),
    updateExpense: (id, data) => mutate(() => api.put(`${BASE}/expenses`, { id, ...data })),
    deleteExpense: (id) =>
      mutate(() => api.del(`${BASE}/expenses?id=${encodeURIComponent(id)}`)),

    addTaxMovement: (data) => mutate(() => api.post(`${BASE}/tax-movements`, data)),
    updateTaxMovement: (id, data) =>
      mutate(() => api.put(`${BASE}/tax-movements`, { id, ...data })),
    deleteTaxMovement: (id) =>
      mutate(() => api.del(`${BASE}/tax-movements?id=${encodeURIComponent(id)}`)),

    saveGoal: (data) => mutate(() => api.put(`${BASE}/goals`, data)),

    clearError: () => set({ error: null }),
  };
});

/** Meta correspondiente al alcance activo (null si el alcance es consolidado). */
export function goalForScope(
  goals: AccountingGoal[],
  scope: AccountingScope,
): AccountingGoal | null {
  if (scope === "ALL") return null;
  if (scope === ACCOUNTING_GENERAL_SCOPE) {
    return goals.find((g) => !g.projectId) ?? null;
  }
  return goals.find((g) => g.projectId === scope) ?? null;
}
