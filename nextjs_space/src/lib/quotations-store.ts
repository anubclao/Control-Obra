"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Quotation, QuotationItem, QuotationStatus } from "@/types";
import { MOCK_QUOTATIONS } from "@/mocks";
import { useClientsStore } from "./clients-store";

interface QuotationsStore {
  quotations: Quotation[];
  addQuotation: (
    data: Omit<
      Quotation,
      | "id"
      | "quotationNumber"
      | "subtotal"
      | "discountAmount"
      | "ivaAmount"
      | "total"
      | "createdAt"
    >,
  ) => Quotation;
  updateQuotation: (id: string, updates: Partial<Quotation>) => void;
  deleteQuotation: (id: string) => void;
  getQuotation: (id: string) => Quotation | undefined;
  getByClient: (clientId: string) => Quotation[];
  setStatus: (id: string, status: QuotationStatus) => void;
  // Si se acepta, marca al cliente como WON y crea proyecto
  acceptQuotation: (
    id: string,
    projectId?: string,
  ) => { ok: boolean; error?: string };
}

function nextId(): string {
  return `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

function nextQuotationNumber(quotations: Quotation[]): string {
  const year = new Date().getFullYear();
  const sameYear = quotations.filter((q) =>
    q.quotationNumber.startsWith(`COT-${year}`),
  );
  const next = sameYear.length + 1;
  return `COT-${year}-${String(next).padStart(4, "0")}`;
}

function computeTotals(
  items: QuotationItem[],
  discountPercent: number,
  ivaPercent: number,
) {
  const subtotal = items.reduce((s, it) => s + it.totalPrice, 0);
  const discountAmount = Math.round(subtotal * (discountPercent / 100));
  const base = subtotal - discountAmount;
  const ivaAmount = Math.round(base * (ivaPercent / 100));
  const total = base + ivaAmount;
  return { subtotal, discountAmount, ivaAmount, total };
}

export const useQuotationsStore = create<QuotationsStore>()(
  persist(
    (set, get) => ({
      quotations: MOCK_QUOTATIONS,

      addQuotation: (data) => {
        const quotations = get().quotations;
        const totals = computeTotals(
          data.items,
          data.discountPercent,
          data.ivaPercent,
        );
        const q: Quotation = {
          ...data,
          ...totals,
          id: nextId(),
          quotationNumber: nextQuotationNumber(quotations),
          createdAt: new Date().toISOString().slice(0, 10),
        };
        set({ quotations: [q, ...quotations] });
        return q;
      },

      updateQuotation: (id, updates) => {
        set({
          quotations: get().quotations.map((q) => {
            if (q.id !== id) return q;
            const merged = { ...q, ...updates };
            // Recalcular totales si items, descuento o iva cambiaron
            const totals = computeTotals(
              merged.items,
              merged.discountPercent,
              merged.ivaPercent,
            );
            return { ...merged, ...totals };
          }),
        });
      },

      deleteQuotation: (id) => {
        set({ quotations: get().quotations.filter((q) => q.id !== id) });
      },

      getQuotation: (id) => get().quotations.find((q) => q.id === id),

      getByClient: (clientId) =>
        get().quotations.filter((q) => q.clientId === clientId),

      setStatus: (id, status) => {
        // FIX Bug #37: leer la cotización UNA vez y reutilizarla
        const current = get().getQuotation(id);
        if (!current) return;
        const updates: Partial<Quotation> = { status };
        if (status === "SENT" && !current.sentAt) {
          updates.sentAt = new Date().toISOString();
        }
        if (status === "VIEWED" && !current.viewedAt) {
          updates.viewedAt = new Date().toISOString();
        }
        if (
          (status === "ACCEPTED" || status === "REJECTED") &&
          !current.respondedAt
        ) {
          updates.respondedAt = new Date().toISOString();
        }
        set({
          quotations: get().quotations.map((q) =>
            q.id === id ? { ...q, ...updates } : q,
          ),
        });
      },

      acceptQuotation: (id, projectId) => {
        const q = get().getQuotation(id);
        if (!q) return { ok: false, error: "Cotización no encontrada" };
        if (q.status === "ACCEPTED")
          return { ok: false, error: "Ya está aceptada" };
        const updates: Partial<Quotation> = {
          status: "ACCEPTED",
          respondedAt: new Date().toISOString(),
        };
        if (projectId) updates.convertedToProjectId = projectId;
        set({
          quotations: get().quotations.map((x) =>
            x.id === id ? { ...x, ...updates } : x,
          ),
        });
        // Marcar cliente como ganado
        try {
          useClientsStore.getState().setStatus(q.clientId, "WON");
        } catch {
          // ignorar
        }
        return { ok: true };
      },
    }),
    { name: "controlobra-quotations" },
  ),
);

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  VIEWED: "Vista",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
  EXPIRED: "Vencida",
  CANCELLED: "Cancelada",
};

export const QUOTATION_STATUS_VARIANTS: Record<
  QuotationStatus,
  "default" | "info" | "warning" | "success" | "destructive"
> = {
  DRAFT: "default",
  SENT: "info",
  VIEWED: "info",
  ACCEPTED: "success",
  REJECTED: "destructive",
  EXPIRED: "warning",
  CANCELLED: "default",
};
