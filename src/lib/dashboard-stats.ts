/**
 * lib/dashboard-stats.ts
 *
 * Hook cliente de los KPIs del dashboard. Consume /api/dashboard/stats, que
 * agrega con `computeDashboardStats` de ./dashboard-stats-compute.
 *
 * Re-exporta la capa pura para que quien ya importaba desde aquí siga igual.
 *
 * SPEC: docs/specs/dashboard-stats-from-stores.md
 */
"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import {
  EMPTY_DASHBOARD_STATS,
  type DashboardStats,
} from "./dashboard-stats-compute";

export * from "./dashboard-stats-compute";

// ---------------------------------------------------------------------------
// Hook cliente
// ---------------------------------------------------------------------------

export function useDashboardStats(): { stats: DashboardStats; loading: boolean; error: string | null; reload: () => void } {
  const [stats, setStats] = useState<DashboardStats>(EMPTY_DASHBOARD_STATS);
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
          // Edge case del spec: ante error se conservan KPIs en cero, sin crash.
          setStats(EMPTY_DASHBOARD_STATS);
          setError(e?.message ?? "Error al cargar dashboard");
          setLoading(false);
        }
      });
    return () => { mounted = false; };
  }, [tick]);

  return { stats, loading, error, reload: () => setTick((n) => n + 1) };
}
