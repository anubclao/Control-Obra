// Extraido de payments-store.ts (constantes + helpers)
import type { PaymentAction, PaymentStatus } from "@/types";

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pendiente",
  APPROVED_LEVEL_1: "Aprobado N1",
  APPROVED_LEVEL_2: "Aprobado N2",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  PAID: "Pagado",
  CANCELLED: "Cancelado",
};

export const PAYMENT_STATUS_VARIANTS: Record<
  PaymentStatus,
  "default" | "warning" | "info" | "success" | "destructive"
> = {
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

export const PAYMENT_PRIORITY_VARIANTS: Record<
  string,
  "default" | "info" | "warning" | "destructive"
> = {
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

// Determina que acciones puede tomar un usuario segun su rol
export interface PaymentActionButton {
  action: PaymentAction;
  label: string;
  variant: "default" | "info" | "warning" | "destructive";
}

const PAYMENT_ACTION_ROLES: Record<PaymentAction, string[]> = {
  APPROVE_L1: ["DIRECTOR", "ADMIN"],
  APPROVE_L2: ["GERENTE", "ADMIN"],
  PAY: ["TESORERIA", "ADMIN"],
  REJECT: ["DIRECTOR", "GERENTE", "ADMIN"],
  CANCEL: ["TESORERIA", "ADMIN"],
};

export function getAvailablePaymentActions(payment: any, userRole: string): PaymentActionButton[] {
  const status = payment.status as PaymentStatus;
  const options: Record<PaymentStatus, PaymentAction[]> = {
    PENDING: ["APPROVE_L1", "REJECT", "CANCEL"],
    APPROVED_LEVEL_1: ["APPROVE_L2", "REJECT", "CANCEL"],
    APPROVED_LEVEL_2: ["PAY", "REJECT", "CANCEL"],
    APPROVED: ["PAY"],
    REJECTED: [],
    PAID: [],
    CANCELLED: [],
  };
  const allowed = options[status] || [];
  return allowed
    .filter((a) => PAYMENT_ACTION_ROLES[a].includes(userRole) || userRole === "ADMIN")
    .map((a) => ({
      action: a,
      label: PAYMENT_ACTION_LABELS[a],
      variant: a === "REJECT" ? "destructive" : "default",
    }));
}
