import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/db';
import { ROLES_CAN_VIEW_FINANCIAL } from '@/lib/constants';
import { ReporteFinancieroClient } from './_components/reporte-financiero-client';

export const dynamic = 'force-dynamic';

export default async function ReporteFinancieroPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login');
  }

  const userRole = session.user.role;
  if (!ROLES_CAN_VIEW_FINANCIAL.includes(userRole as (typeof ROLES_CAN_VIEW_FINANCIAL)[number])) {
    redirect('/dashboard');
  }

  // Obtener todos los proyectos con datos financieros
  const projects = await prisma.project.findMany({
    include: {
      budget: {
        include: {
          layers: {
            include: {
              items: true
            }
          }
        }
      },
      costCenters: true,
      workCuts: {
        where: { status: 'APPROVED' }
      },
      contracts: {
        where: { status: { in: ['ENABLED', 'CLOSED'] } }
      },
      paymentRequests: {
        where: { status: 'PAID' }
      },
      taxConfigs: {
        where: { isActive: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Calcular métricas financieras
  type ProjectWithRelations = typeof projects[number];
  const financialData = projects.map((project: ProjectWithRelations) => {
    const budgetPC = project.budget?.totalPC || project.totalBudget;
    const budgetPT = project.budget?.totalPT || project.totalBudget;
    const aiuPercentage = project.budget?.aiuPercentage || 30;

    const totalPaid = project.paymentRequests.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0);
    const totalCutsApproved = project.workCuts.reduce((sum: number, c: { requestedAmount: number }) => sum + c.requestedAmount, 0);
    const totalContracts = project.contracts.reduce((sum: number, c: { contractValue: number }) => sum + c.contractValue, 0);

    // Cálculo de impuestos
    let totalTaxes = 0;
    project.taxConfigs.forEach((tax: { appliesTo: string; rate: number }) => {
      let baseAmount = 0;
      if (tax.appliesTo === 'VENTAS') {
        baseAmount = budgetPC;
      } else if (tax.appliesTo === 'COMPRAS') {
        baseAmount = totalPaid;
      } else {
        baseAmount = totalPaid;
      }
      totalTaxes += baseAmount * (tax.rate / 100);
    });

    const grossMargin = budgetPC - totalPaid;
    const netMargin = grossMargin - totalTaxes;
    const marginPercentage = budgetPC > 0 ? (netMargin / budgetPC) * 100 : 0;
    const progressPercentage = budgetPC > 0 ? (totalPaid / budgetPC) * 100 : 0;

    return {
      id: project.id,
      code: project.code,
      name: project.name,
      client: project.client,
      status: project.status,
      budgetPC,
      budgetPT,
      aiuPercentage,
      totalPaid,
      totalCutsApproved,
      totalContracts,
      totalTaxes,
      grossMargin,
      netMargin,
      marginPercentage,
      progressPercentage,
      layers: project.budget?.layers.map((layer: { code: string; name: string; totalDirectCostPC: number; totalDirectCostPT: number }) => ({
        code: layer.code,
        name: layer.name,
        totalPC: layer.totalDirectCostPC,
        totalPT: layer.totalDirectCostPT
      })) || []
    };
  });

  // Totales generales
  const totals = {
    totalBudgetPC: financialData.reduce((sum: number, p) => sum + p.budgetPC, 0),
    totalBudgetPT: financialData.reduce((sum: number, p) => sum + p.budgetPT, 0),
    totalPaid: financialData.reduce((sum: number, p) => sum + p.totalPaid, 0),
    totalContracts: financialData.reduce((sum: number, p) => sum + p.totalContracts, 0),
    totalTaxes: financialData.reduce((sum: number, p) => sum + p.totalTaxes, 0),
    totalMargin: financialData.reduce((sum: number, p) => sum + p.netMargin, 0)
  };

  return (
    <ReporteFinancieroClient
      projects={financialData}
      totals={totals}
    />
  );
}
