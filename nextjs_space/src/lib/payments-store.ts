"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  PaymentRequest,
  PaymentStatus,
  PaymentAction,
  PaymentApproval,
} from "@/types";
import { MOCK_PAYMENTS } from "@/mocks";

interface PaymentsStore {
  payments: PaymentRequest[];
  addPayment: (
    data: Omit<PaymentRequest, "id" | "requestNumber" | "approvals" | "status" | "currentApprovalLevel" | "createdAt">
  ) => PaymentRequest;
  updatePayment: (id: string, updates: Partial<PaymentRequest>) => void;
  deletePayment: (id: string) => void;
  getPayment: (id: string) => PaymentRequest | undefined;
  performAction: (
    id: string,
    action: PaymentAction,
    actor: { id: string; name: string; role: string },
    payload?: { comments?: string; rejectionReason?: string; paymentReference?: string; paymentMethod?: "TRANSFER" | "CHECK" | "CASH" }
  ) => { ok: boolean; error?: string };
}

function nextId(): string {
  return `pay${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

function nextRequestNumber(payments: PaymentRequest[]): string {
  const year = new Date().getFullYear();
  const sameYear = payments.filter((p) => p.requestNumber.startsWith(`PAG-${year}`));
  const next = sameYear.length + 1;
  return `PAG-${year}-${String(next).padStart(5, "0")}`;
}

const ACTION_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING: ["APPROVED_LEVEL_1", "REJECTED", "CANCELLED"],
  APPROVED_LEVEL_1: ["APPROVED_LEVEL_2", "REJECTED", "CANCELLED"],
  APPROVED_LEVEL_2: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["PAID", "CANCELLED"],
  REJECTED: [],
  PAID: [],
  CANCELLED: [],
};

const ACTION_STATUS_TARGET: Record<PaymentAction, PaymentStatus> = {
  APPROVE_L1: "APPROVED_LEVEL_1",
  APPROVE_L2: "APPROVED_LEVEL_2",
  PAY: "PAID",
  REJECT: "REJECTED",
  CANCEL: "CANCELLED",
};

const ACTION_LEVEL: Partial<Record<PaymentAction, 1 | 2>> = {
  APPROVE_L1: 1,
  APPROVE_L2: 2,
};

const ACTION_ROLES: Record<PaymentAction, string[]> = {
  APPROVE_L1: ["DIRECTOR", "ADMIN"],
  APPROVE_L2: ["GERENTE", "ADMIN"],
  PAY: ["TESORERIA", "ADMIN"],
  REJECT: ["DIRECTOR", "GERENTE", "ADMIN"],
  CANCEL: ["GERENTE", "ADMIN", "DIRECTOR"],
};

export const usePaymentsStore = create<PaymentsStore>()(
  persist(
    (set, get) => ({
      payments: MOCK_PAYMENTS,

      addPayment: (data) => {
        const payments = get().payments;
        const payment: PaymentRequest = {
          ...data,
          id: nextId(),
          requestNumber: nextRequestNumber(payments),
          approvals: [],
          status: "PENDING",
          currentApprovalLevel: 0,
          createdAt: new Date().toISOString().slice(0, 10),
        };
        set({ payments: [payment, ...payments] });
        return payment;
      },

      updatePayment: (id, updates) => {
        set({
          payments: get().payments.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        });
      },

      deletePayment: (id) => {
        set({ payments: get().payments.filter((p) => p.id !== id) });
      },

      getPayment: (id) => get().payments.find((p) => p.id === id),

      performAction: (id, action, actor, payload) => {
        const payment = get().getPayment(id);
        if (!payment) return { ok: false, error: "Solicitud no encontrada" };

        if (!ACTION_ROLES[action].includes(actor.role) && actor.role !== "ADMIN") {
          return { ok: false, error: `Tu rol (${actor.role}) no puede ${action.toLowerCase()}` };
        }

        const target = ACTION_STATUS_TARGET[action];
        if (!ACTION_TRANSITIONS[payment.status].includes(target)) {
          return { ok: false, error: `No se puede pasar de ${payment.status} a ${target}` };
        }

        // Reglas especiales:
        // APPROVE_L1 solo si currentApprovalLevel === 0
        // APPROVE_L2 solo si currentApprovalLevel === 1
        if (action === "APPROVE_L1" && payment.currentApprovalLevel !== 0) {
          return { ok: false, error: "Esta solicitud ya pasó el nivel 1" };
        }
        if (action === "APPROVE_L2" && payment.currentApprovalLevel !== 1) {
          return { ok: false, error: "Esta solicitud aún no tiene aprobación nivel 1" };
        }
        if (action === "PAY" && payment.status !== "APPROVED") {
          return { ok: false, error: "Solo se pagan solicitudes aprobadas" };
        }

        const approval: PaymentApproval = {
          id: nextId(),
          action,
          level: ACTION_LEVEL[action],
          userId: actor.id,
          userName: actor.name,
          userRole: actor.role,
          comments: payload?.comments,
          paymentReference: payload?.paymentReference,
          paymentMethod: payload?.paymentMethod,
          createdAt: new Date().toISOString(),
        };

        const updates: Partial<PaymentRequest> = {
          status: target,
          approvals: [...payment.approvals, approval],
        };

        if (action === "APPROVE_L1") {
          updates.currentApprovalLevel = 1;
        }
        if (action === "APPROVE_L2") {
          updates.currentApprovalLevel = 2;
          // Si el requiredLevel es 2, al pasar L2 ya queda "APPROVED" (final)
          if (payment.requiredApprovalLevel === 2) {
            updates.status = "APPROVED";
          }
        }
        if (action === "PAY") {
          updates.paidAt = new Date().toISOString();
          updates.paidReference = payload?.paymentReference;
          updates.paidMethod = payload?.paymentMethod;
        }
        if (action === "REJECT" && payload?.rejectionReason) {
          updates.rejectionReason = payload.rejectionReason;
        }

        set({ payments: get().payments.map((p) => (p.id === id ? { ...p, ...updates } : p)) });
        return { ok: true };
      },
    }),
    { name: "controlobra-payments" }
  )
);

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pendiente",
  APPROVED_LEVEL_1: "Aprobado N1",
  APPROVED_LEVEL_2: "Aprobado N2",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  PAID: "Pagado",
  CANCELLED: "Cancelado",
};

export const PAYMENT_STATUS_VARIANTS: Record<PaymentStatus, "default" | "warning" | "info" | "success" | "destructive"> = {
  PENDING: "warning",
  APPROVED_LEVEL_1: "info",
  APPROVED_LEVEL_2: "info",
  APPROVED: "success",
  REJECTED: "destructive",
  PAID: "success",
  CANCELLED: "default",
};

export const PAYMENT_TYPE_LABELS: Record<string, string> = {
  CORTE_OBRA: "Corte de obra",
  ANTICIPO: "Anticipo",
  RETENCION: "Retención",
  SUMINISTRO: "Suministro",
  SERVICIOS: "Servicios",
  HONORARIOS: "Honorarios",
  OTROS: "Otros",
};

export const PAYMENT_PRIORITY_LABELS: Record<string, string> = {
  LOW: "Baja",
  NORMAL: "Normal",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export const PAYMENT_PRIORITY_VARIANTS: Record<string, "default" | "info" | "warning" | "destructive"> = {
  LOW: "default",
  NORMAL: "info",
  HIGH: "warning",
  URGENT: "destructive",
};

export const PAYMENT_ACTION_LABELS: Record<PaymentAction, string> = {
  APPROVE_L1: "Aprobado nivel 1",
  APPROVE_L2: "Aprobado nivel 2",
  PAY: "Pagado",
  REJECT: "Rechazado",
  CANCEL: "Cancelado",
};

export interface PaymentActionButton {
  action: PaymentAction;
  label: string;
  variant: "default" | "destructive";
}

export function getAvailablePaymentActions(
  payment: PaymentRequest,
  userRole: string
): PaymentActionButton[] {
  const buttons: PaymentActionButton[] = [];

  if (payment.status === "PENDING" && userRole === "DIRECTOR") {
    buttons.push({ action: "APPROVE_L1", label: "Aprobar nivel 1", variant: "default" });
    buttons.push({ action: "REJECT", label: "Rechazar", variant: "destructive" });
  }

  if (payment.status === "APPROVED_LEVEL_1" && userRole === "GERENTE") {
    buttons.push({ action: "APPROVE_L2", label: "Aprobar nivel 2", variant: "default" });
    buttons.push({ action: "REJECT", label: "Rechazar", variant: "destructive" });
  }

  if (payment.status === "APPROVED" && userRole === "TESORERIA") {
    buttons.push({ action: "PAY", label: "Marcar como pagado", variant: "default" });
  }

  if (
    (payment.status === "PENDING" || payment.status === "APPROVED_LEVEL_1" || payment.status === "APPROVED_LEVEL_2") &&
    (userRole === "GERENTE" || userRole === "ADMIN")
  ) {
    buttons.push({ action: "CANCEL", label: "Cancelar", variant: "destructive" });
  }

  return buttons;
}
