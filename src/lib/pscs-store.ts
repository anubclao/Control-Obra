"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PSC, PSCStatus, PSCItem, BudgetItem } from "@/types";
import { MOCK_PSC } from "@/mocks";
import { useBudgetStore } from "./budgets-store";

interface PSCsStore {
  pscs: PSC[];

  // Listados
  getByProject: (projectId: string) => PSC[];
  getByProvider: (providerId: string) => PSC[];
  getPSC: (id: string) => PSC | undefined;
  hasPSC: (projectId: string, providerId: string) => boolean;

  // CRUD
  createPSC: (data: Omit<PSC, "id" | "pscNumber" | "totalValue" | "createdAt">) => {
    ok: boolean;
    error?: string;
    psc?: PSC;
  };
  updatePSC: (id: string, updates: Partial<PSC>) => void;
  deletePSC: (id: string) => void;
  setStatus: (id: string, status: PSCStatus) => void;

  // Items (espejo del PT)
  setItems: (id: string, items: PSCItem[]) => void;
  updateItem: (id: string, itemId: string, updates: Partial<PSCItem>) => void;

  // Calculados
  getItemsAvailable: (projectId: string, excludePscId?: string) => BudgetItem[];
  isItemCovered: (projectId: string, budgetItemId: string, excludePscId?: string) => boolean;
}

function nextId(): string {
  return `psc${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

function nextPSCNumber(pscs: PSC[]): string {
  const year = new Date().getFullYear();
  const sameYear = pscs.filter((p) => p.pscNumber.startsWith(`PSC-${year}`));
  const next = sameYear.length + 1;
  return `PSC-${year}-${String(next).padStart(4, "0")}`;
}

function computeTotal(items: PSCItem[]): number {
  return items.reduce((s, it) => s + it.totalPrice, 0);
}

export const usePSCsStore = create<PSCsStore>()(
  persist(
    (set, get) => ({
      pscs: MOCK_PSC,

      getByProject: (projectId) =>
        get().pscs.filter((p) => p.projectId === projectId),

      getByProvider: (providerId) =>
        get().pscs.filter((p) => p.providerId === providerId),

      getPSC: (id) => get().pscs.find((p) => p.id === id),

      hasPSC: (projectId, providerId) =>
        !!get().pscs.find(
          (p) =>
            p.projectId === projectId &&
            p.providerId === providerId &&
            p.status !== "CANCELLED"
        ),

      createPSC: (data) => {
        // Regla: 1 PSC activo por (proyecto, contratista)
        const existing = get().pscs.find(
          (p) =>
            p.projectId === data.projectId &&
            p.providerId === data.providerId &&
            p.status !== "CANCELLED"
        );
        if (existing) {
          return {
            ok: false,
            error: `Ya existe un PSC para este contratista en este proyecto (${existing.pscNumber}). Crea uno nuevo solo si el anterior está cancelado.`,
          };
        }
        // Validación: cada item del PSC debe corresponder a un item del PT
        const budget = useBudgetStore.getState().getBudgetByProject(data.projectId);
        if (!budget) {
          return { ok: false, error: "El proyecto no tiene un PT cargado" };
        }
        const validIds = new Set(budget.layers.flatMap((l) => l.items.map((i) => i.id)));
        for (const item of data.items) {
          if (!validIds.has(item.budgetItemId)) {
            return {
              ok: false,
              error: `Item ${item.budgetItemId} no existe en el PT del proyecto`,
            };
          }
        }

        const psc: PSC = {
          ...data,
          id: nextId(),
          pscNumber: nextPSCNumber(get().pscs),
          totalValue: computeTotal(data.items),
          createdAt: new Date().toISOString().slice(0, 10),
        };
        set({ pscs: [psc, ...get().pscs] });
        return { ok: true, psc };
      },

      updatePSC: (id, updates) => {
        set({
          pscs: get().pscs.map((p) => {
            if (p.id !== id) return p;
            const merged = { ...p, ...updates };
            if (updates.items) {
              merged.totalValue = computeTotal(updates.items);
            }
            return merged;
          }),
        });
      },

      deletePSC: (id) => {
        set({ pscs: get().pscs.filter((p) => p.id !== id) });
      },

      setStatus: (id, status) => {
        set({
          pscs: get().pscs.map((p) => (p.id === id ? { ...p, status } : p)),
        });
      },

      setItems: (id, items) => {
        set({
          pscs: get().pscs.map((p) =>
            p.id !== id
              ? p
              : { ...p, items, totalValue: computeTotal(items) }
          ),
        });
      },

      updateItem: (id, itemId, updates) => {
        set({
          pscs: get().pscs.map((p) => {
            if (p.id !== id) return p;
            const items = p.items.map((it) =>
              it.id === itemId
                ? {
                    ...it,
                    ...updates,
                    totalPrice:
                      updates.totalPrice !== undefined
                        ? updates.totalPrice
                        : (updates.quantity ?? it.quantity) * (updates.unitPrice ?? it.unitPrice),
                  }
                : it
            );
            return { ...p, items, totalValue: computeTotal(items) };
          }),
        });
      },

      getItemsAvailable: (projectId, excludePscId) => {
        // Items del PT que NO están ya cubiertos por otros PSCs activos del mismo proyecto
        const budget = useBudgetStore.getState().getBudgetByProject(projectId);
        if (!budget) return [];
        const allPTItems = budget.layers.flatMap((l) => l.items);

        const otherPscs = get().pscs.filter(
          (p) =>
            p.projectId === projectId &&
            p.id !== excludePscId &&
            p.status !== "CANCELLED" &&
            p.status !== "DRAFT"
        );
        const usedIds = new Set(otherPscs.flatMap((p) => p.items.map((i) => i.budgetItemId)));
        return allPTItems.filter((i) => !usedIds.has(i.id));
      },

      isItemCovered: (projectId, budgetItemId, excludePscId) => {
        const otherPscs = get().pscs.filter(
          (p) =>
            p.projectId === projectId &&
            p.id !== excludePscId &&
            p.status !== "CANCELLED" &&
            p.status !== "DRAFT"
        );
        return otherPscs.some((p) => p.items.some((i) => i.budgetItemId === budgetItemId));
      },
    }),
    { name: "controlobra-psc" }
  )
);

export const PSC_STATUS_LABELS: Record<PSCStatus, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  SUSPENDED: "Suspendido",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

export const PSC_STATUS_VARIANTS: Record<PSCStatus, "default" | "success" | "warning" | "info" | "destructive"> = {
  DRAFT: "default",
  ACTIVE: "success",
  SUSPENDED: "warning",
  COMPLETED: "info",
  CANCELLED: "destructive",
};
