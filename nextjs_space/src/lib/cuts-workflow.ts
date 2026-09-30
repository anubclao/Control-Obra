/**
 * lib/cuts-workflow.ts
 *
 * Máquina de estados del módulo CORTES DE OBRA — función pura, sin BD ni React.
 *
 * Fuente única de verdad: la ruta /api/cuts importa `evaluateCutAction` en vez
 * de mantener su propia copia de las tablas. Así el verifier puede probar el
 * workflow completo sin levantar MySQL ni Next.
 *
 * SPEC: docs/specs/workcut-reject-transition-validation.md
 *       docs/specs/workcut-rejection-reason-required.md
 */

import type { ApprovalAction, WorkCutStatus } from "@/types";

export const CUT_TRANSITIONS: Record<WorkCutStatus, WorkCutStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["VALIDATED", "REJECTED"],
  VALIDATED: ["APPROVED", "REJECTED"],
  APPROVED: ["PAID"],
  REJECTED: ["DRAFT"],
  PAID: [],
};

export const CUT_ACTION_ROLES: Record<ApprovalAction, string[]> = {
  SUBMIT: ["RESIDENTE", "DIRECTOR", "ADMIN"],
  VALIDATE: ["DIRECTOR", "ADMIN"],
  APPROVE: ["ADMIN"],
  REJECT: ["ADMIN", "DIRECTOR", "GERENTE"],
  PAY: ["TESORERIA", "ADMIN"],
};

export const CUT_ACTION_TARGET: Record<ApprovalAction, WorkCutStatus> = {
  SUBMIT: "SUBMITTED",
  VALIDATE: "VALIDATED",
  APPROVE: "APPROVED",
  REJECT: "REJECTED",
  PAY: "PAID",
};

/** Códigos estables para que UI y tests no dependan del texto del mensaje. */
export type CutActionErrorCode =
  | "UNKNOWN_ACTION"
  | "FORBIDDEN_ROLE"
  | "REJECTION_REASON_REQUIRED"
  | "INVALID_TRANSITION";

/**
 * Los miembros declaran todos los campos (los ajenos como `undefined`) para que
 * el narrowing funcione tambien con `strictNullChecks: false`, que es como esta
 * hoy el tsconfig del proyecto.
 */
export type CutActionResult =
  | {
      ok: true;
      target: WorkCutStatus;
      code?: undefined;
      error?: undefined;
      status?: undefined;
    }
  | {
      ok: false;
      target?: undefined;
      code: CutActionErrorCode;
      error: string;
      /** Status HTTP sugerido para la ruta API. */
      status: number;
    };

export function isCutTransitionAllowed(
  from: WorkCutStatus,
  to: WorkCutStatus,
): boolean {
  return (CUT_TRANSITIONS[from] ?? []).includes(to);
}

/**
 * Valida una acción de aprobación sobre un corte.
 * Orden de validación: acción conocida → rol → motivo de rechazo → transición.
 */
export function evaluateCutAction(
  currentStatus: WorkCutStatus,
  action: ApprovalAction,
  userRole: string | undefined,
  opts: { rejectionReason?: string | null } = {},
): CutActionResult {
  const target = CUT_ACTION_TARGET[action];
  if (!target) {
    return {
      ok: false,
      code: "UNKNOWN_ACTION",
      error: `Acción desconocida: ${action}`,
      status: 400,
    };
  }

  const allowedRoles = CUT_ACTION_ROLES[action];
  if (!userRole || !allowedRoles.includes(userRole)) {
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

  if (!isCutTransitionAllowed(currentStatus, target)) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      error: `No se puede pasar de ${currentStatus} a ${target}`,
      status: 400,
    };
  }

  return { ok: true, target };
}

// =============================================================================
// Edición y totales — SPEC: docs/specs/bug-cortes-pagos-integridad.md
// =============================================================================

/** Estados en los que un corte todavía se puede editar (igual que la UI). */
export const CUT_EDITABLE_STATUSES: WorkCutStatus[] = ["DRAFT", "REJECTED"];

export function isCutEditable(status: WorkCutStatus | string): boolean {
  return (CUT_EDITABLE_STATUSES as string[]).includes(status);
}

export interface CutTotalsInput {
  quantity: number;
  unitPrice: number;
}

export interface CutTotals<T extends CutTotalsInput> {
  items: Array<T & { totalPrice: number }>;
  grossValue: number;
  retentionValue: number;
  netValue: number;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Única fórmula del valor de un corte. La usan el formulario (vista previa) y
 * la API (valor guardado), así el servidor nunca confía en los totales del
 * navegador.
 */
export function computeCutTotals<T extends CutTotalsInput>(
  items: T[],
  retentionPercent: number,
  advanceDeduction: number,
): CutTotals<T> {
  const withTotals = (items ?? []).map((it) => ({
    ...it,
    totalPrice: num(it.quantity) * num(it.unitPrice),
  }));
  const grossValue = withTotals.reduce((sum, it) => sum + it.totalPrice, 0);
  const retentionValue = Math.round(grossValue * (num(retentionPercent) / 100));
  const netValue = grossValue - retentionValue - num(advanceDeduction);
  return { items: withTotals, grossValue, retentionValue, netValue };
}
