"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  WorkCut,
  WorkCutStatus,
  WorkCutItem,
  WorkCutDocument,
  WorkCutDocumentType,
  WorkCutApproval,
  ApprovalAction,
} from "@/types";
import { MOCK_WORK_CUTS } from "@/mocks";

interface CutsStore {
  cuts: WorkCut[];
  addCut: (
    data: Omit<
      WorkCut,
      "id" | "cutNumber" | "approvals" | "documents" | "createdAt"
    >,
    projectCode: string,
  ) => WorkCut;
  updateCut: (id: string, updates: Partial<WorkCut>) => void;
  deleteCut: (id: string) => void;
  getCut: (id: string) => WorkCut | undefined;
  addItem: (cutId: string, item: Omit<WorkCutItem, "id">) => void;
  updateItem: (
    cutId: string,
    itemId: string,
    updates: Partial<WorkCutItem>,
  ) => void;
  removeItem: (cutId: string, itemId: string) => void;
  addDocument: (
    cutId: string,
    doc: Omit<WorkCutDocument, "id" | "uploadedAt">,
  ) => void;
  removeDocument: (cutId: string, docId: string) => void;
  performAction: (
    cutId: string,
    action: ApprovalAction,
    actor: { id: string; name: string; role: string },
    comments?: string,
    rejectionReason?: string,
  ) => { ok: boolean; error?: string };
}

function nextId(prefix = "wc"): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

function nextCutNumber(cuts: WorkCut[], projectCode: string): string {
  // projectCode: PRY-2026-001 → suffix "P001"
  const suffix = projectCode.split("-").pop() || "P000";
  const prefix = `CO-`;
  const sameProject = cuts.filter((c) => c.cutNumber.endsWith(`-${suffix}`));
  const next = sameProject.length + 1;
  return `${prefix}${String(next).padStart(3, "0")}-${suffix}`;
}

function computeTotals(
  items: WorkCutItem[],
  retentionPercent: number,
  advanceDeduction: number,
) {
  const grossValue = items.reduce((sum, it) => sum + it.totalPrice, 0);
  const retentionValue = Math.round(grossValue * (retentionPercent / 100));
  const netValue = grossValue - retentionValue - advanceDeduction;
  return { grossValue, retentionValue, netValue };
}

// Reglas de transición de estado
const TRANSITIONS: Record<WorkCutStatus, WorkCutStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["VALIDATED", "REJECTED", "DRAFT"], // RESIDENTE puede re-editar
  VALIDATED: ["APPROVED", "REJECTED"],
  APPROVED: ["PAID"],
  REJECTED: ["DRAFT"], // se re-edita como nuevo
  PAID: [],
};

// Quién puede hacer qué — PDF p.21: aprobar/rechazar es solo Super Admin
const ACTION_ROLES: Record<ApprovalAction, string[]> = {
  SUBMIT: ["RESIDENTE", "DIRECTOR", "ADMIN"],
  VALIDATE: ["DIRECTOR", "ADMIN"],
  APPROVE: ["ADMIN"],
  REJECT: ["ADMIN"],
  PAY: ["TESORERIA", "ADMIN"],
};

const ACTION_TARGET: Record<ApprovalAction, WorkCutStatus> = {
  SUBMIT: "SUBMITTED",
  VALIDATE: "VALIDATED",
  APPROVE: "APPROVED",
  REJECT: "REJECTED",
  PAY: "PAID",
};

