/**
 * lib/clients-workflow.ts
 *
 * Máquina de estados del pipeline comercial (módulo CLIENTES).
 *
 * P1 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.1):
 *   La guía dice "solo se puede avanzar en el pipeline", pero el
 *   servidor aceptaba cualquier cambio de status. Aquí consolidamos:
 *     - El orden lineal de avance (PROSPECT -> CONTACTED -> ...
 *       -> WON).
 *     - Cualquier estado puede transicionar a LOST (con motivo).
 *     - LOST y WON son terminales (no se sale de ellos).
 *     - Retroceder requiere rol ADMIN (override).
 *
 * SPEC: docs/specs/workcut-reject-transition-validation.md (mismo
 *       patron que cuts-workflow.ts, aplicado al pipeline).
 */

import type { ClientStatus, Role } from "@/types";

/** Orden lineal de avance (indice = posicion en el pipeline). */
const PIPELINE_ORDER: ClientStatus[] = [
  "PROSPECT",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
];

/** Estados terminales: no se puede salir de ellos sin ADMIN. */
const TERMINAL_STATUSES: ClientStatus[] = ["WON", "LOST"];

export type ClientStageErrorCode =
  | "UNKNOWN_STATUS"
  | "REASON_REQUIRED"
  | "FORBIDDEN_REGRESSION"
  | "TERMINAL_STATE";

export type ClientStageResult =
  | {
      ok: true;
      target: ClientStatus;
      code?: undefined;
      error?: undefined;
      status?: undefined;
    }
  | {
      ok: false;
      target?: undefined;
      code: ClientStageErrorCode;
      error: string;
      status: number;
    };

/** Devuelve la lista de estados a los que se puede transicionar. */
export function nextClientStages(
  current: ClientStatus,
  userRole: Role | string | undefined,
): ClientStatus[] {
  // WON/LOST son terminales salvo override de ADMIN.
  if (TERMINAL_STATUSES.includes(current)) {
    return userRole === "ADMIN" ? [...PIPELINE_ORDER, "LOST"] : [];
  }
  const idx = PIPELINE_ORDER.indexOf(current);
  const forward: ClientStatus[] = [];
  if (idx >= 0 && idx < PIPELINE_ORDER.length - 1) {
    forward.push(PIPELINE_ORDER[idx + 1]);
  }
  // LOST siempre disponible mientras no sea terminal.
  forward.push("LOST");
  return forward;
}

/**
 * Valida un movimiento del pipeline.
 *
 * Reglas:
 *   - status conocido.
 *   - LOST requiere `reason` (motivo obligatorio).
 *   - Avanzar al siguiente estado: siempre OK.
 *   - Retroceder un estado: solo ADMIN.
 *   - Saltar mas de un estado hacia adelante: solo ADMIN.
 *   - Salir de WON/LOST: solo ADMIN.
 */
export function evaluateClientStage(
  from: ClientStatus,
  to: ClientStatus,
  userRole: Role | string | undefined,
  opts: { reason?: string | null } = {},
): ClientStageResult {
  if (!(PIPELINE_ORDER.includes(to) || to === "LOST")) {
    return {
      ok: false,
      code: "UNKNOWN_STATUS",
      error: `Estado destino desconocido: ${to}`,
      status: 400,
    };
  }
  if (to === "LOST" && !opts.reason?.trim()) {
    return {
      ok: false,
      code: "REASON_REQUIRED",
      error: "El motivo de pérdida es obligatorio",
      status: 400,
    };
  }

  const isAdmin = userRole === "ADMIN";
  const fromIdx = PIPELINE_ORDER.indexOf(from);
  const toIdx = PIPELINE_ORDER.indexOf(to);

  // Salir de un estado terminal requiere ADMIN.
  if (TERMINAL_STATUSES.includes(from) && !isAdmin) {
    return {
      ok: false,
      code: "TERMINAL_STATE",
      error: `No se puede salir de ${from} sin rol ADMIN`,
      status: 400,
    };
  }

  // Salto a LOST siempre OK (ya validamos reason arriba).
  if (to === "LOST") return { ok: true, target: to };

  // Mismo estado (no-op) -> OK silencioso.
  if (from === to) return { ok: true, target: to };

  // Saltar hacia adelante mas de un paso -> solo ADMIN.
  if (toIdx - fromIdx > 1 && !isAdmin) {
    return {
      ok: false,
      code: "FORBIDDEN_REGRESSION",
      error: `Solo ADMIN puede saltar etapas (de ${from} a ${to})`,
      status: 403,
    };
  }
  // Retroceder -> solo ADMIN.
  if (toIdx < fromIdx && !isAdmin) {
    return {
      ok: false,
      code: "FORBIDDEN_REGRESSION",
      error: `Solo ADMIN puede retroceder en el pipeline (de ${from} a ${to})`,
      status: 403,
    };
  }
  return { ok: true, target: to };
}
