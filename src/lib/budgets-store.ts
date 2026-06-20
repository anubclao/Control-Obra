"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Budget,
  BudgetLayer,
  BudgetItem,
  BudgetVersion,
} from "@/types";
import { MOCK_BUDGETS } from "@/mocks";

interface BudgetStore {
  budgets: Budget[];

  getBudgetByProject: (projectId: string) => Budget | undefined;
  hasBudget: (projectId: string) => boolean;
  getActiveVersion: (projectId: string) => BudgetVersion | undefined;
  getAllItems: (budgetId: string) => BudgetItem[];

  // PT - crear/reemplazar
  createPT: (projectId: string, layers: BudgetLayer[], notes?: string) => {
    ok: boolean;
    error?: string;
    budget?: Budget;
  };

  // PT - nueva versión (mantiene histórico, crea v2 o mayor)
  createNewVersion: (
    projectId: string,
    layers: BudgetLayer[],
    notes?: string
  ) => { ok: boolean; error?: string; budget?: Budget };

  updateItem: (
    budgetId: string,
    itemId: string,
    updates: Partial<BudgetItem>
  ) => void;

  deleteBudget: (budgetId: string) => void;

  // PRESUPUESTO CLIENTE — PDF p.3
  setClientBudget: (budgetId: string, layers: BudgetLayer[]) => void;

  // ITEMS NO PREVISTOS — PDF p.5: al crear aparece auto en presupuesto tope
  addUnforeseenItem: (
    budgetId: string,
    item: Omit<BudgetItem, "id" | "layerId" | "totalPrice" | "executedQuantity" | "executedAmount">
  ) => BudgetItem | undefined;
  removeUnforeseenItem: (budgetId: string, itemId: string) => void;
}

function nextId(prefix = "bi"): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

function computeBudgetTotals(layers: BudgetLayer[]): number {
  return layers.reduce(
    (sum, l) => sum + l.items.reduce((s, it) => s + it.totalPrice, 0),
    0
  );
}

// Asegura que el Budget tenga los campos nuevos (PDF p.3-5)
function ensureBudgetShape(b: Budget): Budget {
  return {
    ...b,
    clientLayers: b.clientLayers ?? [],
    clientValue: b.clientValue ?? 0,
    unforeseenItems: b.unforeseenItems ?? [],
    unforeseenValue: b.unforeseenValue ?? 0,
  };
}

