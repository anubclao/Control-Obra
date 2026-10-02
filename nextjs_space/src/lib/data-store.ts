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
import { toastError, toastSuccess } from "@/components/ui/toast-bus";

/**
 * P2 (seccion 4.2): mensajes user-friendly para los toasts del data-store.
 *   Si la API falla con ApiError, mostramos su `message`. Si falla
 *   por red, mostramos "sin conexion" o el mensaje del navegador.
 */
function describeError(e: any): string {
  if (e?.message) return e.message;
  return "Error desconocido";
}

/** Convierte /projects a "Proyecto" para los toasts. */
function humanEndpoint(endpoint: string): string {
  const map: Record<string, string> = {
    "/api/projects": "Proyecto",
    "/api/cuts": "Corte",
    "/api/payments": "Pago",
    "/api/clients": "Cliente",
    "/api/quotations": "Cotización",
    "/api/contracts": "Contrato",
    "/api/providers": "Proveedor",
    "/api/employees": "Empleado",
    "/api/work-logs": "Bitácora",
    "/api/budgets": "Presupuesto",
    "/api/expenses": "Gasto",
    "/api/pscs": "PSC",
    "/api/users": "Usuario",
    "/api/invitations": "Invitación",
    "/api/taxes": "Impuesto",
    "/api/aiu-configs": "AIU",
  };
  return map[endpoint] ?? "Registro";
}
import type {
  Project,
  WorkCut,
  PaymentRequest,
  Contract,
  Provider,
  Client,
  Quotation,
  WorkLog,
  Employee,
  User,
  TaxConfig,
  AiuConfig,
  Invitation,
  Expense,
  Budget,
  BudgetLayer,
  BudgetItem,
} from "@/types";

export type BudgetActionResult = { ok: boolean; error?: string };
export type UnforeseenItemInput = Pick<
  BudgetItem,
  "description" | "unit" | "quantity" | "unitPrice"
>;

interface Collection<T> {
  items: T[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
  /**
   * Metadata de paginacion cuando el endpoint devuelve `{data, pagination}`.
   * Sera `null` para endpoints no paginados (array directo) y para
   * estados previos al primer load.
   * SPEC: docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md seccion 4.2.
   */
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  } | null;
}

