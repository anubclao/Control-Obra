export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * GET /api/dashboard/stats — indicadores para los 3 dashboards.
 *
 * La agregación vive en lib/dashboard-stats-compute.ts (`computeDashboardStats`)
 * para que el verifier pueda probar los filtros de cada KPI sin levantar MySQL.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth, authFailureResponse } from "@/lib/api-auth";
import { computeDashboardStats } from "@/lib/dashboard-stats-compute";


export async function GET() {
  const auth = await requireAuth();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const [
      projects,
      cuts,
      payments,
      clients,
      quotations,
      employees,
      logs,
    ] = await Promise.all([
      query<any[]>(`SELECT status, total_budget, executed_amount FROM projects`),
      query<any[]>(`SELECT status FROM work_cuts`),
      query<any[]>(`SELECT status, amount FROM payment_requests`),
      query<any[]>(`SELECT status FROM clients`),
      query<any[]>(`SELECT status, total FROM quotations`),
      query<any[]>(`SELECT COUNT(*) AS n, status FROM employees GROUP BY status`),
      query<any[]>(`SELECT COUNT(*) AS n FROM work_logs WHERE date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`),
    ]);

    return NextResponse.json(
      computeDashboardStats({
        projects,
        cuts,
        payments,
        clients,
        quotations,
        employees,
        recentLogs: logs[0]?.n ?? 0,
      }),
    );
  } catch (e: any) {
    console.error("[dashboard/stats]", e?.code, e?.message);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
