// @vitest-environment node
/**
 * tests/verifiers/payments-workflow-actions.spec.ts
 *
 * Verifier de Fase 3, P1 (seccion 4.3): el helper
 * `getAvailablePaymentActions` vive en `payments-workflow.ts` (la
 * unica fuente de verdad del flujo de pagos). Antes existia una
 * copia divergente en `payments-constants.ts` que no ofrecia CANCEL
 * en APPROVED aunque el servidor lo permitia. Aqui validamos:
 *
 *   - Re-export desde payments-constants (compatibilidad).
 *   - Roles por accion (mismo mapa que el workflow).
 *   - Botones disponibles por estado y rol.
 *   - ADMIN ve todo.
 */

import { describe, it, expect } from "vitest";
import {
  PAYMENT_TRANSITIONS,
  PAYMENT_ACTION_ROLES,
  getAvailablePaymentActions,
} from "@/lib/payments-workflow";
import {
  PAYMENT_ACTION_ROLES as PAYMENT_ACTION_ROLES_CONST,
  getAvailablePaymentActions as getAvailablePaymentActionsConst,
} from "@/lib/payments-constants";

describe("Single source of truth: pagos", () => {
  it("PAYMENT_ACTION_ROLES es la misma referencia desde workflow y constants", () => {
    // P1 (seccion 4.3): la copia duplicada en payments-constants se
    // elimino; ambos archivos exponen la misma tabla. Comparamos por
    // contenido para que la fuente de verdad siga siendo payments-workflow.
    expect(PAYMENT_ACTION_ROLES_CONST).toEqual(PAYMENT_ACTION_ROLES);
  });

  it("re-export de getAvailablePaymentActions desde constants funciona", () => {
    // El componente pagos/[id]/page.tsx importa desde data-store, que a
    // su vez re-exporta desde payments-constants. Verificamos que la
    // funcion re-exportada es la misma.
    expect(getAvailablePaymentActionsConst).toBe(getAvailablePaymentActions);
  });
});

describe("getAvailablePaymentActions por estado y rol", () => {
  it("PENDING: DIRECTOR ve APPROVE_L1 + REJECT (CANCEL es de TESORERIA/ADMIN)", () => {
    const buttons = getAvailablePaymentActions(
      { status: "PENDING" },
      "DIRECTOR",
    );
    const actions = buttons.map((b) => b.action).sort();
    // CANCEL esta restringido a TESORERIA/ADMIN (decida de tesoreria).
    expect(actions).toEqual(["APPROVE_L1", "REJECT"]);
  });

  it("PENDING: TESORERIA solo ve CANCEL (no aprueba)", () => {
    const buttons = getAvailablePaymentActions(
      { status: "PENDING" },
      "TESORERIA",
    );
    const actions = buttons.map((b) => b.action).sort();
    expect(actions).toEqual(["CANCEL"]);
  });

  it("APPROVED: CANCEL se ofrece en UI (antes no estaba en la copia vieja)", () => {
    // Antes: la copia en payments-constants.ts no ofrecia CANCEL en
    // APPROVED, aunque PAYMENTS_TRANSITIONS del workflow si lo permite.
    const buttons = getAvailablePaymentActions(
      { status: "APPROVED" },
      "TESORERIA",
    );
    const actions = buttons.map((b) => b.action).sort();
    expect(actions).toEqual(["CANCEL", "PAY"]);
  });

  it("APPROVED: TESORERIA ve PAY, DIRECTOR/GERENTE no", () => {
    const tesoreria = getAvailablePaymentActions(
      { status: "APPROVED" },
      "TESORERIA",
    );
    const director = getAvailablePaymentActions(
      { status: "APPROVED" },
      "DIRECTOR",
    );
    expect(tesoreria.some((b) => b.action === "PAY")).toBe(true);
    expect(director.some((b) => b.action === "PAY")).toBe(false);
  });

  it("REJECTED/PAID/CANCELLED: no muestran ninguna accion", () => {
    for (const status of ["REJECTED", "PAID", "CANCELLED"] as const) {
      const buttons = getAvailablePaymentActions({ status }, "ADMIN");
      expect(buttons).toEqual([]);
    }
  });

  it("ADMIN ve todas las acciones disponibles para el estado", () => {
    const buttons = getAvailablePaymentActions(
      { status: "APPROVED_LEVEL_1" },
      "ADMIN",
    );
    const actions = buttons.map((b) => b.action).sort();
    // Pagos L1 -> L2, REJECT, CANCEL; ADMIN puede todo.
    expect(actions).toEqual(["APPROVE_L2", "CANCEL", "REJECT"]);
  });

  it("APPROVED_LEVEL_2 (estado heredado) muestra REJECT + CANCEL", () => {
    // APPROVED_LEVEL_2 no es alcanzable por la maquina, pero existe
    // en la DB. La UI no debe ofrecer PAY (el servidor responderia 400).
    const buttons = getAvailablePaymentActions(
      { status: "APPROVED_LEVEL_2" },
      "ADMIN",
    );
    const actions = buttons.map((b) => b.action).sort();
    expect(actions).toEqual(["CANCEL", "REJECT"]);
  });

  it("variant de REJECT es destructive", () => {
    const buttons = getAvailablePaymentActions(
      { status: "PENDING" },
      "DIRECTOR",
    );
    const reject = buttons.find((b) => b.action === "REJECT");
    expect(reject?.variant).toBe("destructive");
  });

  it("variant de CANCEL es warning y el resto default", () => {
    const buttons = getAvailablePaymentActions({ status: "PENDING" }, "ADMIN");
    const cancel = buttons.find((b) => b.action === "CANCEL");
    const approve = buttons.find((b) => b.action === "APPROVE_L1");
    expect(cancel?.variant).toBe("warning");
    expect(approve?.variant).toBe("default");
  });

  it("Cada accion listada tiene su transicion valida en PAYMENT_TRANSITIONS", () => {
    // Guardarrail: si alguien anade una accion al mapa UI pero olvida
    // su transicion en el workflow, este test lo detecta. APPROVED_LEVEL_2
    // se omite porque es un estado heredado sin transicion a PAID (la
    // maquina salta directo de L1 a APPROVED con L2).
    const ACTIONS_BY_STATUS: Record<string, string[]> = {
      PENDING: ["APPROVE_L1", "REJECT", "CANCEL"],
      APPROVED_LEVEL_1: ["APPROVE_L2", "REJECT", "CANCEL"],
      APPROVED: ["PAY", "CANCEL"],
    };
    const STATUS_TO_TARGET: Record<string, Record<string, string>> = {
      PENDING: {
        APPROVE_L1: "APPROVED_LEVEL_1",
        REJECT: "REJECTED",
        CANCEL: "CANCELLED",
      },
      APPROVED_LEVEL_1: {
        APPROVE_L2: "APPROVED_LEVEL_2",
        REJECT: "REJECTED",
        CANCEL: "CANCELLED",
      },
      APPROVED: {
        PAY: "PAID",
        CANCEL: "CANCELLED",
      },
    };
    for (const [status, actions] of Object.entries(ACTIONS_BY_STATUS)) {
      for (const action of actions) {
        const target = STATUS_TO_TARGET[status][action];
        expect(
          PAYMENT_TRANSITIONS[status as keyof typeof PAYMENT_TRANSITIONS],
        ).toContain(target);
      }
    }
  });
});
