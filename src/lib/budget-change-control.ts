/**
 * lib/budget-change-control.ts
 *
 * Control de Cambios del presupuesto (CC-001, CC-002…) — funciones puras, sin
 * BD ni React. La ruta /api/budget-change-orders y la UI importan de aquí.
 *
 * Un CC trae SUS PROPIOS ítems (positivos = se agregan, negativos = se retiran
 * o descuentan) y se liquida con AIU + IVA sobre utilidad. Al aprobarse, su
 * costo directo se suma al Presupuesto Tope y al Presupuesto Cliente.
 *
 * SPEC: docs/specs/budget-change-control.md
 */

import type {
  BudgetChangeOrderItem,
  ChangeOrderAction,
  ChangeOrderStatus,
  ChangeRequestChannel,
} from "@/types";
import { computeAiu, type AiuPercents } from "./aiu-constants";

export const CHANGE_REQUEST_CHANNELS: ChangeRequestChannel[] = [
  "ACTA_COMITE",
  "MAIL",
  "SOLICITUD_VERBAL",
  "OTROS",
];

export const CHANGE_REQUEST_CHANNEL_LABELS: Record<ChangeRequestChannel, string> = {
  ACTA_COMITE: "Acta Comité",
  MAIL: "Mail",
  SOLICITUD_VERBAL: "Solicitud Verbal",
  OTROS: "Otros",
};

export const CHANGE_ORDER_STATUS_LABELS: Record<ChangeOrderStatus, string> = {
  DRAFT: "Borrador",
  SUBMITTED: "Enviado",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
};

/** Quién crea, edita, elimina y envía un CC. */
export const CHANGE_ORDER_EDITOR_ROLES = ["RESIDENTE", "DIRECTOR", "ADMIN"] as const;

export const CHANGE_ORDER_TRANSITIONS: Record<ChangeOrderStatus, ChangeOrderStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["APPROVED", "REJECTED"],
  REJECTED: ["SUBMITTED"],
  APPROVED: [],
};

export const CHANGE_ORDER_ACTION_ROLES: Record<ChangeOrderAction, string[]> = {
  SUBMIT: [...CHANGE_ORDER_EDITOR_ROLES],
  APPROVE: ["GERENTE", "ADMIN"],
  REJECT: ["GERENTE", "ADMIN"],
};

export const CHANGE_ORDER_ACTION_TARGET: Record<ChangeOrderAction, ChangeOrderStatus> = {
  SUBMIT: "SUBMITTED",
  APPROVE: "APPROVED",
  REJECT: "REJECTED",
};

export function formatChangeOrderNumber(seq: number): string {
  return `CC-${String(seq).padStart(3, "0")}`;
}

export function isChangeOrderEditable(status: ChangeOrderStatus | string): boolean {
  return status === "DRAFT" || status === "REJECTED";
}

// ─────────────────────────────── Cálculo ───────────────────────────────

