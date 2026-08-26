/**
 * lib/data-store.ts
 *
 * Store Zustand unificado para TODOS los módulos.
 * Reemplaza los 18 stores individuales para reducir superficie y conectar a BD.
 *
 * Estructura:
 *   useDataStore((s) => s.projects.load())
 *   useDataStore((s) => s.projects.items)
 *
 * Cada colección expone:
 *   items: T[]        — datos cacheados
 *   loaded: boolean   — true tras primer fetch exitoso
 *   loading: boolean  — true durante fetch
 *   error: string|null
 *   load(): Promise<void>
 *   add(payload): Promise<T>
 *   update(id, payload): Promise<void>
 *   remove(id): Promise<void>
 *
 * El componente sigue usando los nombres antiguos (addProject, updateCut, etc.)
 * gracias a alias definidos más abajo.
 */

import { create } from "zustand";
import { api } from "./api";
import type {
  Project, WorkCut, PaymentRequest, Contract, Provider, Client,
  Quotation, WorkLog, Employee, User, TaxConfig, AiuConfig, Invitation,
  Expense, Budget,
} from "@/types";

interface Collection<T> {
  items: T[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

interface DataState {
  projects: Collection<Project> & {
    load: () => Promise<void>;
    add: (p: Partial<Project> & { code?: string }) => Promise<Project | null>;
    update: (id: string, p: Partial<Project>) => Promise<void>;
    remove: (id: string) => Promise<void>;
  };
  providers: Collection<Provider> & {
    load: () => Promise<void>;
    add: (p: Partial<Provider>) => Promise<Provider | null>;
    update: (id: string, p: Partial<Provider>) => Promise<void>;
    remove: (id: string) => Promise<void>;
  };
  contracts: Collection<Contract> & {
    load: () => Promise<void>;
    add: (c: Partial<Contract>) => Promise<Contract | null>;
    update: (id: string, c: Partial<Contract>) => Promise<void>;
    remove: (id: string) => Promise<void>;
  };
  cuts: Collection<WorkCut> & {
    load: () => Promise<void>;
    add: (c: Partial<WorkCut>) => Promise<WorkCut | null>;
    update: (id: string, c: Partial<WorkCut>) => Promise<void>;
    remove: (id: string) => Promise<void>;
    performAction: (id: string, action: string, user: any, opts?: any) => Promise<{ ok: boolean; error?: string }>;
  };
  payments: Collection<PaymentRequest> & {
    load: () => Promise<void>;
    add: (p: Partial<PaymentRequest>) => Promise<PaymentRequest | null>;
    update: (id: string, p: Partial<PaymentRequest>) => Promise<void>;
    remove: (id: string) => Promise<void>;
    performAction: (id: string, action: string, user: any, opts?: any) => Promise<{ ok: boolean; error?: string }>;
  };
  clients: Collection<Client> & {
    load: () => Promise<void>;
    add: (c: Partial<Client>) => Promise<Client | null>;
    update: (id: string, c: Partial<Client>) => Promise<void>;
    remove: (id: string) => Promise<void>;
  };
  quotations: Collection<Quotation> & {
    load: () => Promise<void>;
    add: (q: Partial<Quotation>) => Promise<Quotation | null>;
    update: (id: string, q: Partial<Quotation>) => Promise<void>;
    remove: (id: string) => Promise<void>;
  };
  workLogs: Collection<WorkLog> & {
    load: () => Promise<void>;
    add: (l: Partial<WorkLog>) => Promise<WorkLog | null>;
    update: (id: string, l: Partial<WorkLog>) => Promise<void>;
    remove: (id: string) => Promise<void>;
  };
  employees: Collection<Employee> & {
    load: () => Promise<void>;
    add: (e: Partial<Employee>) => Promise<Employee | null>;
    update: (id: string, e: Partial<Employee>) => Promise<void>;
    remove: (id: string) => Promise<void>;
  };
  users: Collection<User> & {
    load: () => Promise<void>;
    add: (u: Partial<User>) => Promise<User | null>;
    update: (id: string, u: Partial<User>) => Promise<void>;
  };
  invitations: Collection<Invitation> & {
    load: () => Promise<void>;
    add: (i: Partial<Invitation>) => Promise<Invitation | null>;
    update: (id: string, i: Partial<Invitation>) => Promise<void>;
    remove: (id: string) => Promise<void>;
  };
  taxes: Collection<TaxConfig> & {
    load: () => Promise<void>;
    add: (t: Partial<TaxConfig>) => Promise<TaxConfig | null>;
    update: (id: string, t: Partial<TaxConfig>) => Promise<void>;
    remove: (id: string) => Promise<void>;
  };
  aius: Collection<AiuConfig> & {
    load: () => Promise<void>;
    add: (a: Partial<AiuConfig>) => Promise<AiuConfig | null>;
    update: (id: string, a: Partial<AiuConfig>) => Promise<void>;
  };
  budgets: Collection<Budget> & {
    load: () => Promise<void>;
    add: (b: Partial<Budget>) => Promise<Budget | null>;
    update: (id: string, b: Partial<Budget>) => Promise<void>;
  };
  pscs: Collection<any> & {
    load: () => Promise<void>;
    add: (p: Partial<any>) => Promise<any | null>;
    update: (id: string, p: Partial<any>) => Promise<void>;
    remove: (id: string) => Promise<void>;
  };
  expenses: Collection<Expense> & {
    load: () => Promise<void>;
    add: (e: Partial<Expense>) => Promise<Expense | null>;
    update: (id: string, e: Partial<Expense>) => Promise<void>;
    remove: (id: string) => Promise<void>;
  };
}

function makeCollection<T extends { id: string }>(endpoint: string) {
  return {
    items: [] as T[],
    loaded: false,
    loading: false,
    error: null as string | null,

    load: async function () {
      set2((s: any) => ({}));
      // implementation below
    } as any,
    add: async function (data: Partial<T>) {
      try {
        const result = await api.post<T>(endpoint, data);
        const items = await api.get<T[]>(endpoint);
        set2((s: any) => ({ [endpointToKey(endpoint)]: { ...s[endpointToKey(endpoint)], items, loaded: true } }));
        return result;
      } catch (e: any) {
        console.error(`[${endpoint} add]`, e?.message);
        return null;
      }
    },
    update: async function (id: string, data: Partial<T>) {
      try {
        await api.put(endpoint, { id, ...data });
        const items = await api.get<T[]>(endpoint);
        set2((s: any) => ({ [endpointToKey(endpoint)]: { ...s[endpointToKey(endpoint)], items } }));
      } catch (e: any) {
        console.error(`[${endpoint} update]`, e?.message);
      }
    },
    remove: async function (id: string) {
      try {
        await api.del(`${endpoint}?id=${encodeURIComponent(id)}`);
        set2((s: any) => {
          const col = s[endpointToKey(endpoint)];
          return {
            [endpointToKey(endpoint)]: { ...col, items: col.items.filter((i: T) => i.id !== id) },
          };
        });
      } catch (e: any) {
        console.error(`[${endpoint} remove]`, e?.message);
      }
    },
  };
}

function endpointToKey(endpoint: string): string {
  return endpoint.replace(/^\/api\//, "");
}

let set2: any = () => {};
let get2: any = () => ({});

export const useDataStore = create<DataState>()((set, get) => {
  set2 = set; get2 = get;

  // Helper para construir una colección estándar
  function col<T extends { id: string }>(endpoint: string) {
    const key = endpointToKey(endpoint);
    const obj: any = {
      items: [] as T[],
      loaded: false,
      loading: false,
      error: null as string | null,
      async load() {
        const self = (get() as any)[key];
        if (self?.loading) return;
        set((s: any) => ({ [key]: { ...s[key], loading: true, error: null } }));
        try {
          const items = await api.get<T[]>(endpoint);
          set((s: any) => ({ [key]: { ...s[key], items, loaded: true, loading: false } }));
        } catch (e: any) {
          console.error(`[${endpoint} load]`, e?.message);
          set((s: any) => ({ [key]: { ...s[key], error: e?.message ?? "Error", loading: false } }));
        }
      },
      async add(data: Partial<T>) {
        try {
          await api.post(endpoint, data);
          const items = await api.get<T[]>(endpoint);
          set((s: any) => ({ [key]: { ...s[key], items, loaded: true } }));
          return { id: "", ...data } as T;
        } catch (e: any) {
          console.error(`[${endpoint} add]`, e?.message);
          return null;
        }
      },
      async update(id: string, data: Partial<T>) {
        try {
          await api.put(endpoint, { id, ...data });
          const items = await api.get<T[]>(endpoint);
          set((s: any) => ({ [key]: { ...s[key], items } }));
        } catch (e: any) {
          console.error(`[${endpoint} update]`, e?.message);
        }
      },
      async remove(id: string) {
        try {
          await api.del(`${endpoint}?id=${encodeURIComponent(id)}`);
          set((s: any) => {
            const c = (get() as any)[key];
            return { [key]: { ...c, items: c.items.filter((i: T) => i.id !== id) } };
          });
        } catch (e: any) {
          console.error(`[${endpoint} remove]`, e?.message);
        }
      },
    };
    return obj;
  }

  return {
    projects: {
      ...col<Project>("/api/projects"),
    },
    providers: {
      ...col<Provider>("/api/providers"),
    },
    contracts: {
      ...col<Contract>("/api/contracts"),
    },
    cuts: {
      ...col<WorkCut>("/api/cuts"),
      async performAction(id: string, action: string, user: any, opts: any = {}) {
        try {
          await api.patch("/api/cuts", { id, action, user, ...opts });
          const items = await api.get<WorkCut[]>("/api/cuts");
          set((s: any) => ({ cuts: { ...(s as any).cuts, items } }));
          return { ok: true };
        } catch (e: any) {
          console.error("[cuts action]", e?.message);
          return { ok: false, error: e?.message ?? "Error" };
        }
      },
    },
    payments: {
      ...col<PaymentRequest>("/api/payments"),
      async performAction(id: string, action: string, user: any, opts: any = {}) {
        try {
          await api.patch("/api/payments", { id, action, user, ...opts });
          const items = await api.get<PaymentRequest[]>("/api/payments");
          set((s: any) => ({ payments: { ...(s as any).payments, items } }));
          return { ok: true };
        } catch (e: any) {
          console.error("[payments action]", e?.message);
          return { ok: false, error: e?.message ?? "Error" };
        }
      },
    },
    clients: {
      ...col<Client>("/api/clients"),
    },
    quotations: {
      ...col<Quotation>("/api/quotations"),
    },
    workLogs: {
      ...col<WorkLog>("/api/work-logs"),
    },
    employees: {
      ...col<Employee>("/api/employees"),
    },
    users: {
      ...col<User>("/api/users"),
    },
    invitations: {
      ...col<Invitation>("/api/invitations"),
    },
    taxes: {
      ...col<TaxConfig>("/api/taxes"),
    },
    aius: {
      ...col<AiuConfig>("/api/aiu-configs"),
    },
    budgets: {
      ...col<Budget>("/api/budgets"),
    },
    pscs: {
      ...col<any>("/api/pscs"),
    },
    expenses: {
      ...col<Expense>("/api/expenses"),
    },
  } as any;
});

// ---------- ALIAS DE COMPATIBILIDAD (mantienen nombres antiguos) ----------

export const useProjectsStore = () => {
  const s = useDataStore((x) => x.projects);
  const projectsAll = useDataStore((x) => x.projects.items) as Project[];
  return {
    projects: projectsAll,
    loaded: s.loaded, loading: s.loading,
    addProject: async (data: any) => s.add(data),
    updateProject: async (id: string, p: any) => s.update(id, p),
    deleteProject: async (id: string) => s.remove(id),
    getProject: (id: string) => projectsAll.find((p) => p.id === id),
load: s.load,
  };
};

export const useProvidersStore = () => {
  const s = useDataStore((x) => x.providers);
  const items = useDataStore((x) => x.providers.items) as Provider[];
  return {
    providers: items,
    addProvider: (data: any) => s.add(data),
    updateProvider: (id: string, p: any) => s.update(id, p),
    deleteProvider: (id: string) => s.remove(id),
    getProvider: (id: string) => items.find((p) => p.id === id),
    toggleActive: (id: string, active?: boolean) => s.update(id, { isActive: active } as any),
    setStatus: (id: string, status: any) => s.update(id, { status } as any),
    load: s.load,
  } as any;
};

export const useContractsStore = () => {
  const s = useDataStore((x) => x.contracts);
  const items = useDataStore((x) => x.contracts.items) as Contract[];
  return {
    contracts: items,
    addContract: (data: any) => s.add(data),
    updateContract: (id: string, c: any) => s.update(id, c),
    deleteContract: (id: string) => s.remove(id),
    getContract: (id: string) => items.find((c) => c.id === id),
    setStatus: (id: string, status: any) => s.update(id, { status } as any),
    addDocument: async (contractId: string, _doc: any) => {
      console.warn("addDocument: pendiente de implementar tabla contract_documents");
    },
    removeDocument: async (contractId: string, _docId: string) => {
      console.warn("removeDocument: pendiente");
    },
    performAction: (...args: any[]) => { console.warn("performAction pending"); return Promise.resolve({ ok: false }); },
    toggleActive: (id: string, active?: boolean) => s.update(id, { isActive: active } as any),
    load: s.load,
  } as any;
};

export const useCutsStore = () => {
  const s = useDataStore((x) => x.cuts);
  const items = useDataStore((x) => x.cuts.items) as WorkCut[];
  return {
    cuts: items,
    addCut: (data: any, _projectCode: string) => s.add(data),
    updateCut: (id: string, c: any) => s.update(id, c),
    deleteCut: (id: string) => s.remove(id),
    getCut: (id: string) => items.find((c) => c.id === id),
    addItem: async (cutId: string, _item: any) => console.warn("addItem pendiente"),
    updateItem: async (cutId: string, _itemId: string, _u: any) => console.warn("updateItem pendiente"),
    removeItem: async (cutId: string, _itemId: string) => console.warn("removeItem pendiente"),
    addDocument: async (cutId: string, _doc: any) => console.warn("addDocument pendiente"),
    removeDocument: async (cutId: string, _docId: string) => console.warn("removeDocument pendiente"),
    performAction: (id: string, action: string, user: any, comments?: string, rejectionReason?: string) =>
      s.performAction(id, action, user, { comments, rejectionReason }),
    toggleActive: (id: string, active?: boolean) => s.update(id, { isActive: active } as any),
    setStatus: (id: string, status: any) => s.update(id, { status } as any),
    load: s.load,
  } as any;
};

export const usePaymentsStore = () => {
  const s = useDataStore((x) => x.payments);
  const items = useDataStore((x) => x.payments.items) as PaymentRequest[];
  return {
    payments: items,
    addPayment: (data: any) => s.add(data),
    updatePayment: (id: string, p: any) => s.update(id, p),
    deletePayment: (id: string) => s.remove(id),
    getPayment: (id: string) => items.find((p) => p.id === id),
    performAction: (id: string, action: string, user: any, payload: any = {}) =>
      s.performAction(id, action, user, payload),
    toggleActive: (id: string, active?: boolean) => s.update(id, { isActive: active } as any),
    setStatus: (id: string, status: any) => s.update(id, { status } as any),
    load: s.load,
  } as any;
};

export const useClientsStore = () => {
  const s = useDataStore((x) => x.clients);
  const items = useDataStore((x) => x.clients.items) as Client[];
  return {
    clients: items,
    addClient: (data: any) => s.add(data),
    updateClient: (id: string, c: any) => s.update(id, c),
    deleteClient: (id: string) => s.remove(id),
    getClient: (id: string) => items.find((c) => c.id === id),
    toggleActive: (id: string, active?: boolean) => s.update(id, { isActive: active } as any),
    setStatus: (id: string, status: any) => s.update(id, { status } as any),
    load: s.load,
  } as any;
};

export const useQuotationsStore = () => {
  const s = useDataStore((x) => x.quotations);
  const items = useDataStore((x) => x.quotations.items) as Quotation[];
  return {
    quotations: items,
    addQuotation: (data: any) => s.add(data),
    updateQuotation: (id: string, q: any) => s.update(id, q),
    deleteQuotation: (id: string) => s.remove(id),
    getQuotation: (id: string) => items.find((q) => q.id === id),
    toggleActive: (id: string, active?: boolean) => s.update(id, { isActive: active } as any),
    setStatus: (id: string, status: any) => s.update(id, { status } as any),
    load: s.load,
  } as any;
};

export const useLogsStore = () => {
  const s = useDataStore((x) => x.workLogs);
  const items = useDataStore((x) => x.workLogs.items) as WorkLog[];
  return {
    logs: items,
    addLog: (data: any) => s.add(data),
    updateLog: (id: string, l: any) => s.update(id, l),
    deleteLog: (id: string) => s.remove(id),
    getLog: (id: string) => items.find((l) => l.id === id),
    toggleActive: (id: string, active?: boolean) => s.update(id, { isActive: active } as any),
    setStatus: (id: string, status: any) => s.update(id, { status } as any),
    load: s.load,
  } as any;
};

export const useEmployeesStore = () => {
  const s = useDataStore((x) => x.employees);
  const items = useDataStore((x) => x.employees.items) as Employee[];
  return {
    employees: items,
    addEmployee: (data: any) => s.add(data),
    updateEmployee: (id: string, e: any) => s.update(id, e),
    deleteEmployee: (id: string) => s.remove(id),
    getEmployee: (id: string) => items.find((e) => e.id === id),
    addDocument: async (_id: string, _doc: any) => { console.warn("employee_documents pendiente"); },
    removeDocument: async (_id: string, _docId: string) => { console.warn("employee_documents pendiente"); },
    toggleActive: (id: string, active?: boolean) => s.update(id, { isActive: active } as any),
    setStatus: (id: string, status: any) => s.update(id, { status } as any),
    load: s.load,
  } as any;
};

export const useInvitationsStore = () => {
  const s = useDataStore((x) => x.invitations);
  const items = useDataStore((x) => x.invitations.items) as Invitation[];
  return {
    invitations: items,
    addInvitation: (data: any) => s.add(data),
    updateInvitation: (id: string, i: any) => s.update(id, i),
    deleteInvitation: (id: string) => s.remove(id),
    toggleActive: (id: string, active?: boolean) => s.update(id, { isActive: active } as any),
    setStatus: (id: string, status: any) => s.update(id, { status } as any),
    load: s.load,
  } as any;
};

export const useTaxesStore = () => {
  const s = useDataStore((x) => x.taxes);
  const items = useDataStore((x) => x.taxes.items) as TaxConfig[];
  return {
    taxes: items,
    addTax: (data: any) => s.add(data),
    updateTax: (id: string, t: any) => s.update(id, t),
    deleteTax: (id: string) => s.remove(id),
    toggleActive: (id: string, active?: boolean) => s.update(id, { isActive: active } as any),
    setStatus: (id: string, status: any) => s.update(id, { status } as any),
    load: s.load,
  } as any;
};

export const useAiuStore = () => {
  const s = useDataStore((x) => x.aius);
  const items = useDataStore((x) => x.aius.items) as AiuConfig[];
  return {
    aius: items,
    getAiuByProject: (projectId: string) => items.find((a) => a.projectId === projectId),
    addAiu: (data: any) => s.add(data),
    updateAiu: (id: string, a: any) => s.update(id, a),
    toggleActive: (id: string, active?: boolean) => s.update(id, { isActive: active } as any),
    setStatus: (id: string, status: any) => s.update(id, { status } as any),
    load: s.load,
  } as any;
};

export const useBudgetsStore = () => {
  const s = useDataStore((x) => x.budgets);
  const items = useDataStore((x) => x.budgets.items) as Budget[];
  return {
    budgets: items,
    getBudgetByProject: (projectId: string) => items.find((b) => b.projectId === projectId),
    addBudget: (data: any) => s.add(data),
    updateBudget: (id: string, b: any) => s.update(id, b),
    toggleActive: (id: string, active?: boolean) => s.update(id, { isActive: active } as any),
    setStatus: (id: string, status: any) => s.update(id, { status } as any),
    load: s.load,
  } as any;
};

export const usePscsStore = () => {
  const s = useDataStore((x) => x.pscs);
  const items = useDataStore((x) => x.pscs.items) as any[];
  return {
    pscs: items,
    addany: (data: any) => s.add(data),
    updateany: (id: string, p: any) => s.update(id, p),
    deleteany: (id: string) => s.remove(id),
    toggleActive: (id: string, active?: boolean) => s.update(id, { isActive: active } as any),
    setStatus: (id: string, status: any) => s.update(id, { status } as any),
    load: s.load,
  } as any;
};

export const useExpensesStore = () => {
  const s = useDataStore((x) => x.expenses);
  const items = useDataStore((x) => x.expenses.items) as Expense[];
  return {
    expenses: items,
    addExpense: (data: any) => s.add(data),
    updateExpense: (id: string, e: any) => s.update(id, e),
    deleteExpense: (id: string) => s.remove(id),
    toggleActive: (id: string, active?: boolean) => s.update(id, { isActive: active } as any),
    setStatus: (id: string, status: any) => s.update(id, { status } as any),
    load: s.load,
  } as any;
};

// Re-export de tipos para que componentes que importan desde stores sigan funcionando
export const PROJECT_STATUS_LABELS = {
  IN_PLANNING: "Planificación",
  IN_EXECUTION: "En ejecución",
  PAUSED: "Pausado",
  COMPLETED: "Completado",
} as const;
export const PROJECT_STATUS_VARIANTS = {
  IN_PLANNING: "info",
  IN_EXECUTION: "success",
  PAUSED: "warning",
  COMPLETED: "default",
} as const;
export const CUT_STATUS_LABELS = {
  DRAFT: "Borrador",
  SUBMITTED: "Enviado",
  VALIDATED: "Validado",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  PAID: "Pagado",
} as const;
export const CUT_STATUS_VARIANTS = {
  DRAFT: "default",
  SUBMITTED: "warning",
  VALIDATED: "info",
  APPROVED: "success",
  REJECTED: "destructive",
  PAID: "success",
} as const;
export const CUT_DOCUMENT_TYPE_LABELS = {
  ACTA: "Acta",
  FACTURA: "Factura",
  SOPORTE: "Soporte",
  OTROS: "Otros",
} as const;

// =====================================================================
// Re-exports de constantes de stores legacy (compatibilidad)
// =====================================================================
export { CLIENT_STATUS_LABELS, CLIENT_STATUS_VARIANTS, CLIENT_SOURCE_LABELS } from "./clients-constants";
export { EMPLOYEE_STATUS_LABELS, EMPLOYEE_STATUS_VARIANTS, EMPLOYEE_DEPARTMENT_LABELS, EMPLOYEE_CONTRACT_LABELS, EMPLOYEE_DOC_TYPE_LABELS } from "./employees-constants";
export { PROVIDER_STATUS_LABELS, PROVIDER_STATUS_VARIANTS, DOCUMENT_TYPE_LABELS, PERSON_TYPE_LABELS, CATEGORY_LABELS, requiredDocsFor } from "./providers-constants";
export { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_VARIANTS } from "./quotations-constants";
export { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_VARIANTS, PAYMENT_TYPE_LABELS, PAYMENT_PRIORITY_LABELS, PAYMENT_PRIORITY_VARIANTS, PAYMENT_ACTION_LABELS, getAvailablePaymentActions } from "./payments-constants";
export { CONTRACT_TYPE_LABELS, CONTRACT_STATUS_LABELS, CONTRACT_STATUS_VARIANTS, CONTRACT_DOCUMENT_TYPE_LABELS, REQUIRED_CONTRACT_DOCS } from "./contracts-constants";


// Additional re-exports found as needed by paginas
export { TAX_TYPE_LABELS, TAX_APPLIES_LABELS } from "./taxes-constants";
export { EXPENSE_TYPE_LABELS, EXPENSE_STATUS_LABELS, EXPENSE_STATUS_VARIANTS, categoryFor } from "./expenses-constants";
export { PSC_STATUS_LABELS, PSC_STATUS_VARIANTS } from "./pscs-constants";


// Catch-all: re-export todo lo que las paginas importaban de los legacy
export { WEATHER_LABELS, WEATHER_ICONS } from "./logs-constants";
export { validateAiu } from "./aiu-constants";


// Re-exports adicionales ACTION_LABELS / ACTION_BUTTONS para cortes/[id]
export { ACTION_LABELS, ACTION_BUTTONS } from "./cuts-constants";
