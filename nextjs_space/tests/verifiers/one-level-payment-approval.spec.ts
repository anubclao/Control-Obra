// VERIFIER: One-Level Payment Approval
// STATUS: EXPECTED TO FAIL (RED PHASE) — hasta que el bug sea arreglado
// SPEC: /docs/specs/one-level-payment-approval.md
// BUG FIX: #2 — Solicitud con 1 nivel no llega a APPROVED

import { describe, it, expect, beforeEach } from "vitest";
import { usePaymentsStore } from "@/lib/payments-store";

describe("usePaymentsStore — One-Level Approval", () => {
  beforeEach(() => {
    // Reset a estado inicial (sin pagos personalizados)
    usePaymentsStore.setState({
      payments: usePaymentsStore.getInitialState().payments,
    });
  });

  describe("Acceptance Criteria", () => {
    it("AC-1: solicitud con requiredApprovalLevel=1 debe pasar a APPROVED tras APPROVE_L1", () => {
      const result = usePaymentsStore.getState().addPayment({
        projectId: "p1",
        providerId: "c1",
        type: "SUMINISTRO",
        amount: 1_000_000,
        priority: "NORMAL",
        requiredApprovalLevel: 1,
        beneficiaryName: "Proveedor Test",
        beneficiaryNit: "900.111.222-3",
        bankName: "Bancolombia",
        accountType: "CHECKING",
        accountNumber: "123-456789-00",
        createdBy: "u-test",
      });

      const actor = {
        id: "u-director",
        name: "Director Test",
        role: "DIRECTOR" as const,
      };
      const actionResult = usePaymentsStore
        .getState()
        .performAction(result.id, "APPROVE_L1", actor);

      expect(actionResult.ok).toBe(true);
      const updated = usePaymentsStore.getState().getPayment(result.id);
      expect(updated?.status).toBe("APPROVED");
      expect(updated?.currentApprovalLevel).toBe(1);
    });

    it("AC-2: solicitud con requiredApprovalLevel=2 debe pasar a APPROVED_LEVEL_1 tras APPROVE_L1 (no terminal)", () => {
      const result = usePaymentsStore.getState().addPayment({
        projectId: "p1",
        providerId: "c1",
        type: "SUMINISTRO",
        amount: 1_000_000,
        priority: "NORMAL",
        requiredApprovalLevel: 2,
        beneficiaryName: "Proveedor Test",
        beneficiaryNit: "900.111.222-3",
        bankName: "Bancolombia",
        accountType: "CHECKING",
        accountNumber: "123-456789-00",
        createdBy: "u-test",
      });

      const actor = {
        id: "u-director",
        name: "Director Test",
        role: "DIRECTOR" as const,
      };
      const actionResult = usePaymentsStore
        .getState()
        .performAction(result.id, "APPROVE_L1", actor);

      expect(actionResult.ok).toBe(true);
      const updated = usePaymentsStore.getState().getPayment(result.id);
      expect(updated?.status).toBe("APPROVED_LEVEL_1");
      expect(updated?.currentApprovalLevel).toBe(1);
    });

    it("AC-2: solicitud con requiredApprovalLevel=2 debe pasar a APPROVED tras APPROVE_L2", () => {
      const result = usePaymentsStore.getState().addPayment({
        projectId: "p1",
        providerId: "c1",
        type: "SUMINISTRO",
        amount: 1_000_000,
        priority: "NORMAL",
        requiredApprovalLevel: 2,
        beneficiaryName: "Proveedor Test",
        beneficiaryNit: "900.111.222-3",
        bankName: "Bancolombia",
        accountType: "CHECKING",
        accountNumber: "123-456789-00",
        createdBy: "u-test",
      });

      const director = {
        id: "u-director",
        name: "Director",
        role: "DIRECTOR" as const,
      };
      const gerente = {
        id: "u-gerente",
        name: "Gerente",
        role: "GERENTE" as const,
      };

      usePaymentsStore
        .getState()
        .performAction(result.id, "APPROVE_L1", director);
      const actionResult = usePaymentsStore
        .getState()
        .performAction(result.id, "APPROVE_L2", gerente);

      expect(actionResult.ok).toBe(true);
      const updated = usePaymentsStore.getState().getPayment(result.id);
      expect(updated?.status).toBe("APPROVED");
      expect(updated?.currentApprovalLevel).toBe(2);
    });

    it("AC-3: getAvailablePaymentActions debe mostrar PAY para status=APPROVED de 1 nivel", async () => {
      const { getAvailablePaymentActions } =
        await import("@/lib/payments-store");

      const result = usePaymentsStore.getState().addPayment({
        projectId: "p1",
        providerId: "c1",
        type: "SUMINISTRO",
        amount: 1_000_000,
        priority: "NORMAL",
        requiredApprovalLevel: 1,
        beneficiaryName: "Proveedor Test",
        beneficiaryNit: "900.111.222-3",
        bankName: "Bancolombia",
        accountType: "CHECKING",
        accountNumber: "123-456789-00",
        createdBy: "u-test",
      });

      const director = {
        id: "u-director",
        name: "Director",
        role: "DIRECTOR" as const,
      };
      usePaymentsStore
        .getState()
        .performAction(result.id, "APPROVE_L1", director);

      const updated = usePaymentsStore.getState().getPayment(result.id);
      expect(updated?.status).toBe("APPROVED");

      const actions = getAvailablePaymentActions(updated!, "TESORERIA");
      const hasPayAction = actions.some((a) => a.action === "PAY");
      expect(hasPayAction).toBe(true);
    });

    it("AC-3 (regresión): getAvailablePaymentActions también debe mostrar PAY para APPROVED de 2 niveles", async () => {
      const { getAvailablePaymentActions } =
        await import("@/lib/payments-store");

      const result = usePaymentsStore.getState().addPayment({
        projectId: "p1",
        providerId: "c1",
        type: "SUMINISTRO",
        amount: 1_000_000,
        priority: "NORMAL",
        requiredApprovalLevel: 2,
        beneficiaryName: "Proveedor Test",
        beneficiaryNit: "900.111.222-3",
        bankName: "Bancolombia",
        accountType: "CHECKING",
        accountNumber: "123-456789-00",
        createdBy: "u-test",
      });

      const director = {
        id: "u-director",
        name: "Director",
        role: "DIRECTOR" as const,
      };
      const gerente = {
        id: "u-gerente",
        name: "Gerente",
        role: "GERENTE" as const,
      };
      usePaymentsStore
        .getState()
        .performAction(result.id, "APPROVE_L1", director);
      usePaymentsStore
        .getState()
        .performAction(result.id, "APPROVE_L2", gerente);

      const updated = usePaymentsStore.getState().getPayment(result.id);
      expect(updated?.status).toBe("APPROVED");

      const actions = getAvailablePaymentActions(updated!, "TESORERIA");
      expect(actions.some((a) => a.action === "PAY")).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("debe rechazar APPROVE_L1 si currentApprovalLevel no es 0", () => {
      const result = usePaymentsStore.getState().addPayment({
        projectId: "p1",
        providerId: "c1",
        type: "SUMINISTRO",
        amount: 1_000_000,
        priority: "NORMAL",
        requiredApprovalLevel: 1,
        beneficiaryName: "Proveedor Test",
        beneficiaryNit: "900.111.222-3",
        bankName: "Bancolombia",
        accountType: "CHECKING",
        accountNumber: "123-456789-00",
        createdBy: "u-test",
      });

      const director = {
        id: "u-director",
        name: "Director",
        role: "DIRECTOR" as const,
      };
      usePaymentsStore
        .getState()
        .performAction(result.id, "APPROVE_L1", director);

      // Segundo intento de APPROVE_L1 debe fallar (status ya es APPROVED, no PENDING)
      const secondAttempt = usePaymentsStore
        .getState()
        .performAction(result.id, "APPROVE_L1", director);

      expect(secondAttempt.ok).toBe(false);
    });
  });
});
