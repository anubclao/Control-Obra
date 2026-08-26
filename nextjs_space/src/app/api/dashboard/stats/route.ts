/**
 * GET /api/dashboard/stats — indicadores para los 3 dashboards
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [
      projects,
      activeProjects,
      cuts,
      payments,
      clients,
      quotations,
      employees,
      logs,
    ] = await Promise.all([
      query<any[]>(`SELECT total_budget, executed_amount FROM projects`),
      query<any[]>(`SELECT COUNT(*) AS n FROM projects WHERE status = 'IN_EXECUTION'`),
      query<any[]>(`SELECT status FROM work_cuts`),
      query<any[]>(`SELECT status, amount FROM payment_requests`),
      query<any[]>(`SELECT status FROM clients`),
      query<any[]>(`SELECT status, total FROM quotations`),
      query<any[]>(`SELECT COUNT(*) AS n, status FROM employees GROUP BY status`),
      query<any[]>(`SELECT COUNT(*) AS n FROM work_logs WHERE date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`),
    ]);

    const totalBudget = projects.reduce((s, p) => s + Number(p.total_budget ?? 0), 0);
    const totalExecuted = projects.reduce((s, p) => s + Number(p.executed_amount ?? 0), 0);
    const executionPercent = totalBudget > 0 ? (totalExecuted / totalBudget) * 100 : 0;
    const pendingCuts = cuts.filter((c) => ["SUBMITTED", "VALIDATED"].includes(c.status)).length;
    const pendingPayments = payments.filter((p) =>
      ["PENDING", "APPROVED_LEVEL_1", "APPROVED_LEVEL_2"].includes(p.status));
    const pendingAmount = pendingPayments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const wonClients = clients.filter((c) => c.status === "WON").length;
    const openQuotes = quotations.filter((q) =>
      ["DRAFT", "SENT", "VIEWED"].includes(q.status));
    const totalOpenValue = openQuotes.reduce((s, q) => s + Number(q.total ?? 0), 0);
    const activeEmployees = employees
      .filter((e) => e.status === "ACTIVE")
      .reduce((acc, e) => acc + Number(e.n ?? 0), 0);

    return NextResponse.json({
      activeProjects: activeProjects[0]?.n ?? 0,
      totalProjects: projects.length,
      totalBudget,
      totalExecuted,
      executionPercent,
      pendingCuts,
      pendingPayments: pendingPayments.length,
      pendingAmount,
      totalExecutedAdmin: totalExecuted,
      activeClients: wonClients,
      totalClients: clients.length,
      openQuotations: openQuotes.length,
      totalOpenValue,
      activeEmployees,
      recentLogs: logs[0]?.n ?? 0,
    });
  } catch (e: any) {
    console.error("[dashboard/stats]", e?.code, e?.message);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
