import { prisma } from '@/lib/db';
import { mapWithConcurrency } from '@/lib/concurrency';
import { getOrSetRuntimeCache, clearRuntimeCache } from '@/lib/runtime-cache';
import { createLogger } from '@/lib/logging';

export const FINANCIAL_REPORT_TTL_MS = Number(process.env.FINANCIAL_REPORT_TTL_MS ?? 30000);
export const FINANCIAL_REPORT_CONCURRENCY = Math.max(
  1,
  Number(process.env.FINANCIAL_REPORT_CONCURRENCY ?? 4)
);

const logger = createLogger('FinancialReportService');

export async function fetchProjectsForReport(projectId: string | null) {
  const whereProject = projectId ? { id: projectId } : {};

  return prisma.project.findMany({
    where: whereProject,
    select: {
      id: true,
      code: true,
      name: true,
      client: true,
      status: true,
      startDate: true,
      estimatedEndDate: true,
      totalBudget: true,
      budget: {
        select: {
          totalPC: true,
          totalPT: true,
          aiuPercentage: true,
          totalDirectCostPC: true,
          totalDirectCostPT: true,
          totalAIU_PC: true,
          totalAIU_PT: true,
          layers: {
            select: {
              code: true,
              name: true,
              totalDirectCostPC: true,
              totalDirectCostPT: true,
              items: { select: { id: true } },
            },
          },
        },
      },
      costCenters: { select: { spentAmount: true } },
      workCuts: {
        where: { status: 'APPROVED' },
        select: { requestedAmount: true },
      },
      contracts: {
        where: { status: { in: ['ENABLED', 'CLOSED'] } },
        select: { contractValue: true },
      },
      paymentRequests: {
        where: { status: 'PAID' },
        select: { amount: true },
      },
      taxConfigs: {
        where: { isActive: true },
        select: { name: true, type: true, rate: true, appliesTo: true },
      },
    },
  });
}

export async function buildFinancialReport(projectId: string | null) {
  const startTime = Date.now();
  logger.info('build_report_start', { projectId }, 'Starting financial report build');

  try {
    const projects = await fetchProjectsForReport(projectId);
    logger.debug('build_report_fetch_complete', { projectId, count: projects.length }, 
      `Fetched ${projects.length} projects`);

    const financialReports = await mapWithConcurrency(
      projects,
      FINANCIAL_REPORT_CONCURRENCY,
      async (project) => {
        const budgetPC = project.budget?.totalPC || project.totalBudget;
        const budgetPT = project.budget?.totalPT || project.totalBudget;
        const aiuPercentage = project.budget?.aiuPercentage || 30;

        const directCostPC = project.budget?.totalDirectCostPC || 0;
        const directCostPT = project.budget?.totalDirectCostPT || 0;

        const totalPaid = project.paymentRequests.reduce((sum, p) => sum + p.amount, 0);
        const totalCutsApproved = project.workCuts.reduce((sum, c) => sum + c.requestedAmount, 0);
        const totalContracts = project.contracts.reduce((sum, c) => sum + c.contractValue, 0);
        const totalSpent = project.costCenters.reduce((sum, cc) => sum + cc.spentAmount, 0);

        const taxes = project.taxConfigs.map((tax) => {
          let baseAmount = 0;
          if (tax.appliesTo === 'VENTAS') {
            baseAmount = budgetPC;
          } else if (tax.appliesTo === 'COMPRAS') {
            baseAmount = totalPaid;
          } else {
            baseAmount = budgetPC + totalPaid;
          }

          return {
            name: tax.name,
            type: tax.type,
            rate: tax.rate,
            amount: baseAmount * (tax.rate / 100),
          };
        });

        const totalTaxes = taxes.reduce((sum, t) => sum + t.amount, 0);
        const marginPC = budgetPC - totalPaid - totalTaxes;
        const marginPercentage = budgetPC > 0 ? (marginPC / budgetPC) * 100 : 0;
        const progressPercentage = budgetPC > 0 ? (totalPaid / budgetPC) * 100 : 0;

        return {
          projectId: project.id,
          projectCode: project.code,
          projectName: project.name,
          client: project.client,
          status: project.status,
          startDate: project.startDate,
          estimatedEndDate: project.estimatedEndDate,
          budget: {
            totalPC: budgetPC,
            totalPT: budgetPT,
            directCostPC,
            directCostPT,
            aiuPercentage,
            aiuPC: project.budget?.totalAIU_PC || budgetPC * (aiuPercentage / 100),
            aiuPT: project.budget?.totalAIU_PT || budgetPT * (aiuPercentage / 100),
          },
          execution: {
            totalPaid,
            totalCutsApproved,
            totalContracts,
            totalSpent,
            pendingToPay: totalCutsApproved - totalPaid,
          },
          taxes: {
            items: taxes,
            total: totalTaxes,
          },
          margins: {
            grossMargin: budgetPC - totalPaid,
            netMargin: marginPC,
            marginPercentage,
          },
          progress: {
            percentage: progressPercentage,
            remaining: budgetPC - totalPaid,
          },
          layers:
            project.budget?.layers.map((layer) => ({
              code: layer.code,
              name: layer.name,
              totalPC: layer.totalDirectCostPC,
              totalPT: layer.totalDirectCostPT,
              itemCount: layer.items.length,
            })) || [],
        };
      }
    );

    const totals = {
      totalBudgetPC: financialReports.reduce((sum, r) => sum + r.budget.totalPC, 0),
      totalBudgetPT: financialReports.reduce((sum, r) => sum + r.budget.totalPT, 0),
      totalPaid: financialReports.reduce((sum, r) => sum + r.execution.totalPaid, 0),
      totalContracts: financialReports.reduce((sum, r) => sum + r.execution.totalContracts, 0),
      totalTaxes: financialReports.reduce((sum, r) => sum + r.taxes.total, 0),
      totalMargin: financialReports.reduce((sum, r) => sum + r.margins.netMargin, 0),
    };

    const duration = Date.now() - startTime;
    logger.info('build_report_complete', 
      { projectId, projectCount: financialReports.length, duration }, 
      `Report built in ${duration}ms`);

    return {
      projects: financialReports,
      totals,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('build_report_error', error as Error, { projectId, duration });
    throw error;
  }
}

export async function getFinancialReportPayload(projectId: string | null, noCache = false) {
  const cacheKey = `financial-report:${projectId ?? 'all'}`;

  if (noCache) {
    return buildFinancialReport(projectId);
  }

  return getOrSetRuntimeCache(cacheKey, FINANCIAL_REPORT_TTL_MS, () => buildFinancialReport(projectId));
}

export async function invalidateFinancialReportCache() {
  try {
    await clearRuntimeCache('financial-report:');
  } catch (error) {
    console.error('Error invalidating financial report cache:', error);
  }
}
