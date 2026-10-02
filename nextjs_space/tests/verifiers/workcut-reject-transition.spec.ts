// VERIFIER: WorkCut REJECT Transition Validation
// SPEC: /docs/specs/workcut-reject-transition-validation.md
//
// El store sincrónico de localStorage (cuts-store.ts) ya no existe: el workflow
// vive en lib/cuts-workflow.ts y lo consume /api/cuts. Este verifier prueba la
// máquina de estados directamente, sin BD ni React.

import { describe, it, expect } from "vitest";
import {
  CUT_TRANSITIONS,
  evaluateCutAction,
  isCutTransitionAllowed,
} from "@/lib/cuts-workflow";
import type { WorkCutStatus } from "@/types";

const DIRECTOR = "DIRECTOR";

describe("Cuts workflow — validación de la transición REJECT", () => {
  describe("AC-1: REJECT no debe funcionar desde DRAFT", () => {
    it("rechaza la acción y explica la transición inválida", () => {
      const result = evaluateCutAction("DRAFT", "REJECT", DIRECTOR, {
        rejectionReason: "Faltan soportes",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("INVALID_TRANSITION");
        expect(result.error).toContain("DRAFT");
        expect(result.status).toBe(400);
      }
    });

    it("DRAFT solo admite SUBMITTED como destino", () => {
      expect(CUT_TRANSITIONS.DRAFT).toEqual(["SUBMITTED"]);
      expect(isCutTransitionAllowed("DRAFT", "REJECTED")).toBe(false);
    });
  });

  describe("AC-2: REJECT debe funcionar desde SUBMITTED", () => {
    it("devuelve ok con destino REJECTED", () => {
      const result = evaluateCutAction("SUBMITTED", "REJECT", DIRECTOR, {
        rejectionReason: "Cantidades no coinciden con el acta",
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.target).toBe("REJECTED");
    });
  });

  describe("AC-3: REJECT debe funcionar desde VALIDATED", () => {
    it("devuelve ok con destino REJECTED", () => {
      const result = evaluateCutAction("VALIDATED", "REJECT", DIRECTOR, {
        rejectionReason: "El director pide revisar precios unitarios",
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.target).toBe("REJECTED");
    });
  });

  describe("AC-4: REJECT no debe funcionar desde APPROVED / PAID", () => {
    it.each<WorkCutStatus>(["APPROVED", "PAID"])(
      "%s es terminal para REJECT",
      (status) => {
        const result = evaluateCutAction(status, "REJECT", DIRECTOR, {
          rejectionReason: "Motivo válido",
        });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.code).toBe("INVALID_TRANSITION");
      },
    );

    it("PAID no admite ninguna transición", () => {
      expect(CUT_TRANSITIONS.PAID).toEqual([]);
    });
  });

  describe("Edge Cases", () => {
    it("el actor debe tener un rol autorizado para rechazar", () => {
      const result = evaluateCutAction("SUBMITTED", "REJECT", "RESIDENTE", {
        rejectionReason: "Motivo válido",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("FORBIDDEN_ROLE");
        expect(result.status).toBe(403);
      }
    });

    it("el rol se valida antes que la transición", () => {
      // Un RESIDENTE rechazando un DRAFT falla por rol, no por transición.
      const result = evaluateCutAction("DRAFT", "REJECT", "RESIDENTE", {
        rejectionReason: "Motivo válido",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("FORBIDDEN_ROLE");
    });

    it("la matriz completa de transiciones está documentada", () => {
      // P2 (Fase 2.4): APPROVED ya no transiciona a PAID desde el
      // workflow del corte. La fuente de verdad del estado PAID es la
      // solicitud de pago (PATCH /api/payments con action=PAY), que
      // actualiza work_cuts.status en la misma transaccion. Asi no
      // hay dos acciones PAY independientes.
      expect(CUT_TRANSITIONS).toEqual({
        DRAFT: ["SUBMITTED"],
        SUBMITTED: ["VALIDATED", "REJECTED"],
        VALIDATED: ["APPROVED", "REJECTED"],
        APPROVED: [],
        REJECTED: ["SUBMITTED"],
        PAID: [],
      });
    });
  });

  // P0 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.1):
  //   Antes este caso fallaba con INVALID_TRANSITION. Con el fix, REJECTED
  //   admite SUBMIT (rol RESIDENTE/DIRECTOR/ADMIN) y vuelve a SUBMITTED.
  describe("AC-5: REJECTED puede reenviarse a SUBMITTED (fix P0)", () => {
    it.each(["RESIDENTE", "DIRECTOR", "ADMIN"] as const)(
      "rol %s puede hacer SUBMIT desde REJECTED",
      (role) => {
        const result = evaluateCutAction("REJECTED", "SUBMIT", role);
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.target).toBe("SUBMITTED");
      },
    );

    it("roles sin permiso para SUBMIT siguen bloqueados desde REJECTED", () => {
      const result = evaluateCutAction("REJECTED", "SUBMIT", "CONTABILIDAD");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("FORBIDDEN_ROLE");
    });
  });
});
