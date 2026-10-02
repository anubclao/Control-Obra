/**
 * lib/quotations-workflow.ts
 *
 * Máquina de estados y recálculo de totales del módulo COMERCIAL /
 * COTIZACIONES.
 *
 * P1 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.1):
 *   Antes el servidor guardaba lo que mandaba el navegador (subtotal,
 *   discountAmount, ivaAmount, total) sin validar. Aqui centralizamos:
 *     1. `computeQuotationTotals()` recalcula todo en el servidor a
 *        partir de los `items` + `discountPercent` + `ivaPercent`.
 *     2. `evaluateQuotationAction()` valida las transiciones de
 *        estado (DRAFT -> SENT -> VIEWED -> ACCEPTED/REJECTED).
 *     3. `evaluateQuotationExpiry()` decide si una cotizacion paso a
 *        EXPIRED segun `valid_until < now`.
 *
 * Capa pura, sin BD ni React. El handler /api/quotations importa
 * estos helpers y aplica el resultado en la transaccion SQL.
 */

import type { QuotationStatus, Role } from "@/types";

// -----------------------------------------------------------------------------
// Transiciones permitidas
// -----------------------------------------------------------------------------

export const QUOTATION_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> =
  {
    // DRAFT: el vendedor prepara; puede pasar a SENT o CANCELLED.
    DRAFT: ["SENT", "CANCELLED"],
    // SENT: ya enviada al cliente; puede ser vista (VIEWED) o cancelada.
    SENT: ["VIEWED", "CANCELLED"],
    // VIEWED: el cliente la abrio; solo puede aceptarse o rechazarse.
    VIEWED: ["ACCEPTED", "REJECTED", "CANCELLED"],
    // ACCEPTED: contrato firmado (o en su defecto, conversion a proyecto);
    // solo cancelable por ADMIN (override).
    ACCEPTED: ["CANCELLED"],
    // REJECTED: estado terminal; nadie sale de aca.
    REJECTED: [],
    // EXPIRED: cron job la marco como vencida; se puede aceptar tarde
    // (override ADMIN) o cancelar.
    EXPIRED: ["CANCELLED", "ACCEPTED"],
    // CANCELLED: estado terminal.
    CANCELLED: [],
  };

/**
 * Roles que pueden ejecutar cada accion. El servidor valida esto
 * ademas del estado destino.
 */
export const QUOTATION_ACTION_ROLES: Record<QuotationStatus, Role[]> = {
  // DRAFT: estado origen; nadie "mueve a DRAFT" (es el inicial). La entrada
  // existe para satisfacer el tipo Record y nunca se consulta.
  DRAFT: [],
  // Pasar a SENT: vendedor (cualquier rol con create).
  SENT: [
    "ADMIN",
    "GERENTE",
    "DIRECTOR",
    "RESIDENTE",
    "CONTABILIDAD",
    "TESORERIA",
    "HSEQ",
  ],
  // VIEWED: lo marca el sistema cuando el cliente abre la cotizacion;
  // por ahora cualquier rol con create (futuro: link unico).
  VIEWED: [
    "ADMIN",
    "GERENTE",
    "DIRECTOR",
    "RESIDENTE",
    "CONTABILIDAD",
    "TESORERIA",
    "HSEQ",
  ],
  // ACCEPTED / REJECTED: vendedor o admin.
  ACCEPTED: ["ADMIN", "GERENTE", "DIRECTOR", "RESIDENTE", "CONTABILIDAD"],
  REJECTED: ["ADMIN", "GERENTE", "DIRECTOR", "RESIDENTE", "CONTABILIDAD"],
  // CANCELLED: solo admin, o el dueno si estaba en DRAFT.
  CANCELLED: ["ADMIN"],
  // EXPIRED: cron, no se ejecuta via API.
  EXPIRED: [],
};

export type QuotationActionErrorCode =
  | "UNKNOWN_TARGET"
  | "FORBIDDEN_ROLE"
  | "INVALID_TRANSITION"
  | "EXPIRED_NOT_ALLOWED";

export type QuotationActionResult =
  | {
      ok: true;
      target: QuotationStatus;
      code?: undefined;
      error?: undefined;
      status?: undefined;
    }
  | {
      ok: false;
      target?: undefined;
      code: QuotationActionErrorCode;
      error: string;
      status: number;
    };

