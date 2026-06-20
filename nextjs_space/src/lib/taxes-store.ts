"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TaxConfig, TaxType, TaxAppliesTo } from "@/types";
import { MOCK_TAXES } from "@/mocks";

interface TaxesStore {
  taxes: TaxConfig[];
  addTax: (data: Omit<TaxConfig, "id" | "createdAt">) => TaxConfig;
  updateTax: (id: string, updates: Partial<TaxConfig>) => void;
  deleteTax: (id: string) => void;
  toggleActive: (id: string) => void;
}

function nextId(): string {
  return `tx${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export const useTaxesStore = create<TaxesStore>()(
  persist(
    (set, get) => ({
      taxes: MOCK_TAXES,
      addTax: (data) => {
        const tax: TaxConfig = {
          ...data,
          id: nextId(),
          createdAt: new Date().toISOString().slice(0, 10),
        };
        set({ taxes: [...get().taxes, tax] });
        return tax;
      },
      updateTax: (id, updates) => {
        set({ taxes: get().taxes.map((t) => (t.id === id ? { ...t, ...updates } : t)) });
      },
      deleteTax: (id) => {
        set({ taxes: get().taxes.filter((t) => t.id !== id) });
      },
      toggleActive: (id) => {
        set({
          taxes: get().taxes.map((t) => (t.id === id ? { ...t, isActive: !t.isActive } : t)),
        });
      },
    }),
    { name: "controlobra-taxes" }
  )
);

export const TAX_TYPE_LABELS: Record<TaxType, string> = {
  IVA: "IVA",
  RETENCION_FUENTE: "Retención en la Fuente",
  RETENCION_IVA: "Retención de IVA",
  RETENCION_ICA: "Retención de ICA",
  ESTAMPILLAS: "Estampillas",
  OTROS: "Otros",
};

export const TAX_APPLIES_LABELS: Record<TaxAppliesTo, string> = {
  VENTAS: "Solo ventas",
  COMPRAS: "Solo compras",
  AMBOS: "Ventas y compras",
};