export const useCutsStore = create<CutsStore>()(
  persist(
    (set, get) => ({
      cuts: MOCK_WORK_CUTS,

      addCut: (data, projectCode) => {
        const cuts = get().cuts;
        const cut: WorkCut = {
          ...data,
          id: nextId(),
          cutNumber: nextCutNumber(cuts, projectCode),
          documents: [],
          approvals: [],
          createdAt: new Date().toISOString().slice(0, 10),
        };
        set({ cuts: [cut, ...cuts] });
        return cut;
      },

      updateCut: (id, updates) => {
        set({
          cuts: get().cuts.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        });
      },

      deleteCut: (id) => {
        set({ cuts: get().cuts.filter((c) => c.id !== id) });
      },

      getCut: (id) => get().cuts.find((c) => c.id === id),

      addItem: (cutId, item) => {
        set({
          cuts: get().cuts.map((c) => {
            if (c.id !== cutId) return c;
            if (c.status !== "DRAFT" && c.status !== "REJECTED") return c;
            const items = [...c.items, { ...item, id: nextId("wi") }];
            const totals = computeTotals(
              items,
              c.retentionPercent,
              c.advanceDeduction,
            );
            return { ...c, items, ...totals };
          }),
        });
      },

      updateItem: (cutId, itemId, updates) => {
        set({
          cuts: get().cuts.map((c) => {
            if (c.id !== cutId) return c;
            if (c.status !== "DRAFT" && c.status !== "REJECTED") return c;
            const items = c.items.map((it) =>
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
                : it,
            );
            const totals = computeTotals(
              items,
              c.retentionPercent,
              c.advanceDeduction,
            );
            return { ...c, items, ...totals };
          }),
        });
      },

      removeItem: (cutId, itemId) => {
        set({
          cuts: get().cuts.map((c) => {
            if (c.id !== cutId) return c;
            if (c.status !== "DRAFT" && c.status !== "REJECTED") return c;
            const items = c.items.filter((it) => it.id !== itemId);
            const totals = computeTotals(
              items,
              c.retentionPercent,
              c.advanceDeduction,
            );
            return { ...c, items, ...totals };
          }),
        });
      },

      addDocument: (cutId, doc) => {
        set({
          cuts: get().cuts.map((c) =>
            c.id !== cutId
              ? c
              : {
                  ...c,
                  documents: [
                    ...c.documents,
                    {
                      ...doc,
                      id: nextId("wd"),
                      uploadedAt: new Date().toISOString().slice(0, 10),
                    },
                  ],
                },
          ),
        });
      },

      removeDocument: (cutId, docId) => {
        set({
          cuts: get().cuts.map((c) =>
            c.id !== cutId
              ? c
              : { ...c, documents: c.documents.filter((d) => d.id !== docId) },
          ),
        });
      },

      performAction: (cutId, action, actor, comments, rejectionReason) => {
        const cut = get().getCut(cutId);
        if (!cut) return { ok: false, error: "Corte no encontrado" };

        const allowedRoles = ACTION_ROLES[action];
        if (!allowedRoles.includes(actor.role) && actor.role !== "ADMIN") {
          return {
            ok: false,
            error: `Tu rol (${actor.role}) no puede ${action.toLowerCase()}`,
          };
        }

        const targetStatus = ACTION_TARGET[action];
        // FIX Bug #1: validar transición también para REJECT.
        // Antes, el `if (action !== "REJECT")` permitía rechazar desde cualquier estado.
        if (!TRANSITIONS[cut.status].includes(targetStatus)) {
          return {
            ok: false,
            error: `No se puede pasar de ${cut.status} a ${targetStatus}`,
          };
        }

        // FIX Bug #5: REJECT requiere motivo no vacío
        if (action === "REJECT" && !rejectionReason?.trim()) {
          return { ok: false, error: "El motivo del rechazo es obligatorio" };
        }

        const approval: WorkCutApproval = {
          id: nextId("wa"),
          action,
          userId: actor.id,
          userName: actor.name,
          userRole: actor.role,
          comments,
          createdAt: new Date().toISOString(),
        };

        const now = new Date().toISOString();
        const updates: Partial<WorkCut> = {
          status: targetStatus,
          approvals: [...cut.approvals, approval],
        };
        if (action === "SUBMIT") updates.submittedAt = now;
        if (action === "VALIDATE") updates.validatedAt = now;
        if (action === "APPROVE") updates.approvedAt = now;
        if (action === "PAY") updates.paidAt = now;
        if (action === "REJECT" && rejectionReason)
          updates.rejectionReason = rejectionReason;

        set({
          cuts: get().cuts.map((c) =>
            c.id === cutId ? { ...c, ...updates } : c,
          ),
        });
        return { ok: true };
      },
    }),
    { name: "controlobra-cuts" },
  ),
);

export const CUT_STATUS_LABELS: Record<WorkCutStatus, string> = {
  DRAFT: "Borrador",
  SUBMITTED: "Enviado",
  VALIDATED: "Validado",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  PAID: "Pagado",
};

export const CUT_STATUS_VARIANTS: Record<
  WorkCutStatus,
  "default" | "warning" | "info" | "success" | "destructive"
> = {
  DRAFT: "default",
  SUBMITTED: "warning",
  VALIDATED: "info",
  APPROVED: "success",
  REJECTED: "destructive",
  PAID: "success",
};

export const CUT_DOCUMENT_TYPE_LABELS: Record<WorkCutDocumentType, string> = {
  ACTA: "Acta",
  FACTURA: "Factura",
  SOPORTE: "Soporte",
  OTROS: "Otros",
};

export const ACTION_LABELS: Record<ApprovalAction, string> = {
  SUBMIT: "Enviado a validación",
  VALIDATE: "Validado",
  APPROVE: "Aprobado",
  REJECT: "Rechazado",
  PAY: "Pagado",
};

export const ACTION_BUTTONS: Record<WorkCutStatus, ApprovalAction[]> = {
  DRAFT: ["SUBMIT"],
  SUBMITTED: ["VALIDATE", "REJECT"],
  VALIDATED: ["APPROVE", "REJECT"],
  APPROVED: ["PAY"],
  REJECTED: ["SUBMIT"],
  PAID: [],
};

// Helper para el flujo de "volver a borrador" cuando se rechaza y se quiere re-editar
export interface ActionButton {
  action: ApprovalAction;
  label: string;
  variant: "default" | "destructive";
}

export function getAvailableActions(
  status: WorkCutStatus,
  userRole: string,
): ActionButton[] {
  const all = ACTION_BUTTONS[status] || [];
  return all
    .filter((a) => {
      // SUBMIT desde REJECTED es "reenviar", no aplica ROLE check estándar
      if (status === "REJECTED" && a === "SUBMIT") return true;
      return ACTION_ROLES[a].includes(userRole) || userRole === "ADMIN";
    })
    .map((a) => ({
      action: a,
      label:
        a === "SUBMIT"
          ? status === "REJECTED"
            ? "Reenviar"
            : "Guardar corte"
          : a === "VALIDATE"
            ? "Validar"
            : a === "APPROVE"
              ? "Aprobar (Super Admin)"
              : a === "REJECT"
                ? "Rechazar (Super Admin)"
                : "Marcar como pagado",
      variant: a === "REJECT" ? "destructive" : "default",
    }));
}
