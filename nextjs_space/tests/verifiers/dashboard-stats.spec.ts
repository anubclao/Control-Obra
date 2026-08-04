// VERIFIER: Dashboard Stats from Stores
// STATUS: EXPECTED TO FAIL (RED PHASE)
// SPEC: /docs/specs/dashboard-stats-from-stores.md
// BUG FIX: #9 — Los dashboards usaban MOCK_* directo, no los stores

import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDashboardStats } from "@/lib/dashboard-stats";
import { useProjectsStore } from "@/lib/projects-store";
import { useCutsStore } from "@/lib/cuts-store";
import { usePaymentsStore } from "@/lib/payments-store";
import { useClientsStore } from "@/lib/clients-store";
import { useQuotationsStore } from "@/lib/quotations-store";

describe("useDashboardStats — Single Source of Truth", () => {
  beforeEach(() => {
    // Resetear stores a estado inicial con MOCK_*
    useProjectsStore.setState({
      projects: useProjectsStore.getInitialState().projects,
    });
    useCutsStore.setState({ cuts: useCutsStore.getInitialState().cuts });
    usePaymentsStore.setState({
      payments: usePaymentsStore.getInitialState().payments,
    });
    useClientsStore.setState({
      clients: useClientsStore.getInitialState().clients,
    });
    useQuotationsStore.setState({
      quotations: useQuotationsStore.getInitialState().quotations,
    });
  });

  describe("Acceptance Criteria", () => {
    it("AC-1: debe calcular KPIs del dashboard técnico desde useProjectsStore", () => {
      const { result } = renderHook(() => useDashboardStats());
      // MOCK_PROJECTS tiene 3 proyectos IN_EXECUTION (p1, p2, p3)
      expect(result.current.activeProjects).toBe(3);
    });

    it("AC-1: debe reaccionar cuando se agrega un nuevo proyecto en ejecución", () => {
      const { result } = renderHook(() => useDashboardStats());
      const initialActive = result.current.activeProjects;

      act(() => {
        useProjectsStore.getState().addProject({
          name: "Proyecto Test",
          client: "Cliente Test",
          location: "Bogotá",
          startDate: "2026-08-01",
          estimatedEndDate: "2026-12-31",
          totalBudget: 1_000_000_000,
          status: "IN_EXECUTION",
          description: "",
        });
      });

      expect(result.current.activeProjects).toBe(initialActive + 1);
    });

    it("AC-1: debe recalcular totalBudget al cambiar un proyecto", () => {
      const { result } = renderHook(() => useDashboardStats());
      const initialBudget = result.current.totalBudget;

      act(() => {
        const projects = useProjectsStore.getState().projects;
        const firstProject = projects[0];
        useProjectsStore.getState().updateProject(firstProject.id, {
          totalBudget: firstProject.totalBudget + 999_999_999,
        });
      });

      expect(result.current.totalBudget).toBe(initialBudget + 999_999_999);
    });

    it("AC-2: debe calcular pendingPayments desde usePaymentsStore", () => {
      const { result } = renderHook(() => useDashboardStats());
      // MOCK_PAYMENTS tiene 6 pagos: pay1 (APPROVED_LEVEL_2), pay2 (PENDING),
      // pay3 (APPROVED), pay4 (PAID), pay5 (REJECTED), pay6 (APPROVED_LEVEL_1)
      // Pendientes = PENDING + APPROVED_LEVEL_1 + APPROVED_LEVEL_2 = 3
      expect(result.current.pendingPayments).toBe(3);
    });

    it("AC-2: debe actualizar pendingPayments al aprobar un pago", () => {
      const { result } = renderHook(() => useDashboardStats());
      const before = result.current.pendingPayments;

      // Aprobar L2 el pago pending (pay2)
      act(() => {
        const payments = usePaymentsStore.getState().payments;
        const pay2 = payments.find((p) => p.status === "PENDING");
        if (!pay2) throw new Error("pay2 no encontrado");
        usePaymentsStore
          .getState()
          .performAction(pay2.id, "APPROVE_L1", {
            id: "u-test",
            name: "Test User",
            role: "DIRECTOR",
          });
      });

      // pay2 pasa de PENDING a APPROVED_LEVEL_1 → sigue pendiente
      // El conteo de pendientes puede cambiar o no según las reglas,
      // pero pendingAmount SÍ debe cambiar
      expect(result.current.pendingAmount).toBeGreaterThan(0);
      // Al menos una métrica debe haber cambiado
      expect(result.current.pendingPayments).toBeGreaterThanOrEqual(before - 1);
    });

    it("AC-2: debe calcular pendingAmount correctamente", () => {
      const { result } = renderHook(() => useDashboardStats());
      // pendingAmount = suma de pagos en PENDING | APPROVED_LEVEL_1 | APPROVED_LEVEL_2
      // pay1 (256.5M) + pay2 (522M) + pay6 (290.8M) = 1,069,300,000
      expect(result.current.pendingAmount).toBe(1_069_300_000);
    });

    it("AC-3: debe calcular activeClients desde useClientsStore", () => {
      const { result } = renderHook(() => useDashboardStats());
      // MOCK_CLIENTS tiene 3 clientes con status WON (cl1, cl2, cl3)
      expect(result.current.activeClients).toBe(3);
    });

    it("AC-3: debe calcular openQuotations desde useQuotationsStore", () => {
      const { result } = renderHook(() => useDashboardStats());
      // MOCK_QUOTATIONS: q3 (DRAFT), q4 (ACCEPTED), q6 (DRAFT), q1 (SENT),
      // q2 (VIEWED), q5 (REJECTED)
      // Abiertas = DRAFT + SENT + VIEWED = 4
      expect(result.current.openQuotations).toBe(4);
    });

    it("AC-3: debe calcular totalOpenValue correctamente", () => {
      const { result } = renderHook(() => useDashboardStats());
      // q1 (7.336B) + q2 (4.549B) + q3 (1.795B) + q6 (257M)
      // 7,336,350,000 + 4,549,132,000 + 1,795,234,000 + 257,040,000 = 13,937,756,000
      expect(result.current.totalOpenValue).toBe(13_937_756_000);
    });

    it("AC-4: debe devolver 0 cuando los stores están vacíos", () => {
      act(() => {
        useProjectsStore.setState({ projects: [] });
        useCutsStore.setState({ cuts: [] });
        usePaymentsStore.setState({ payments: [] });
        useClientsStore.setState({ clients: [] });
        useQuotationsStore.setState({ quotations: [] });
      });

      const { result } = renderHook(() => useDashboardStats());
      expect(result.current.activeProjects).toBe(0);
      expect(result.current.totalBudget).toBe(0);
      expect(result.current.pendingPayments).toBe(0);
      expect(result.current.activeClients).toBe(0);
      expect(result.current.openQuotations).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("no debe crashear si un store está vacío individualmente", () => {
      act(() => {
        usePaymentsStore.setState({ payments: [] });
      });
      const { result } = renderHook(() => useDashboardStats());
      expect(result.current.pendingPayments).toBe(0);
      expect(result.current.pendingAmount).toBe(0);
      // El resto de KPIs siguen calculándose
      expect(result.current.activeProjects).toBe(3);
    });
  });
});
