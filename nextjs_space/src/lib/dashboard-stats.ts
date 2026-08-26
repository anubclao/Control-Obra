/**
 * lib/dashboard-stats.ts — lee desde la BD vía /api/dashboard/stats
 */
import { useEffect, useState } from "react";
import { api } from "./api";

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

const EMPTY: DashboardStats = {
  activeProjects: 0, totalProjects: 0,
  totalBudget: 0, totalExecuted: 0, executionPercent: 0,
  pendingCuts: 0, pendingPayments: 0, pendingAmount: 0,
  totalExecutedAdmin: 0,
  activeClients: 0, totalClients: 0,
  openQuotations: 0, totalOpenValue: 0,
  activeEmployees: 0, recentLogs: 0,
};

export function useDashboardStats(): { stats: DashboardStats; loading: boolean; error: string | null; reload: () => void } {
  const [stats, setStats] = useState<DashboardStats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api
      .get<DashboardStats>("/api/dashboard/stats")
      .then((s) => { if (mounted) { setStats(s); setError(null); setLoading(false); } })
      .catch((e: any) => {
        if (mounted) {
          console.error("[dashboard stats]", e?.message);
          setError(e?.message ?? "Error al cargar dashboard");
          setLoading(false);
        }
      });
    return () => { mounted = false; };
  }, [tick]);

  return { stats, loading, error, reload: () => setTick((n) => n + 1) };
}