export type ChangeOrderItemInput = Omit<BudgetChangeOrderItem, "totalPrice" | "id"> & {
  id?: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function computeChangeOrderTotals<T extends ChangeOrderItemInput>(
  items: T[],
  aiu: AiuPercents,
) {
  const priced = (items ?? []).map((it) => ({
    ...it,
    quantity: num(it.quantity),
    unitPrice: num(it.unitPrice),
    totalPrice: round2(num(it.quantity) * num(it.unitPrice)),
  }));
  const liquidation = computeAiu(
    priced.reduce((s, it) => s + it.totalPrice, 0),
    aiu,
  );
  const cd = liquidation.directCost;
  const pct = (v: number) => (cd === 0 ? 0 : (v / cd) * 100);

  const chapterTotals = new Map<string, number>();
  for (const it of priced) {
    const key = it.chapterCode ?? "";
    chapterTotals.set(key, (chapterTotals.get(key) ?? 0) + it.totalPrice);
  }

  return {
    items: priced.map((it) => ({ ...it, incidencePct: pct(it.totalPrice) })),
    chapters: [...chapterTotals].map(([chapterCode, total]) => ({
      chapterCode,
      total: round2(total),
      incidencePct: pct(total),
    })),
    ...liquidation,
  };
}

/** Al aprobar: el costo directo del CC se suma al Tope y al Cliente. */
export function applyChangeOrderToBudget(
  budget: { totalValue: number; clientValue: number },
  directCost: number,
) {
  return {
    totalValue: round2(num(budget.totalValue) + num(directCost)),
    clientValue: round2(num(budget.clientValue) + num(directCost)),
  };
}

// ────────────────────────────── Validación ──────────────────────────────

export type ChangeOrderInputErrorCode =
  | "INVALID_CHANNEL"
  | "CHANNEL_OTHER_REQUIRED"
  | "DESCRIPTION_REQUIRED"
  | "ITEMS_REQUIRED"
  | "INVALID_ITEM";

export function validateChangeOrderInput(input: {
  requestChannel?: unknown;
  requestChannelOther?: unknown;
  description?: unknown;
  items?: unknown;
}): { ok: true; code?: undefined; error?: undefined } | { ok: false; code: ChangeOrderInputErrorCode; error: string } {
  if (!CHANGE_REQUEST_CHANNELS.includes(input.requestChannel as ChangeRequestChannel)) {
    return { ok: false, code: "INVALID_CHANNEL", error: "Selecciona el medio por el cual se realizó la solicitud" };
  }
  if (input.requestChannel === "OTROS" && !String(input.requestChannelOther ?? "").trim()) {
    return { ok: false, code: "CHANNEL_OTHER_REQUIRED", error: "Indica cuál fue el otro medio de solicitud" };
  }
  if (!String(input.description ?? "").trim()) {
    return { ok: false, code: "DESCRIPTION_REQUIRED", error: "La descripción es obligatoria" };
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, code: "ITEMS_REQUIRED", error: "Agrega al menos un ítem" };
  }
  for (const [i, it] of (input.items as Array<Record<string, unknown>>).entries()) {
    const okNumbers = Number.isFinite(Number(it?.quantity)) && Number.isFinite(Number(it?.unitPrice));
    if (!String(it?.description ?? "").trim() || !okNumbers) {
      return { ok: false, code: "INVALID_ITEM", error: `El ítem ${i + 1} necesita descripción, cantidad y valor unitario` };
    }
  }
  return { ok: true };
}

// ─────────────────────────────── Workflow ───────────────────────────────

export type ChangeOrderActionErrorCode =
  | "UNKNOWN_ACTION"
  | "FORBIDDEN_ROLE"
  | "REJECTION_REASON_REQUIRED"
  | "INVALID_TRANSITION";

/** Mismo patrón que CutActionResult (narrowing con strictNullChecks: false). */
export type ChangeOrderActionResult =
  | { ok: true; target: ChangeOrderStatus; code?: undefined; error?: undefined; status?: undefined }
  | { ok: false; target?: undefined; code: ChangeOrderActionErrorCode; error: string; status: number };

/** Orden de validación: acción conocida → rol → motivo de rechazo → transición. */
export function evaluateChangeOrderAction(
  currentStatus: ChangeOrderStatus,
  action: ChangeOrderAction,
  userRole: string | undefined,
  opts: { rejectionReason?: string | null } = {},
): ChangeOrderActionResult {
  const target = CHANGE_ORDER_ACTION_TARGET[action];
  if (!target) {
    return { ok: false, code: "UNKNOWN_ACTION", error: `Acción desconocida: ${action}`, status: 400 };
  }
  if (!userRole || !CHANGE_ORDER_ACTION_ROLES[action].includes(userRole)) {
    return {
      ok: false,
      code: "FORBIDDEN_ROLE",
      error: `Tu rol (${userRole ?? "sin rol"}) no puede ejecutar ${action}`,
      status: 403,
    };
  }
  if (action === "REJECT" && !opts.rejectionReason?.trim()) {
    return { ok: false, code: "REJECTION_REASON_REQUIRED", error: "El motivo del rechazo es obligatorio", status: 400 };
  }
  if (!(CHANGE_ORDER_TRANSITIONS[currentStatus] ?? []).includes(target)) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      error: `No se puede pasar de ${currentStatus} a ${target}`,
      status: 400,
    };
  }
  return { ok: true, target };
}
