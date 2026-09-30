/**
 * lib/payments-workflow.ts
 *
 * Máquina de estados del módulo PAGOS / TESORERÍA — función pura, sin BD ni React.
 *
 * Fuente única de verdad: la ruta /api/payments importa `evaluatePaymentAction`.
 *
 * Regla clave (AC-1 del spec): una solicitud con `requiredApprovalLevel === 1`
 * pasa de PENDING a APPROVED con una sola aprobación L1. Enviarla a
 * APPROVED_LEVEL_1 la dejaba bloqueada, porque el segundo nivel no existe.
 *
 * SPEC: docs/specs/one-level-payment-approval.md
 */

import type { PaymentAction, PaymentStatus } from "@/types";

export const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING: ["APPROVED_LEVEL_1", "APPROVED", "REJECTED", "CANCELLED"],
  APPROVED_LEVEL_1: ["APPROVED_LEVEL_2", "APPROVED", "REJECTED", "CANCELLED"],
  APPROVED_LEVEL_2: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["PAID", "CANCELLED"],
  REJECTED: [],
  PAID: [],
  CANCELLED: [],
};

export const PAYMENT_ACTION_ROLES: Record<PaymentAction, string[]> = {
  APPROVE_L1: ["DIRECTOR", "ADMIN"],
  APPROVE_L2: ["GERENTE", "ADMIN"],
  PAY: ["TESORERIA", "ADMIN"],
  REJECT: ["DIRECTOR", "GERENTE", "ADMIN"],
  CANCEL: ["TESORERIA", "ADMIN"],
};

/** Niveles de aprobación soportados hoy por el flujo. */
export const VALID_APPROVAL_LEVELS = [1, 2] as const;

export function isValidApprovalLevel(level: unknown): level is 1 | 2 {
  return level === 1 || level === 2;
}

export interface PaymentWorkflowState {
  status: PaymentStatus;
  /** Niveles de aprobación que exige la solicitud (1 o 2). */
  requiredApprovalLevel: number;
  /** Niveles ya aprobados (0 al crearse). */
  currentApprovalLevel: number;
}

export type PaymentActionErrorCode =
  | "UNKNOWN_ACTION"
  | "FORBIDDEN_ROLE"
  | "REJECTION_REASON_REQUIRED"
  | "INVALID_APPROVAL_LEVEL"
  | "ALREADY_APPROVED_L1"
  | "SECOND_LEVEL_NOT_REQUIRED"
  | "INVALID_TRANSITION";

/** Ver la nota de narrowing en lib/cuts-workflow.ts. */
export type PaymentActionResult =
  | {
      ok: true;
      target: PaymentStatus;
      /** Nivel que queda registrado tras la acción, o null si no aplica. */
      approvalLevel: number | null;
      /** Valor final de current_approval_level tras la acción. */
      nextApprovalLevel: number;
      code?: undefined;
      error?: undefined;
      status?: undefined;
    }
  | {
      ok: false;
      target?: undefined;
      approvalLevel?: undefined;
      nextApprovalLevel?: undefined;
      code: PaymentActionErrorCode;
      error: string;
      status: number;
    };

/**
 * Estado destino de una acción, considerando cuántos niveles exige la solicitud.
 * Con un solo nivel requerido, APPROVE_L1 salta directo a APPROVED.
 */
export function resolvePaymentTarget(
  action: PaymentAction,
  requiredApprovalLevel: number,
): PaymentStatus | undefined {
  switch (action) {
    case "APPROVE_L1":
      return requiredApprovalLevel === 1 ? "APPROVED" : "APPROVED_LEVEL_1";
    case "APPROVE_L2":
      return "APPROVED";
    case "PAY":
      return "PAID";
    case "REJECT":
      return "REJECTED";
    case "CANCEL":
      return "CANCELLED";
    default:
      return undefined;
  }
}

export function isPaymentTransitionAllowed(
  from: PaymentStatus,
  to: PaymentStatus,
): boolean {
  return (PAYMENT_TRANSITIONS[from] ?? []).includes(to);
}

/**
 * Valida una acción sobre una solicitud de pago.
 * Orden: acción conocida → rol → motivo de rechazo → nivel → transición.
 */
export function evaluatePaymentAction(
  state: PaymentWorkflowState,
  action: PaymentAction,
  userRole: string | undefined,
  opts: { rejectionReason?: string | null } = {},
): PaymentActionResult {
  if (!PAYMENT_ACTION_ROLES[action]) {
    return {
      ok: false,
      code: "UNKNOWN_ACTION",
      error: `Acción desconocida: ${action}`,
      status: 400,
    };
  }

  if (!userRole || !PAYMENT_ACTION_ROLES[action].includes(userRole)) {
    return {
      ok: false,
      code: "FORBIDDEN_ROLE",
      error: `Tu rol (${userRole ?? "sin rol"}) no puede ejecutar ${action}`,
      status: 403,
    };
  }

  if (action === "REJECT" && !opts.rejectionReason?.trim()) {
    return {
      ok: false,
      code: "REJECTION_REASON_REQUIRED",
      error: "El motivo del rechazo es obligatorio",
      status: 400,
    };
  }

  const isApproval = action === "APPROVE_L1" || action === "APPROVE_L2";

  if (isApproval && !isValidApprovalLevel(state.requiredApprovalLevel)) {
    return {
      ok: false,
      code: "INVALID_APPROVAL_LEVEL",
      error: `Nivel de aprobación requerido inválido: ${state.requiredApprovalLevel} (debe ser 1 o 2)`,
      status: 400,
    };
  }

  if (action === "APPROVE_L1" && state.currentApprovalLevel !== 0) {
    return {
      ok: false,
      code: "ALREADY_APPROVED_L1",
      error: "La solicitud ya tiene la aprobación de nivel 1",
      status: 400,
    };
  }

  // Defensivo: una solicitud de un solo nivel no admite segunda aprobación,
  // incluso si quedó en APPROVED_LEVEL_1 por datos heredados.
  if (action === "APPROVE_L2" && state.requiredApprovalLevel === 1) {
    return {
      ok: false,
      code: "SECOND_LEVEL_NOT_REQUIRED",
      error: "La solicitud solo requiere un nivel de aprobación",
      status: 400,
    };
  }

  const target = resolvePaymentTarget(action, state.requiredApprovalLevel);
  if (!target || !isPaymentTransitionAllowed(state.status, target)) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      error: `No se puede pasar de ${state.status} a ${target}`,
      status: 400,
    };
  }

  const approvalLevel =
    action === "APPROVE_L1" ? 1 : action === "APPROVE_L2" ? 2 : null;

  return {
    ok: true,
    target,
    approvalLevel,
    nextApprovalLevel: isApproval
      ? state.currentApprovalLevel + 1
      : state.currentApprovalLevel,
  };
}

/**
 * Una solicitud solo se edita mientras nadie la ha aprobado (igual que la UI).
 * SPEC: docs/specs/bug-cortes-pagos-integridad.md
 */
export function isPaymentEditable(status: PaymentStatus | string): boolean {
  return status === "PENDING";
}
