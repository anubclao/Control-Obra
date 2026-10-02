/**
 * lib/dashboard-stats-compute.ts
 *
 * Agregación pura de los KPIs de los tres dashboards (técnico, administrativo,
 * ventas): sin BD, sin React, sin fetch.
 *
 * Vive separado de `dashboard-stats.ts` porque ese archivo contiene el hook de
 * cliente, y una ruta de servidor no puede importar `useState`.
 *
 * Lo consumen /api/dashboard/stats y el verifier.
 *
 * SPEC: docs/specs/dashboard-stats-from-stores.md
 */

export interface DashboardStats {
  activeProjects: number;
  totalProjects: number;
  totalBudget: number;
  totalExecuted: number;
  executionPercent: number;
  pendingCuts: number;
  pendingPayments: number;
  pendingAmount: number;
  totalExecutedAdmin: number;
  activeClients: number;
  totalClients: number;
  openQuotations: number;
  totalOpenValue: number;
  activeEmployees: number;
  recentLogs: number;
}

export const EMPTY_DASHBOARD_STATS: DashboardStats = {
  activeProjects: 0, totalProjects: 0,
  totalBudget: 0, totalExecuted: 0, executionPercent: 0,
  pendingCuts: 0, pendingPayments: 0, pendingAmount: 0,
  totalExecutedAdmin: 0,
  activeClients: 0, totalClients: 0,
  openQuotations: 0, totalOpenValue: 0,
  activeEmployees: 0, recentLogs: 0,
};

// ---------------------------------------------------------------------------
// Filtros de estado que definen cada KPI (AC-1, AC-2, AC-3)
// ---------------------------------------------------------------------------

export const ACTIVE_PROJECT_STATUS = "IN_EXECUTION";
export const PENDING_CUT_STATUSES = ["SUBMITTED", "VALIDATED"] as const;
export const PENDING_PAYMENT_STATUSES = [
  "PENDING",
  "APPROVED_LEVEL_1",
  "APPROVED_LEVEL_2",
] as const;
export const WON_CLIENT_STATUS = "WON";
export const OPEN_QUOTATION_STATUSES = ["DRAFT", "SENT", "VIEWED"] as const;
export const ACTIVE_EMPLOYEE_STATUS = "ACTIVE";

// ---------------------------------------------------------------------------
// Agregación pura
// ---------------------------------------------------------------------------

export interface DashboardRows {
  projects: Array<{ status?: string | null; total_budget?: unknown; executed_amount?: unknown }>;
  cuts: Array<{ status?: string | null }>;
  payments: Array<{ status?: string | null; amount?: unknown }>;
  clients: Array<{ status?: string | null }>;
  quotations: Array<{ status?: string | null; total?: unknown }>;
  /** Filas agrupadas por status: { status, n }. */
  employees: Array<{ status?: string | null; n?: unknown }>;
  recentLogs: number;
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function sum<T>(rows: T[], pick: (row: T) => unknown): number {
  return rows.reduce((acc, row) => acc + num(pick(row)), 0);
}

/**
 * Consolida los KPIs a partir de filas crudas. Tolera listas vacías,
 * nulos y valores no numéricos devolviendo 0 en vez de NaN.
 */
export function computeDashboardStats(
  rows: Partial<DashboardRows> = {},
): DashboardStats {
  const projects = rows.projects ?? [];
  const cuts = rows.cuts ?? [];
  const payments = rows.payments ?? [];
  const clients = rows.clients ?? [];
  const quotations = rows.quotations ?? [];
  const employees = rows.employees ?? [];

  const totalBudget = sum(projects, (p) => p.total_budget);
  const totalExecuted = sum(projects, (p) => p.executed_amount);

  const pendingPayments = payments.filter((p) =>
    PENDING_PAYMENT_STATUSES.includes(p.status as never),
  );
  const openQuotations = quotations.filter((q) =>
    OPEN_QUOTATION_STATUSES.includes(q.status as never),
  );

  return {
    activeProjects: projects.filter((p) => p.status === ACTIVE_PROJECT_STATUS)
      .length,
    totalProjects: projects.length,
    totalBudget,
    totalExecuted,
    executionPercent: totalBudget > 0 ? (totalExecuted / totalBudget) * 100 : 0,
    pendingCuts: cuts.filter((c) =>
      PENDING_CUT_STATUSES.includes(c.status as never),
    ).length,
    pendingPayments: pendingPayments.length,
    pendingAmount: sum(pendingPayments, (p) => p.amount),
    totalExecutedAdmin: totalExecuted,
    activeClients: clients.filter((c) => c.status === WON_CLIENT_STATUS).length,
    totalClients: clients.length,
    openQuotations: openQuotations.length,
    totalOpenValue: sum(openQuotations, (q) => q.total),
    activeEmployees: sum(
      employees.filter((e) => e.status === ACTIVE_EMPLOYEE_STATUS),
      (e) => e.n,
    ),
    recentLogs: num(rows.recentLogs),
  };
}