export const useBudgetStore = create<BudgetStore>()(
  persist(
    (set, get) => ({
      budgets: MOCK_BUDGETS,

      getBudgetByProject: (projectId) => {
        const b = get().budgets.find((x) => x.projectId === projectId);
        return b ? ensureBudgetShape(b) : undefined;
      },

      hasBudget: (projectId) => !!get().budgets.find((b) => b.projectId === projectId),

      getActiveVersion: (projectId) => {
        const b = get().budgets.find((x) => x.projectId === projectId);
        if (!b) return undefined;
        return b.versions.find((v) => v.id === b.activeVersionId);
      },

      getAllItems: (budgetId) => {
        const b = get().budgets.find((x) => x.id === budgetId);
        if (!b) return [];
        return b.layers.flatMap((l) => l.items);
      },

      // Regla de oro: si ya hay PT, NO se puede crear otro, hay que crear nueva versión
      createPT: (projectId, layers, notes) => {
        const existing = get().budgets.find((b) => b.projectId === projectId);
        if (existing) {
          return {
            ok: false,
            error: `Este proyecto ya tiene un PT cargado (${existing.versions.find(v => v.id === existing.activeVersionId)?.notes || "versión inicial"}). Para reemplazarlo, usa "Nueva versión".`,
          };
        }
        const totalValue = computeBudgetTotals(layers);
        const versionId = nextId("bv");
        const budgetId = nextId("b");
        const version: BudgetVersion = {
          id: versionId,
          budgetId,
          version: 1,
          isActive: true,
          totalValue,
          createdAt: new Date().toISOString().slice(0, 10),
          notes: notes || "PT inicial",
        };
        const budget: Budget = {
          id: budgetId,
          projectId,
          activeVersionId: versionId,
          versions: [version],
          layers: layers.map((l) => ({ ...l, budgetId })),
          totalValue,
          // Inicialmente Cliente = Tope (snapshot del presupuesto firmado)
          clientLayers: layers.map((l) => ({ ...l, budgetId })),
          clientValue: totalValue,
          unforeseenItems: [],
          unforeseenValue: 0,
          createdAt: new Date().toISOString().slice(0, 10),
        };
        set({ budgets: [...get().budgets, budget] });
        return { ok: true, budget };
      },

      // Nueva versión: desactiva la anterior, crea v2
      createNewVersion: (projectId, layers, notes) => {
        const existing = get().budgets.find((b) => b.projectId === projectId);
        if (!existing) {
          return { ok: false, error: "No existe un PT previo para este proyecto" };
        }
        const totalValue = computeBudgetTotals(layers);
        const newVersionNumber = Math.max(...existing.versions.map((v) => v.version)) + 1;
        const newVersionId = nextId("bv");
        const newVersion: BudgetVersion = {
          id: newVersionId,
          budgetId: existing.id,
          version: newVersionNumber,
          isActive: true,
          totalValue,
          createdAt: new Date().toISOString().slice(0, 10),
          notes: notes || `Revisión v${newVersionNumber}`,
        };

        // Desactivar todas las versiones anteriores
        const updatedVersions: BudgetVersion[] = existing.versions.map((v) => ({
          ...v,
          isActive: false,
        }));
        updatedVersions.push(newVersion);

        const updatedBudget: Budget = {
          ...existing,
          activeVersionId: newVersionId,
          versions: updatedVersions,
          layers: layers.map((l) => ({ ...l, budgetId: existing.id })),
          totalValue,
          clientLayers: existing.clientLayers ?? layers.map((l) => ({ ...l, budgetId: existing.id })),
          clientValue: existing.clientValue ?? totalValue,
          unforeseenItems: existing.unforeseenItems ?? [],
          unforeseenValue: existing.unforeseenValue ?? 0,
        };

        set({
          budgets: get().budgets.map((b) => (b.id === existing.id ? updatedBudget : b)),
        });
        return { ok: true, budget: updatedBudget };
      },

      updateItem: (budgetId, itemId, updates) => {
        set({
          budgets: get().budgets.map((b) => {
            if (b.id !== budgetId) return b;
            return {
              ...b,
              layers: b.layers.map((l) => ({
                ...l,
                items: l.items.map((it) =>
                  it.id === itemId
                    ? {
                        ...it,
                        ...updates,
                        totalPrice:
                          updates.totalPrice !== undefined
                            ? updates.totalPrice
                            : (updates.quantity ?? it.quantity) *
                              (updates.unitPrice ?? it.unitPrice),
                      }
                    : it
                ),
              })),
            };
          }),
        });
      },

      deleteBudget: (budgetId) => {
        set({ budgets: get().budgets.filter((b) => b.id !== budgetId) });
      },

      // PRESUPUESTO CLIENTE — PDF p.3
      setClientBudget: (budgetId, layers) => {
        set({
          budgets: get().budgets.map((b) => {
            if (b.id !== budgetId) return b;
            return {
              ...b,
              clientLayers: layers,
              clientValue: computeBudgetTotals(layers),
            };
          }),
        });
      },

      // ITEMS NO PREVISTOS — PDF p.5
      addUnforeseenItem: (budgetId, item) => {
        const newItem: BudgetItem = {
          ...item,
          id: nextId("ui"),
          layerId: "unforeseen",
          totalPrice: item.quantity * item.unitPrice,
          executedQuantity: 0,
          executedAmount: 0,
        };
        set({
          budgets: get().budgets.map((b) => {
            if (b.id !== budgetId) return b;
            const items = [...(b.unforeseenItems ?? []), newItem];
            return {
              ...b,
              unforeseenItems: items,
              unforeseenValue: items.reduce((s, it) => s + it.totalPrice, 0),
              // PDF p.5: al crear ITEM NO PREVISTO aparece auto en tope con % definido
              totalValue: b.totalValue + newItem.totalPrice,
            };
          }),
        });
        return newItem;
      },

      removeUnforeseenItem: (budgetId, itemId) => {
        set({
          budgets: get().budgets.map((b) => {
            if (b.id !== budgetId) return b;
            const items = (b.unforeseenItems ?? []).filter((it) => it.id !== itemId);
            const removed = (b.unforeseenItems ?? []).find((it) => it.id === itemId);
            return {
              ...b,
              unforeseenItems: items,
              unforeseenValue: items.reduce((s, it) => s + it.totalPrice, 0),
              totalValue: b.totalValue - (removed?.totalPrice ?? 0),
            };
          }),
        });
      },
    }),
    { name: "controlobra-budgets" }
  )
);
