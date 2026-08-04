// VERIFIER: WorkCut REJECT Transition Validation
// STATUS: EXPECTED TO FAIL (RED PHASE) — hasta que el bug sea arreglado
// SPEC: /docs/specs/workcut-reject-transition-validation.md
// BUG FIX: #1 — REJECT desde DRAFT no estaba bloqueado

import { describe, it, expect, beforeEach } from "vitest";
import { useCutsStore } from "@/lib/cuts-store";

describe("useCutsStore — REJECT Transition Validation", () => {
  beforeEach(() => {
    useCutsStore.setState({
      cuts: useCutsStore.getInitialState().cuts,
    });
  });

  describe("Acceptance Criteria", () => {
    it("AC-1: REJECT desde DRAFT debe fallar", () => {
      // MOCK_WORK_CUTS incluye wc4 (status DRAFT)
      const draftCut = useCutsStore
        .getState()
        .cuts.find((c) => c.status === "DRAFT");
      expect(draftCut).toBeDefined();

      const result = useCutsStore
        .getState()
        .performAction(
          draftCut!.id,
          "REJECT",
          { id: "u-admin", name: "Admin", role: "ADMIN" },
          "Intento de rechazo",
        );

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
      // Estado NO debe cambiar
      const after = useCutsStore.getState().getCut(draftCut!.id);
      expect(after?.status).toBe("DRAFT");
    });

    it("AC-2: REJECT desde SUBMITTED debe funcionar", () => {
      // MOCK_WORK_CUTS incluye wc2 (status SUBMITTED)
      const submittedCut = useCutsStore
        .getState()
        .cuts.find((c) => c.status === "SUBMITTED");
      expect(submittedCut).toBeDefined();

      const result = useCutsStore
        .getState()
        .performAction(
          submittedCut!.id,
          "REJECT",
          { id: "u-admin", name: "Admin", role: "ADMIN" },
          undefined,
          "Faltan documentos",
        );

      expect(result.ok).toBe(true);
      const after = useCutsStore.getState().getCut(submittedCut!.id);
      expect(after?.status).toBe("REJECTED");
      expect(after?.rejectionReason).toBe("Faltan documentos");
      expect(after?.approvals.some((a) => a.action === "REJECT")).toBe(true);
    });

    it("AC-3: REJECT desde VALIDATED debe funcionar", () => {
      // MOCK_WORK_CUTS incluye wc3 (status VALIDATED)
      const validatedCut = useCutsStore
        .getState()
        .cuts.find((c) => c.status === "VALIDATED");
      expect(validatedCut).toBeDefined();

      const result = useCutsStore
        .getState()
        .performAction(
          validatedCut!.id,
          "REJECT",
          { id: "u-admin", name: "Admin", role: "ADMIN" },
          undefined,
          "Cantidades no coinciden con la obra",
        );

      expect(result.ok).toBe(true);
      const after = useCutsStore.getState().getCut(validatedCut!.id);
      expect(after?.status).toBe("REJECTED");
    });

    it("AC-4: REJECT desde APPROVED debe fallar (estado terminal)", () => {
      // MOCK_WORK_CUTS incluye wc1 (status APPROVED)
      const approvedCut = useCutsStore
        .getState()
        .cuts.find((c) => c.status === "APPROVED");
      expect(approvedCut).toBeDefined();

      const result = useCutsStore
        .getState()
        .performAction(
          approvedCut!.id,
          "REJECT",
          { id: "u-admin", name: "Admin", role: "ADMIN" },
          undefined,
          "Tarde",
        );

      expect(result.ok).toBe(false);
      const after = useCutsStore.getState().getCut(approvedCut!.id);
      expect(after?.status).toBe("APPROVED");
    });

    it("AC-4: REJECT desde PAID debe fallar (estado terminal)", () => {
      // Crear un corte y llevarlo hasta PAID
      const result = useCutsStore.getState().addCut(
        {
          projectId: "p1",
          providerId: "c1",
          description: "Test pago",
          periodStart: "2026-01-01",
          periodEnd: "2026-01-31",
          items: [
            {
              id: "i1",
              description: "Item test",
              unit: "M2",
              quantity: 10,
              unitPrice: 1000,
              totalPrice: 10000,
            },
          ],
          grossValue: 10000,
          retentionPercent: 0,
          retentionValue: 0,
          advanceDeduction: 0,
          netValue: 10000,
          status: "DRAFT",
          createdBy: "u-test",
        } as never,
        "PRY-2026-001",
      );

      // DRAFT → SUBMITTED → VALIDATED → APPROVED → PAID
      const admin = { id: "u-admin", name: "Admin", role: "ADMIN" as const };
      useCutsStore.getState().performAction(result.id, "SUBMIT", admin);
      useCutsStore.getState().performAction(result.id, "VALIDATE", admin);
      useCutsStore.getState().performAction(result.id, "APPROVE", admin);
      useCutsStore.getState().performAction(result.id, "PAY", {
        id: "u-tesor",
        name: "Tes",
        role: "TESORERIA",
      });

      const paid = useCutsStore.getState().getCut(result.id);
      expect(paid?.status).toBe("PAID");

      // Ahora intentar rechazar
      const rejectResult = useCutsStore
        .getState()
        .performAction(result.id, "REJECT", admin, undefined, "Tarde");
      expect(rejectResult.ok).toBe(false);
    });
  });
});