interface DataState {
  projects: Collection<Project> & {
    load: () => Promise<void>;
    add: (p: Partial<Project> & { code?: string }) => Promise<Project | null>;
    update: (id: string, p: Partial<Project>) => Promise<boolean>;
    remove: (id: string) => Promise<void>;
  };
  providers: Collection<Provider> & {
    load: () => Promise<void>;
    add: (p: Partial<Provider>) => Promise<Provider | null>;
    update: (id: string, p: Partial<Provider>) => Promise<boolean>;
    remove: (id: string) => Promise<void>;
  };
  contracts: Collection<Contract> & {
    load: () => Promise<void>;
    add: (c: Partial<Contract>) => Promise<Contract | null>;
    update: (id: string, c: Partial<Contract>) => Promise<boolean>;
    remove: (id: string) => Promise<void>;
  };
  cuts: Collection<WorkCut> & {
    load: () => Promise<void>;
    add: (c: Partial<WorkCut>) => Promise<WorkCut | null>;
    update: (id: string, c: Partial<WorkCut>) => Promise<boolean>;
    remove: (id: string) => Promise<void>;
    performAction: (
      id: string,
      action: string,
      user: any,
      opts?: any,
    ) => Promise<{ ok: boolean; error?: string }>;
    /**
     * P1 (seccion 4.3): carga una pagina concreta del listado paginado
     * (`/api/cuts?page=N&limit=M`). Devuelve `ok: false` con `error`
     * si la API falla; nunca lanza.
     */
    loadPage: (
      page: number,
      limit: number,
    ) => Promise<{ ok: boolean; error?: string }>;
  };
  payments: Collection<PaymentRequest> & {
    load: () => Promise<void>;
    add: (p: Partial<PaymentRequest>) => Promise<PaymentRequest | null>;
    update: (id: string, p: Partial<PaymentRequest>) => Promise<boolean>;
    remove: (id: string) => Promise<void>;
    performAction: (
      id: string,
      action: string,
      user: any,
      opts?: any,
    ) => Promise<{ ok: boolean; error?: string }>;
    loadPage: (
      page: number,
      limit: number,
    ) => Promise<{ ok: boolean; error?: string }>;
  };
  clients: Collection<Client> & {
    load: () => Promise<void>;
    add: (c: Partial<Client>) => Promise<Client | null>;
    update: (id: string, c: Partial<Client>) => Promise<boolean>;
    remove: (id: string) => Promise<void>;
  };
  quotations: Collection<Quotation> & {
    load: () => Promise<void>;
    add: (q: Partial<Quotation>) => Promise<Quotation | null>;
    update: (id: string, q: Partial<Quotation>) => Promise<boolean>;
    remove: (id: string) => Promise<void>;
    loadPage: (
      page: number,
      limit: number,
    ) => Promise<{ ok: boolean; error?: string }>;
  };
  workLogs: Collection<WorkLog> & {
    load: () => Promise<void>;
    add: (l: Partial<WorkLog>) => Promise<WorkLog | null>;
    update: (id: string, l: Partial<WorkLog>) => Promise<boolean>;
    remove: (id: string) => Promise<void>;
  };
  employees: Collection<Employee> & {
    load: () => Promise<void>;
    add: (e: Partial<Employee>) => Promise<Employee | null>;
    update: (id: string, e: Partial<Employee>) => Promise<boolean>;
    remove: (id: string) => Promise<void>;
  };
  users: Collection<User> & {
    load: () => Promise<void>;
    add: (u: Partial<User>) => Promise<User | null>;
    update: (id: string, u: Partial<User>) => Promise<boolean>;
  };
  invitations: Collection<Invitation> & {
    load: () => Promise<void>;
    add: (i: Partial<Invitation>) => Promise<Invitation | null>;
    update: (id: string, i: Partial<Invitation>) => Promise<boolean>;
    remove: (id: string) => Promise<void>;
  };
  taxes: Collection<TaxConfig> & {
    load: () => Promise<void>;
    add: (t: Partial<TaxConfig>) => Promise<TaxConfig | null>;
    update: (id: string, t: Partial<TaxConfig>) => Promise<boolean>;
    remove: (id: string) => Promise<void>;
  };
  aius: Collection<AiuConfig> & {
    load: () => Promise<void>;
    add: (a: Partial<AiuConfig>) => Promise<AiuConfig | null>;
    update: (id: string, a: Partial<AiuConfig>) => Promise<boolean>;
  };
  budgets: Collection<Budget> & {
    load: () => Promise<void>;
    add: (b: Partial<Budget>) => Promise<Budget | null>;
    update: (id: string, b: Partial<Budget>) => Promise<boolean>;
    // SPEC: docs/specs/bug-presupuestos-persistencia.md
    createPT: (
      projectId: string,
      layers: BudgetLayer[],
      notes?: string,
    ) => Promise<BudgetActionResult>;
    createNewVersion: (
      projectId: string,
      layers: BudgetLayer[],
      notes?: string,
    ) => Promise<BudgetActionResult>;
    addUnforeseenItem: (
      budgetId: string,
      item: UnforeseenItemInput,
    ) => Promise<BudgetActionResult>;
    removeUnforeseenItem: (
      budgetId: string,
      itemId: string,
    ) => Promise<BudgetActionResult>;
  };
  pscs: Collection<any> & {
    load: () => Promise<void>;
    add: (p: Partial<any>) => Promise<any | null>;
    update: (id: string, p: Partial<any>) => Promise<boolean>;
    remove: (id: string) => Promise<void>;
  };
  expenses: Collection<Expense> & {
    load: () => Promise<void>;
    add: (e: Partial<Expense>) => Promise<Expense | null>;
    update: (id: string, e: Partial<Expense>) => Promise<boolean>;
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
        set2((s: any) => ({
          [endpointToKey(endpoint)]: {
            ...s[endpointToKey(endpoint)],
            items,
            loaded: true,
          },
        }));
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
        set2((s: any) => ({
          [endpointToKey(endpoint)]: { ...s[endpointToKey(endpoint)], items },
        }));
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
            [endpointToKey(endpoint)]: {
              ...col,
              items: col.items.filter((i: T) => i.id !== id),
            },
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
  set2 = set;
  get2 = get;

  // Helper para construir una colección estándar
  // `stateKey` = propiedad del store donde vive la colección. Por defecto se
  // deriva del endpoint, pero debe pasarse cuando no coinciden
  // ("/api/aiu-configs" → aius): si no, load() escribe en una clave huérfana.
  function col<T extends { id: string }>(
    endpoint: string,
    stateKey: string = endpointToKey(endpoint),
  ) {
    const key = stateKey;
    const obj: any = {
      items: [] as T[],
      loaded: false,
      loading: false,
      error: null as string | null,
      pagination: null,
      // P1 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.3):
      //   Algunos listados (cuts, quotations) devuelven {data, pagination}
      //   en vez de un array. Esta funcion normaliza la respuesta:
      //   - si es array, lo guarda como items
      //   - si es {data, pagination}, guarda items + pagination
      //   Asi el resto del store (y los consumidores) solo ven items.
      //   Ademas expone `refresh` para reusar la normalizacion desde
      //   performAction() tras un PATCH (donde la API tambien devuelve
      //   la lista paginada, no la entidad).
      refresh: async () => {
        const response = await api.get<any>(endpoint);
        if (response && Array.isArray(response.data)) {
          set((s: any) => ({
            [key]: {
              ...s[key],
              items: response.data as T[],
              pagination: response.pagination ?? null,
              loaded: true,
              loading: false,
              error: null,
            },
          }));
        } else {
          set((s: any) => ({
            [key]: {
              ...s[key],
              items: (response ?? []) as T[],
              pagination: null,
              loaded: true,
              loading: false,
              error: null,
            },
          }));
        }
      },
      async load() {
        const self = (get() as any)[key];
        if (self?.loading) return;
        set((s: any) => ({ [key]: { ...s[key], loading: true, error: null } }));
        try {
          await obj.refresh();
        } catch (e: any) {
          console.error(`[${endpoint} load]`, e?.message);
          set((s: any) => ({
            [key]: { ...s[key], error: e?.message ?? "Error", loading: false },
          }));
        }
      },
      async add(data: Partial<T>) {
        const name = humanEndpoint(endpoint);
        try {
          await api.post(endpoint, data);
          await obj.refresh();
          toastSuccess(`${name} creado`, undefined);
          return { id: "", ...data } as T;
        } catch (e: any) {
          console.error(`[${endpoint} add]`, e?.message);
          toastError(
            `No se pudo crear ${name.toLowerCase()}`,
            describeError(e),
          );
          return null;
        }
      },
      /** Devuelve true si se guardó; si falla, deja el mensaje en `error`. */
      async update(id: string, data: Partial<T>): Promise<boolean> {
        const name = humanEndpoint(endpoint);
        try {
          await api.put(endpoint, { id, ...data });
          await obj.refresh();
          toastSuccess(`${name} actualizado`, undefined);
          return true;
        } catch (e: any) {
          console.error(`[${endpoint} update]`, e?.message);
          set((s: any) => ({
            [key]: { ...s[key], error: e?.message ?? "Error al actualizar" },
          }));
          toastError(
            `No se pudo actualizar ${name.toLowerCase()}`,
            describeError(e),
          );
          return false;
        }
      },
      async remove(id: string) {
        const name = humanEndpoint(endpoint);
        try {
          await api.del(`${endpoint}?id=${encodeURIComponent(id)}`);
          set((s: any) => {
            const c = (get() as any)[key];
            return {
              [key]: { ...c, items: c.items.filter((i: T) => i.id !== id) },
            };
          });
          toastSuccess(`${name} eliminado`, undefined);
        } catch (e: any) {
          console.error(`[${endpoint} remove]`, e?.message);
          toastError(
            `No se pudo eliminar ${name.toLowerCase()}`,
            describeError(e),
          );
        }
      },
    };
    return obj;
  }

  /** Ejecuta una acción del PT y recarga los presupuestos; nunca lanza. */
  async function budgetAction(
    run: () => Promise<unknown>,
  ): Promise<BudgetActionResult> {
    try {
      await run();
      const items = await api.get<Budget[]>("/api/budgets");
      set((s: any) => ({
        budgets: { ...s.budgets, items, loaded: true, error: null },
      }));
      return { ok: true };
    } catch (e: any) {
      console.error("[budgets action]", e?.message);
      return { ok: false, error: e?.message ?? "Error en el presupuesto" };
    }
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
    cuts: (() => {
      const base = col<WorkCut>("/api/cuts");
      return {
        ...base,
        async performAction(
          id: string,
          action: string,
          user: any,
          opts: any = {},
        ) {
          try {
            await api.patch("/api/cuts", { id, action, user, ...opts });
            // P1: reusar la normalizacion paginada del helper col() para
            //   que el store siga exponiendo items: WorkCut[] aunque la
            //   API devuelva {data, pagination}.
            await base.refresh();
            return { ok: true };
          } catch (e: any) {
            console.error("[cuts action]", e?.message);
            return { ok: false, error: e?.message ?? "Error" };
          }
        },
        /**
         * P1 (seccion 4.3): carga una pagina concreta del listado paginado.
         * Reutiliza la misma normalizacion de `refresh` para que el store
         * exponga `items: WorkCut[]` y `pagination: {total, page, ...}`.
         */
        loadPage: async (page: number, limit: number) => {
          set((s: any) => ({
            cuts: { ...s.cuts, loading: true, error: null },
          }));
          try {
            const response = await api.get<any>(
              `/api/cuts?page=${page}&limit=${limit}`,
            );
            if (response && Array.isArray(response.data)) {
              set((s: any) => ({
                cuts: {
                  ...s.cuts,
                  items: response.data,
                  pagination: response.pagination ?? null,
                  loaded: true,
                  loading: false,
                  error: null,
                },
              }));
            } else {
              set((s: any) => ({
                cuts: {
                  ...s.cuts,
                  items: response ?? [],
                  pagination: null,
                  loaded: true,
                  loading: false,
                  error: null,
                },
              }));
            }
            return { ok: true as const };
          } catch (e: any) {
            console.error("[cuts loadPage]", e?.message);
            set((s: any) => ({
              cuts: { ...s.cuts, error: e?.message ?? "Error", loading: false },
            }));
            return { ok: false as const, error: e?.message ?? "Error" };
          }
        },
      };
    })(),
    payments: (() => {
      const base = col<PaymentRequest>("/api/payments");
      return {
        ...base,
        async performAction(
          id: string,
          action: string,
          user: any,
          opts: any = {},
        ) {
          try {
            await api.patch("/api/payments", { id, action, user, ...opts });
            await base.refresh();
            return { ok: true };
          } catch (e: any) {
            console.error("[payments action]", e?.message);
            return { ok: false, error: e?.message ?? "Error" };
          }
        },
      };
    })(),
    clients: {
      ...col<Client>("/api/clients"),
    },
    quotations: (() => {
      const base = col<Quotation>("/api/quotations");
      return {
        ...base,
        loadPage: async (page: number, limit: number) => {
          set((s: any) => ({
            quotations: { ...s.quotations, loading: true, error: null },
          }));
          try {
            const response = await api.get<any>(
              `/api/quotations?page=${page}&limit=${limit}`,
            );
            if (response && Array.isArray(response.data)) {
              set((s: any) => ({
                quotations: {
                  ...s.quotations,
                  items: response.data,
                  pagination: response.pagination ?? null,
                  loaded: true,
                  loading: false,
                  error: null,
                },
              }));
            } else {
              set((s: any) => ({
                quotations: {
                  ...s.quotations,
                  items: response ?? [],
                  pagination: null,
                  loaded: true,
                  loading: false,
                  error: null,
                },
              }));
            }
            return { ok: true as const };
          } catch (e: any) {
            console.error("[quotations loadPage]", e?.message);
            set((s: any) => ({
              quotations: {
                ...s.quotations,
                error: e?.message ?? "Error",
                loading: false,
              },
            }));
            return { ok: false as const, error: e?.message ?? "Error" };
          }
        },
      };
    })(),
    workLogs: {
      ...col<WorkLog>("/api/work-logs", "workLogs"),
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
      ...col<AiuConfig>("/api/aiu-configs", "aius"),
    },
    budgets: {
      ...col<Budget>("/api/budgets"),
      // Acciones del PT (antes vivían en el store legacy budgets-store.ts).
      async createPT(projectId: string, layers: BudgetLayer[], notes?: string) {
        return budgetAction(() =>
          api.post("/api/budgets", { projectId, layers, notes }),
        );
      },
      async createNewVersion(
        projectId: string,
        layers: BudgetLayer[],
        notes?: string,
      ) {
        const existing = ((get() as any).budgets.items as Budget[]).find(
          (b) => b.projectId === projectId,
        );
        if (!existing)
          return {
            ok: false,
            error: "No existe un PT previo para este proyecto",
          };
        return budgetAction(() =>
          api.patch("/api/budgets", {
            id: existing.id,
            action: "NEW_VERSION",
            layers,
            notes,
          }),
        );
      },
      async addUnforeseenItem(budgetId: string, item: UnforeseenItemInput) {
        return budgetAction(() =>
          api.patch("/api/budgets", {
            id: budgetId,
            action: "ADD_UNFORESEEN",
            item,
          }),
        );
      },
      async removeUnforeseenItem(budgetId: string, itemId: string) {
        return budgetAction(() =>
          api.patch("/api/budgets", {
            id: budgetId,
            action: "REMOVE_UNFORESEEN",
            itemId,
          }),
        );
      },
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
  const error = useDataStore((x) => x.projects.error);
  const pagination = useDataStore((x) => x.projects.pagination);
  return {
    projects: projectsAll,
    loaded: s.loaded,
    loading: s.loading,
    error,
    pagination,
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
    toggleActive: (id: string, active?: boolean) =>
      s.update(id, { isActive: active } as any),
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
      console.warn(
        "addDocument: pendiente de implementar tabla contract_documents",
      );
    },
    removeDocument: async (contractId: string, _docId: string) => {
      console.warn("removeDocument: pendiente");
    },
    performAction: (...args: any[]) => {
      console.warn("performAction pending");
      return Promise.resolve({ ok: false });
    },
    toggleActive: (id: string, active?: boolean) =>
      s.update(id, { isActive: active } as any),
    load: s.load,
  } as any;
};

export const useCutsStore = () => {
  const s = useDataStore((x) => x.cuts);
  const items = useDataStore((x) => x.cuts.items) as WorkCut[];
  const error = useDataStore((x) => x.cuts.error);
  const pagination = useDataStore((x) => x.cuts.pagination);
  return {
    cuts: items,
    loaded: s.loaded,
    loading: s.loading,
    error,
    pagination,
    addCut: (data: any, _projectCode: string) => s.add(data),
    loadPage: s.loadPage,
    updateCut: (id: string, c: any) => s.update(id, c),
    deleteCut: (id: string) => s.remove(id),
    getCut: (id: string) => items.find((c) => c.id === id),
    addItem: async (cutId: string, _item: any) =>
      console.warn("addItem pendiente"),
    updateItem: async (cutId: string, _itemId: string, _u: any) =>
      console.warn("updateItem pendiente"),
    removeItem: async (cutId: string, _itemId: string) =>
      console.warn("removeItem pendiente"),
    addDocument: async (cutId: string, _doc: any) =>
      console.warn("addDocument pendiente"),
    removeDocument: async (cutId: string, _docId: string) =>
      console.warn("removeDocument pendiente"),
    performAction: (
      id: string,
      action: string,
      user: any,
      comments?: string,
      rejectionReason?: string,
    ) => s.performAction(id, action, user, { comments, rejectionReason }),
    toggleActive: (id: string, active?: boolean) =>
      s.update(id, { isActive: active } as any),
    setStatus: (id: string, status: any) => s.update(id, { status } as any),
    load: s.load,
  } as any;
};

export const usePaymentsStore = () => {
  const s = useDataStore((x) => x.payments);
  const items = useDataStore((x) => x.payments.items) as PaymentRequest[];
  const error = useDataStore((x) => x.payments.error);
  const pagination = useDataStore((x) => x.payments.pagination);
  return {
    payments: items,
    loaded: s.loaded,
    loading: s.loading,
    error,
    pagination,
    addPayment: (data: any) => s.add(data),
    loadPage: s.loadPage,
    updatePayment: (id: string, p: any) => s.update(id, p),
    deletePayment: (id: string) => s.remove(id),
    getPayment: (id: string) => items.find((p) => p.id === id),
    performAction: (id: string, action: string, user: any, payload: any = {}) =>
      s.performAction(id, action, user, payload),
    toggleActive: (id: string, active?: boolean) =>
      s.update(id, { isActive: active } as any),
    setStatus: (id: string, status: any) => s.update(id, { status } as any),
    load: s.load,
  } as any;
};

export const useClientsStore = () => {
  const s = useDataStore((x) => x.clients);
  const items = useDataStore((x) => x.clients.items) as Client[];
  const error = useDataStore((x) => x.clients.error);
  return {
    clients: items,
    loaded: s.loaded,
    loading: s.loading,
    error,
    addClient: (data: any) => s.add(data),
    updateClient: (id: string, c: any) => s.update(id, c),
    deleteClient: (id: string) => s.remove(id),
    getClient: (id: string) => items.find((c) => c.id === id),
    toggleActive: (id: string, active?: boolean) =>
      s.update(id, { isActive: active } as any),
    setStatus: (id: string, status: any) => s.update(id, { status } as any),
    load: s.load,
  } as any;
};

export const useQuotationsStore = () => {
  const s = useDataStore((x) => x.quotations);
  const items = useDataStore((x) => x.quotations.items) as Quotation[];
  const error = useDataStore((x) => x.quotations.error);
  const pagination = useDataStore((x) => x.quotations.pagination);
  return {
    quotations: items,
    loaded: s.loaded,
    loading: s.loading,
    error,
    pagination,
    addQuotation: (data: any) => s.add(data),
    loadPage: s.loadPage,
    updateQuotation: (id: string, q: any) => s.update(id, q),
    deleteQuotation: (id: string) => s.remove(id),
    getQuotation: (id: string) => items.find((q) => q.id === id),
    toggleActive: (id: string, active?: boolean) =>
      s.update(id, { isActive: active } as any),
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
    toggleActive: (id: string, active?: boolean) =>
      s.update(id, { isActive: active } as any),
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
    addDocument: async (_id: string, _doc: any) => {
      console.warn("employee_documents pendiente");
    },
    removeDocument: async (_id: string, _docId: string) => {
      console.warn("employee_documents pendiente");
    },
    toggleActive: (id: string, active?: boolean) =>
      s.update(id, { isActive: active } as any),
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
    toggleActive: (id: string, active?: boolean) =>
      s.update(id, { isActive: active } as any),
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
    toggleActive: (id: string, active?: boolean) =>
      s.update(id, { isActive: active } as any),
    setStatus: (id: string, status: any) => s.update(id, { status } as any),
    load: s.load,
  } as any;
};

export const useAiuStore = () => {
  const s = useDataStore((x) => x.aius);
  const items = useDataStore((x) => x.aius.items) as AiuConfig[];
  return {
    aius: items,
    getAiuByProject: (projectId: string) =>
      items.find((a) => a.projectId === projectId),
    getConfig: (projectId: string) =>
      items.find((a) => a.projectId === projectId),
    hasConfig: (projectId: string) =>
      items.some((a) => a.projectId === projectId),
    /** Crea o actualiza el AIU del proyecto. SPEC: bug-presupuestos-persistencia AC-9 */
    upsertConfig: async (
      data: Pick<
        AiuConfig,
        "projectId" | "administration" | "imprevistos" | "utilidad"
      > & { notes?: string },
    ): Promise<{ ok: boolean; error?: string }> => {
      const existing = items.find((a) => a.projectId === data.projectId);
      try {
        if (existing)
          await api.put("/api/aiu-configs", { id: existing.id, ...data });
        else await api.post("/api/aiu-configs", data);
        const fresh = await api.get<AiuConfig[]>("/api/aiu-configs");
        useDataStore.setState((st: any) => ({
          aius: { ...st.aius, items: fresh, loaded: true, error: null },
        }));
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e?.message ?? "Error al guardar el AIU" };
      }
    },
    addAiu: (data: any) => s.add(data),
    updateAiu: (id: string, a: any) => s.update(id, a),
    toggleActive: (id: string, active?: boolean) =>
      s.update(id, { isActive: active } as any),
    setStatus: (id: string, status: any) => s.update(id, { status } as any),
    load: s.load,
  } as any;
};

export const useBudgetsStore = () => {
  const s = useDataStore((x) => x.budgets);
  const items = useDataStore((x) => x.budgets.items) as Budget[];
  return {
    budgets: items,
    getBudgetByProject: (projectId: string) =>
      items.find((b) => b.projectId === projectId),
    hasBudget: (projectId: string) =>
      items.some((b) => b.projectId === projectId),
    addBudget: (data: any) => s.add(data),
    updateBudget: (id: string, b: any) => s.update(id, b),
    createPT: s.createPT,
    createNewVersion: s.createNewVersion,
    addUnforeseenItem: s.addUnforeseenItem,
    removeUnforeseenItem: s.removeUnforeseenItem,
    toggleActive: (id: string, active?: boolean) =>
      s.update(id, { isActive: active } as any),
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
    toggleActive: (id: string, active?: boolean) =>
      s.update(id, { isActive: active } as any),
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
    toggleActive: (id: string, active?: boolean) =>
      s.update(id, { isActive: active } as any),
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
export {
  CLIENT_STATUS_LABELS,
  CLIENT_STATUS_VARIANTS,
  CLIENT_SOURCE_LABELS,
} from "./clients-constants";
export {
  EMPLOYEE_STATUS_LABELS,
  EMPLOYEE_STATUS_VARIANTS,
  EMPLOYEE_DEPARTMENT_LABELS,
  EMPLOYEE_CONTRACT_LABELS,
  EMPLOYEE_DOC_TYPE_LABELS,
} from "./employees-constants";
export {
  PROVIDER_STATUS_LABELS,
  PROVIDER_STATUS_VARIANTS,
  DOCUMENT_TYPE_LABELS,
  PERSON_TYPE_LABELS,
  CATEGORY_LABELS,
  requiredDocsFor,
} from "./providers-constants";
export {
  QUOTATION_STATUS_LABELS,
  QUOTATION_STATUS_VARIANTS,
} from "./quotations-constants";
export {
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_VARIANTS,
  PAYMENT_TYPE_LABELS,
  PAYMENT_PRIORITY_LABELS,
  PAYMENT_PRIORITY_VARIANTS,
  PAYMENT_ACTION_LABELS,
  getAvailablePaymentActions,
} from "./payments-constants";
export {
  CONTRACT_TYPE_LABELS,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_VARIANTS,
  CONTRACT_DOCUMENT_TYPE_LABELS,
  REQUIRED_CONTRACT_DOCS,
} from "./contracts-constants";

// Additional re-exports found as needed by paginas
export { TAX_TYPE_LABELS, TAX_APPLIES_LABELS } from "./taxes-constants";
export {
  EXPENSE_TYPE_LABELS,
  EXPENSE_STATUS_LABELS,
  EXPENSE_STATUS_VARIANTS,
  categoryFor,
} from "./expenses-constants";
export { PSC_STATUS_LABELS, PSC_STATUS_VARIANTS } from "./pscs-constants";

// Catch-all: re-export todo lo que las paginas importaban de los legacy
export { WEATHER_LABELS, WEATHER_ICONS } from "./logs-constants";
export { validateAiu } from "./aiu-constants";

// Re-exports adicionales ACTION_LABELS / ACTION_BUTTONS para cortes/[id]
export { ACTION_LABELS, ACTION_BUTTONS } from "./cuts-constants";
