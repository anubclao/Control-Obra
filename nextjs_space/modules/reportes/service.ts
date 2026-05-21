import { prisma } from "@/lib/db";

export interface FinancialReportFilters {
  projectId: string;
  startDate?: Date;
  endDate?: Date;
}

export async function getFinancialReport(filters: FinancialReportFilters) {
  const { projectId, startDate, endDate } = filters;

  const dateWhere = {
    ...(startDate && { gte: startDate }),
    ...(endDate && { lte: endDate }),
  };

  const [project, budget, paymentsSummary, cutsSummary] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, code: true, totalBudget: true, status: true },
    }),

    prisma.budget.findUnique({
      where: { projectId },
      select: {
        totalPC: true,
        totalPT: true,
        totalDirectCostPC: true,
        totalAIU_PC: true,
        aiuPercentage: true,
        adminPercentage: true,
        imprevistoPercentage: true,
        utilidadPercentage: true,
      },
    }),

    prisma.paymentRequest.groupBy({
      by: ["status", "paymentType"],
      where: {
        projectId,
        ...(Object.keys(dateWhere).length && { createdAt: dateWhere }),
      },
      _sum: { amount: true },
      _count: true,
    }),

    prisma.workCut.findMany({
      where: {
        projectId,
        status: "APPROVED",
        ...(Object.keys(dateWhere).length && { approvedAt: dateWhere }),
      },
      select: {
        cutNumber: true,
        requestedAmount: true,
        periodStart: true,
        periodEnd: true,
        approvedAt: true,
        contractor: { select: { name: true } },
      },
      orderBy: { cutNumber: "asc" },
    }),
  ]);

  if (!project) throw new Error("Proyecto no encontrado");

  const totalPaid = paymentsSummary
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + (p._sum.amount ?? 0), 0);

  const totalPending = paymentsSummary
    .filter((p) => ["PENDING", "APPROVED_LEVEL_1", "APPROVED_LEVEL_2", "APPROVED"].includes(p.status))
    .reduce((s, p) => s + (p._sum.amount ?? 0), 0);

  return {
    project,
    budget,
    financial: {
      totalPaid,
      totalPending,
      saldoDisponible: (budget?.totalPC ?? 0) - totalPaid - totalPending,
      executionPct: budget?.totalPC ? Math.round((totalPaid / budget.totalPC) * 100) : 0,
    },
    paymentsByType: paymentsSummary,
    approvedCuts: cutsSummary,
  };
}

export async function getDashboardStats() {
  const [
    projectsCount,
    contractorsCount,
    pendingCutsCount,
    pendingPaymentsCount,
    clientsCount,
    employeesCount,
    suppliersCount,
  ] = await Promise.all([
    prisma.project.count({ where: { status: { in: ["IN_PLANNING", "IN_EXECUTION"] } } }),
    prisma.contractor.count(),
    prisma.workCut.count({ where: { status: { in: ["PENDING", "IN_REVIEW"] } } }),
    prisma.paymentRequest.count({ where: { status: { in: ["PENDING", "APPROVED_LEVEL_1", "APPROVED_LEVEL_2"] } } }),
    prisma.client.count(),
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.supplier.count(),
  ]);

  return {
    projectsCount,
    contractorsCount,
    pendingCutsCount,
    pendingPaymentsCount,
    clientsCount,
    employeesCount,
    suppliersCount,
  };
}
