export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * GET /api/dashboard/stats — indicadores para los 3 dashboards.
 *
 * La agregación vive en lib/dashboard-stats-compute.ts (`computeDashboardStats`)
 * para que el verifier pueda probar los filtros de cada KPI sin levantar MySQL.
 */
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { query } from "@/lib/db";
import { requireAuth, authFailureResponse } from "@/lib/api-auth";
import { computeDashboardStats } from "@/lib/dashboard-stats-compute";


export async function GET() {
  const auth = await requireAuth();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    // P0 plan 2026-10-02 (fix build): cada query con su propio fallback.
    // Antes, una sola query fallida (timeout, columna no existe en una BD
    // sin migrar, etc) colgaba el dashboard con loading=true para siempre.
    // Ahora, si una falla, devolvemos la query en [] y logueamos el error.
    const safe = async <T extends RowDataPacket = RowDataPacket>(
    label: string,
    sql: string,
    args: unknown[] = [],
  ): Promise<T[]> => {
      try {
        return await query<T[]>(sql, args);
      } catch (e: any) {
        console.warn(`[dashboard/stats] ${label} fallback ([]):`, e?.code, e?.message);
        return [];
      }
    };

    const [
      projects,
      cuts,
      payments,
      clients,
      quotations,
      employees,
      logs,
    ] = await Promise.all([
      safe<any>("projects",   `SELECT status, total_budget, executed_amount FROM projects`),
      safe<any>("cuts",       `SELECT status FROM work_cuts`),
      safe<any>("payments",   `SELECT status, amount FROM payment_requests`),
      safe<any>("clients",    `SELECT status FROM clients`),
      safe<any>("quotations", `SELECT status, total FROM quotations`),
      safe<any>("employees",  `SELECT COUNT(*) AS n, status FROM employees GROUP BY status`),
      safe<any>("logs",       `SELECT COUNT(*) AS n FROM work_logs WHERE date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`),
    ]);

    return NextResponse.json(
      computeDashboardStats({
        projects,
        cuts,
        payments,
        clients,
        quotations,
        employees,
        recentLogs: (logs as any[])[0]?.n ?? 0,
      }),
    );
  } catch (e: any) {
    console.error("[dashboard/stats]", e?.code, e?.message);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
