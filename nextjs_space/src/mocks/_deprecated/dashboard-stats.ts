// @deprecated — Esta función lee de MOCK_* directamente y no refleja los cambios de los stores.
// Usa `useDashboardStats()` desde `@/lib/dashboard-stats` en su lugar.
//
// Se mantiene por compatibilidad con código legacy pero no se debe usar en código nuevo.

import type {
  Project,
  WorkCut,
  Client,
  Quotation,
  PaymentRequest,
} from "@/types";
import { MOCK_PROJECTS } from "../projects";
import { MOCK_WORK_CUTS } from "../work-cuts";
import { MOCK_CLIENTS } from "../clients";
import { MOCK_QUOTATIONS } from "../quotations";
import { MOCK_PAYMENTS } from "../payments";

export function getDashboardStats() {
  const activeProjects = MOCK_PROJECTS.filter(
    (p) => p.status === "IN_EXECUTION",
  ).length;
  const totalBudget = MOCK_PROJECTS.reduce((sum, p) => sum + p.totalBudget, 0);
  const totalExecuted = MOCK_PROJECTS.reduce(
    (sum, p) => sum + p.executedAmount,
    0,
  );
  const pendingCuts = MOCK_WORK_CUTS.filter((c) =>
    ["SUBMITTED", "VALIDATED"].includes(c.status),
  ).length;
  const pendingPayments = MOCK_PAYMENTS.filter((p) =>
    ["PENDING", "APPROVED_LEVEL_1", "APPROVED_LEVEL_2"].includes(p.status),
  ).length;
  const activeClients = MOCK_CLIENTS.filter((c) => c.status === "WON").length;
  const openQuotations = MOCK_QUOTATIONS.filter((q) =>
    ["SENT", "VIEWED", "DRAFT"].includes(q.status),
  ).length;

  return {
    activeProjects,
    totalBudget,
    totalExecuted,
    executionPercent: totalBudget > 0 ? (totalExecuted / totalBudget) * 100 : 0,
    pendingCuts,
    pendingPayments,
    activeClients,
    openQuotations,
  };
}

// Re-exports para que @deprecated siga siendo self-contained
export type { Project, WorkCut, Client, Quotation, PaymentRequest };
