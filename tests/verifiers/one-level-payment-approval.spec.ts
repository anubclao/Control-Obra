// VERIFIER: One-Level Payment Approval
// SPEC: /docs/specs/one-level-payment-approval.md
//
// El store sincrónico payments-store.ts ya no existe: el workflow vive en
// lib/payments-workflow.ts y lo consume /api/payments.

import { describe, it, expect } from "vitest";
import {
  evaluatePaymentAction,
  isValidApprovalLevel,
  resolvePaymentTarget,
  type PaymentWorkflowState,
} from "@/lib/payments-workflow";

function pending(
  requiredApprovalLevel: number,
  over: Partial<PaymentWorkflowState> = {},
): PaymentWorkflowState {
  return {
    status: "PENDING",
    requiredApprovalLevel,
    currentApprovalLevel: 0,
    ...over,
  };
}

describe("Payments workflow — aprobación de un solo nivel", () => {
  describe("AC-1: con 1 nivel, PENDING → APPROVED en una sola aprobación", () => {
    it("APPROVE_L1 lleva a APPROVED, no a APPROVED_LEVEL_1", () => {
      const result = evaluatePaymentAction(pending(1), "APPROVE_L1", "DIRECTOR");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.target).toBe("APPROVED");
        expect(result.nextApprovalLevel).toBe(1);
        expect(result.approvalLevel).toBe(1);
      }
    });

    it("el estado APPROVED resultante permite PAY a Tesorería", () => {
      const result = evaluatePaymentAction(
        { status: "APPROVED", requiredApprovalLevel: 1, currentApprovalLevel: 1 },
        "PAY",
        "TESORERIA",
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.target).toBe("PAID");
    });

    it("ADMIN también puede ejecutar APPROVE_L1", () => {
      const result = evaluatePaymentAction(pending(1), "APPROVE_L1", "ADMIN");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.target).toBe("APPROVED");
    });
  });

  describe("AC-2: con 2 niveles el flujo mantiene los dos pasos", () => {
    it("APPROVE_L1 lleva a APPROVED_LEVEL_1", () => {
      const result = evaluatePaymentAction(pending(2), "APPROVE_L1", "DIRECTOR");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.target).toBe("APPROVED_LEVEL_1");
        expect(result.nextApprovalLevel).toBe(1);
      }
    });

    it("APPROVE_L2 desde APPROVED_LEVEL_1 lleva a APPROVED", () => {
      const result = evaluatePaymentAction(
        {
          status: "APPROVED_LEVEL_1",
          requiredApprovalLevel: 2,
          currentApprovalLevel: 1,
        },
        "APPROVE_L2",
        "GERENTE",
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.target).toBe("APPROVED");
        expect(result.nextApprovalLevel).toBe(2);
        expect(result.approvalLevel).toBe(2);
      }
    });

    it("defensivo: APPROVE_L2 sobre una solicitud de 1 nivel se rechaza", () => {
      const result = evaluatePaymentAction(
        {
          status: "APPROVED_LEVEL_1",
          requiredApprovalLevel: 1,
          currentApprovalLevel: 1,
        },
        "APPROVE_L2",
        "GERENTE",
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("SECOND_LEVEL_NOT_REQUIRED");
    });
  });

  describe("Edge Cases", () => {
    it("requiredApprovalLevel 0 o 4 es inválido", () => {
      expect(isValidApprovalLevel(0)).toBe(false);
      expect(isValidApprovalLevel(3)).toBe(false);
      expect(isValidApprovalLevel(4)).toBe(false);
      expect(isValidApprovalLevel(1)).toBe(true);
      expect(isValidApprovalLevel(2)).toBe(true);

      for (const level of [0, 4]) {
        const result = evaluatePaymentAction(
          pending(level),
          "APPROVE_L1",
          "DIRECTOR",
        );
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.code).toBe("INVALID_APPROVAL_LEVEL");
      }
    });

    it("APPROVE_L1 con currentApprovalLevel distinto de 0 se rechaza", () => {
      const result = evaluatePaymentAction(
        pending(2, { currentApprovalLevel: 1 }),
        "APPROVE_L1",
        "DIRECTOR",
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("ALREADY_APPROVED_L1");
    });

    it("solo DIRECTOR o ADMIN pueden aprobar nivel 1", () => {
      const result = evaluatePaymentAction(pending(1), "APPROVE_L1", "RESIDENTE");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("FORBIDDEN_ROLE");
        expect(result.status).toBe(403);
      }
    });

    it("REJECT exige motivo, igual que en cortes", () => {
      const sinMotivo = evaluatePaymentAction(pending(1), "REJECT", "GERENTE");
      expect(sinMotivo.ok).toBe(false);
      if (!sinMotivo.ok)
        expect(sinMotivo.code).toBe("REJECTION_REASON_REQUIRED");

      const conMotivo = evaluatePaymentAction(pending(1), "REJECT", "GERENTE", {
        rejectionReason: "Falta la factura del proveedor",
      });
      expect(conMotivo.ok).toBe(true);
    });

    it("PAID y REJECTED son terminales", () => {
      for (const status of ["PAID", "REJECTED"] as const) {
        const result = evaluatePaymentAction(
          { status, requiredApprovalLevel: 1, currentApprovalLevel: 1 },
          "PAY",
          "TESORERIA",
        );
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.code).toBe("INVALID_TRANSITION");
      }
    });

    it("resolvePaymentTarget refleja la regla de niveles", () => {
      expect(resolvePaymentTarget("APPROVE_L1", 1)).toBe("APPROVED");
      expect(resolvePaymentTarget("APPROVE_L1", 2)).toBe("APPROVED_LEVEL_1");
      expect(resolvePaymentTarget("APPROVE_L2", 2)).toBe("APPROVED");
      expect(resolvePaymentTarget("PAY", 1)).toBe("PAID");
      expect(resolvePaymentTarget("REJECT", 1)).toBe("REJECTED");
      expect(resolvePaymentTarget("CANCEL", 1)).toBe("CANCELLED");
    });
  });
});
