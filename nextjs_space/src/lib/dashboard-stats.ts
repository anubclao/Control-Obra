// Hook: useDashboardStats
// SPEC: /docs/specs/dashboard-stats-from-stores.md
// BUG FIX: #9 — Los dashboards usaban MOCK_* directo, no los stores
//
// Single Source of Truth: lee siempre desde los stores de Zustand
// para que los KPIs reflejen los cambios del usuario en tiempo real.

import { useMemo } from "react";
import { useProjectsStore } from "./projects-store";
import { useCutsStore } from "./cuts-store";
import { usePaymentsStore } from "./payments-store";
import { useClientsStore } from "./clients-store";
import { useQuotationsStore } from "./quotations-store";

export interface DashboardStats {
  // Técnicos
  activeProjects: number;
  totalBudget: number;
  totalExecuted: number;
  executionPercent: number;
  pendingCuts: number;
  // Administrativos
  pendingPayments: number;
  pendingAmount: number;
  totalExecutedAdmin: number;
  // Comerciales
  activeClients: number;
  openQuotations: number;
  totalOpenValue: number;
}

const EMPTY_STATS: DashboardStats = {
  activeProjects: 0,
  totalBudget: 0,
  totalExecuted: 0,
  executionPercent: 0,
  pendingCuts: 0,
  pendingPayments: 0,
  pendingAmount: 0,
  totalExecutedAdmin: 0,
  activeClients: 0,
  openQuotations: 0,
  totalOpenValue: 0,
};

export function useDashboardStats(): DashboardStats {
  // Selectores individuales para evitar re-renders innecesarios
  const projects = useProjectsStore((s) => s.projects);
  const cuts = useCutsStore((s) => s.cuts);
  const payments = usePaymentsStore((s) => s.payments);
  const clients = useClientsStore((s) => s.clients);
  const quotations = useQuotationsStore((s) => s.quotations);

  return useMemo<DashboardStats>(() => {
    try {
      // Técnicos
      const activeProjectsList = projects.filter(
        (p) => p.status === "IN_EXECUTION",
      );
      const totalBudget = projects.reduce(
        (sum, p) => sum + (p.totalBudget ?? 0),
        0,
      );
      const totalExecuted = projects.reduce(
        (sum, p) => sum + (p.executedAmount ?? 0),
        0,
      );
      const executionPercent =
        totalBudget > 0 ? (totalExecuted / totalBudget) * 100 : 0;
      const pendingCuts = cuts.filter((c) =>
        ["SUBMITTED", "VALIDATED"].includes(c.status),
      ).length;

      // Administrativos
      const pendingPaymentsList = payments.filter((p) =>
        ["PENDING", "APPROVED_LEVEL_1", "APPROVED_LEVEL_2"].includes(p.status),
      );
      const pendingAmount = pendingPaymentsList.reduce(
        (sum, p) => sum + (p.amount ?? 0),
        0,
      );

      // Comerciales
      const activeClients = clients.filter((c) => c.status === "WON").length;
      const openQuotations = quotations.filter((q) =>
        ["DRAFT", "SENT", "VIEWED"].includes(q.status),
      );
      const totalOpenValue = openQuotations.reduce(
        (sum, q) => sum + (q.total ?? 0),
        0,
      );

      return {
        activeProjects: activeProjectsList.length,
        totalBudget,
        totalExecuted,
        executionPercent,
        pendingCuts,
        pendingPayments: pendingPaymentsList.length,
        pendingAmount,
        totalExecutedAdmin: totalExecuted,
        activeClients,
        openQuotations: openQuotations.length,
        totalOpenValue,
      };
    } catch {
      // Si algún store falla, devolvemos valores en 0 sin crashear
      return EMPTY_STATS;
    }
  }, [projects, cuts, payments, clients, quotations]);
}
