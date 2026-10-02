// VERIFIER: WorkCut REJECT Requires Non-Empty Rejection Reason
// SPEC: /docs/specs/workcut-rejection-reason-required.md
//
// Prueba lib/cuts-workflow.ts, el módulo que consume /api/cuts.

import { describe, it, expect } from "vitest";
import { evaluateCutAction } from "@/lib/cuts-workflow";

const DIRECTOR = "DIRECTOR";

describe("Cuts workflow — motivo de rechazo obligatorio", () => {
  it("AC-1: REJECT sin rejectionReason es rechazado", () => {
    const result = evaluateCutAction("SUBMITTED", "REJECT", DIRECTOR);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("REJECTION_REASON_REQUIRED");
      expect(result.error).toBe("El motivo del rechazo es obligatorio");
      expect(result.status).toBe(400);
    }
  });

  it("AC-2: REJECT con rejectionReason solo whitespace da el mismo error", () => {
    for (const reason of ["", "   ", "\t", "\n  \n"]) {
      const result = evaluateCutAction("SUBMITTED", "REJECT", DIRECTOR, {
        rejectionReason: reason,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("REJECTION_REASON_REQUIRED");
    }
  });

  it("AC-2: rejectionReason null o undefined también falla", () => {
    for (const reason of [null, undefined]) {
      const result = evaluateCutAction("VALIDATED", "REJECT", DIRECTOR, {
        rejectionReason: reason,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("REJECTION_REASON_REQUIRED");
    }
  });

  it("AC-3: REJECT con rejectionReason válido pasa", () => {
    const result = evaluateCutAction("SUBMITTED", "REJECT", DIRECTOR, {
      rejectionReason: "Las cantidades del ítem 3 no coinciden con el acta",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.target).toBe("REJECTED");
  });

  describe("Edge Cases", () => {
    it("un carácter después de trim ya es válido", () => {
      const result = evaluateCutAction("SUBMITTED", "REJECT", DIRECTOR, {
        rejectionReason: "  x  ",
      });
      expect(result.ok).toBe(true);
    });

    it("las demás acciones no exigen motivo", () => {
      expect(evaluateCutAction("DRAFT", "SUBMIT", "RESIDENTE").ok).toBe(true);
      expect(evaluateCutAction("SUBMITTED", "VALIDATE", DIRECTOR).ok).toBe(
        true,
      );
      expect(evaluateCutAction("VALIDATED", "APPROVE", "ADMIN").ok).toBe(true);
      // P2 (Fase 2.4): la accion PAY del corte fue removida. La fuente
      // de verdad del estado PAID es la solicitud de pago. Cualquier
      // intento de PATCH /api/cuts con action=PAY ahora sera rechazado
      // por la maquina de estados con FORBIDDEN_ROLE (roles vacios) o
      // INVALID_TRANSITION (APPROVED ya no transiciona a PAID).
      expect(evaluateCutAction("APPROVED", "PAY", "TESORERIA").ok).toBe(false);
    });
  });
});