export function evaluateQuotationAction(
  current: QuotationStatus,
  target: QuotationStatus,
  userRole: Role | string | undefined,
): QuotationActionResult {
  if (!QUOTATION_TRANSITIONS[current]) {
    return {
      ok: false,
      code: "UNKNOWN_TARGET",
      error: `Estado origen desconocido: ${current}`,
      status: 400,
    };
  }
  const allowedRoles = QUOTATION_ACTION_ROLES[target];
  if (!allowedRoles || allowedRoles.length === 0) {
    return {
      ok: false,
      code: "UNKNOWN_TARGET",
      error: `Accion destino desconocida: ${target}`,
      status: 400,
    };
  }
  if (!userRole || !allowedRoles.includes(userRole as Role)) {
    // Override: solo ADMIN puede saltar la lista de roles.
    if (userRole !== "ADMIN") {
      return {
        ok: false,
        code: "FORBIDDEN_ROLE",
        error: `Tu rol (${userRole ?? "sin rol"}) no puede mover a ${target}`,
        status: 403,
      };
    }
  }
  if (target === "EXPIRED") {
    // EXPIRED no es accionable por la UI; la pone el cron.
    return {
      ok: false,
      code: "EXPIRED_NOT_ALLOWED",
      error: "EXPIRED solo lo pone el sistema (cron)",
      status: 400,
    };
  }
  if (!QUOTATION_TRANSITIONS[current].includes(target)) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      error: `No se puede pasar de ${current} a ${target}`,
      status: 400,
    };
  }
  return { ok: true, target };
}

/**
 * Decide si una cotizacion debe pasar a EXPIRED. Es solo una funcion
 * pura; el caller es responsable de correrla (GET por lista, o un
 * cron). Devuelve true si `validUntil` es estrictamente anterior a
 * `now` y la cotizacion aun no esta en un estado terminal.
 */
export function evaluateQuotationExpiry(
  current: QuotationStatus,
  validUntil: string | Date,
  now: Date = new Date(),
): boolean {
  if (current !== "DRAFT" && current !== "SENT" && current !== "VIEWED") {
    return false;
  }
  // Si no hay fecha (null/undefined) NO expira: no tenemos con que
  // comparar. Antes `new Date(null)` daba 1970-01-01 y marcaba
  // TODO como expirado, que era incorrecto.
  if (validUntil === null || validUntil === undefined) return false;
  const until = validUntil instanceof Date ? validUntil : new Date(validUntil);
  if (Number.isNaN(until.getTime())) return false;
  return until.getTime() < now.getTime();
}

// -----------------------------------------------------------------------------
// Recalculo de totales
// -----------------------------------------------------------------------------

export interface QuotationItemInput {
  quantity: number;
  unitPrice: number;
}

export interface QuotationTotalsInput {
  items: QuotationItemInput[];
  /** Porcentaje de descuento global (0-100). */
  discountPercent: number;
  /** Porcentaje de IVA (0-100). Default 19. */
  ivaPercent: number;
}

export interface QuotationTotals {
  subtotal: number;
  discountAmount: number;
  ivaAmount: number;
  total: number;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Formula unica de los totales de una cotizacion. El navegador ya
 * no puede inflar el `total` porque el servidor lo recalcula con
 * sus propios items.
 *
 * Orden de operaciones (mismo patron que computeCutTotals):
 *   1. subtotal = sum(quantity * unitPrice) de cada item.
 *   2. discountAmount = subtotal * discountPercent / 100.
 *   3. ivaAmount = (subtotal - discountAmount) * ivaPercent / 100.
 *   4. total = subtotal - discountAmount + ivaAmount.
 *
 * Se redondea a entero para evitar decimales en las respuestas
 * (mismo criterio que computeCutTotals: `retentionValue`).
 */
export function computeQuotationTotals(
  input: QuotationTotalsInput,
): QuotationTotals {
  const items = input.items ?? [];
  const subtotal = items.reduce(
    (sum, it) => sum + num(it.quantity) * num(it.unitPrice),
    0,
  );
  const discountAmount = Math.round(
    subtotal * (num(input.discountPercent) / 100),
  );
  const ivaAmount = Math.round(
    (subtotal - discountAmount) * (num(input.ivaPercent) / 100),
  );
  const total = subtotal - discountAmount + ivaAmount;
  return { subtotal, discountAmount, ivaAmount, total };
}
