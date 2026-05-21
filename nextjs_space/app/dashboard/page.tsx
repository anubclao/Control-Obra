import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { redirect } from "next/navigation";
import DashboardOverview from "@/components/dashboard-overview";
import { prisma } from "@/lib/db";
import { calculateDaysUntil } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  // Estadísticas generales - ejecutar secuencialmente para evitar demasiadas conexiones
  const projectsCount = await prisma.project.count();
  const contractorsCount = await prisma.contractor.count();
  const pendingCutsCount = await prisma.workCut.count({
    where: {
      OR: [{ status: "PENDING" }, { status: "IN_REVIEW" }],
    },
  });
  const workLogsCount = await prisma.workLog.count();
  const suppliersCount = await prisma.supplier.count();
  const employeesCount = await prisma.employee.count();
  const pendingPaymentsCount = await prisma.paymentRequest.count({
    where: {
      status: { in: ["PENDING", "APPROVED_LEVEL_1", "APPROVED_LEVEL_2"] },
    },
  });
  const quotationsCount = await prisma.quotation.count({
    where: {
      status: { in: ["DRAFT", "SENT"] },
    },
  });
  const clientsCount = await prisma.client.count();

  // Datos financieros - pagos pendientes por monto
  const pendingPayments = await prisma.paymentRequest.findMany({
    where: {
      status: { in: ["PENDING", "APPROVED_LEVEL_1", "APPROVED_LEVEL_2", "APPROVED"] },
    },
    select: {
      amount: true,
      status: true,
    },
  });

  const totalPendingAmount = pendingPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalApprovedAmount = pendingPayments
    .filter((p) => p.status === "APPROVED")
    .reduce((sum, p) => sum + p.amount, 0);

  // Cotizaciones activas y su valor
  const activeQuotations = await prisma.quotation.findMany({
    where: {
      status: { in: ["SENT", "VIEWED"] },
    },
    select: {
      total: true,
      status: true,
    },
  });

  const totalQuotationsValue = activeQuotations.reduce((sum, q) => sum + q.total, 0);

  // Proyectos activos con presupuesto
  const activeProjects = await prisma.project.findMany({
    where: {
      OR: [
        { status: "IN_EXECUTION" },
        { status: "IN_PLANNING" },
      ],
    },
    include: {
      costCenters: true,
      workCuts: {
        where: {
          status: "APPROVED",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 5,
  });

  // Calcular gastos por proyecto
  const projectsWithBudget = activeProjects?.map?.((project) => {
    const spent = project?.workCuts?.reduce?.(
      (sum, cut) => sum + (cut?.requestedAmount ?? 0),
      0
    ) ?? 0;
    return {
      id: project?.id,
      name: project?.name,
      status: project?.status,
      totalBudget: project?.totalBudget,
      spent,
    };
  }) ?? [];

  // Subcontratistas con problemas de documentación
  const allContractors = await prisma.contractor.findMany({
    include: {
      documents: true,
    },
  });

  // Verificar estado de documentación
  const contractorsWithIssues = allContractors
    ?.filter?.((contractor) => {
      const requiredDocs = [
        "CEDULA",
        "RUT",
        "CAMARA_COMERCIO",
        "CERTIFICADO_BANCARIO",
      ];
      const docs = contractor?.documents ?? [];

      // Verificar documentos faltantes
      const missingDocs = requiredDocs?.filter?.(
        (type) => !docs?.find?.((d) => d?.type === type)
      ) ?? [];

      // Verificar documentos vencidos o próximos a vencer
      const expiredOrExpiring = docs?.filter?.((doc) => {
        if (!doc?.expirationDate) return false;
        const daysUntil = calculateDaysUntil(doc?.expirationDate);
        return daysUntil <= 30;
      }) ?? [];

      return missingDocs?.length > 0 || expiredOrExpiring?.length > 0;
    })
    ?.map?.((contractor) => {
      const requiredDocs = [
        "CEDULA",
        "RUT",
        "CAMARA_COMERCIO",
        "CERTIFICADO_BANCARIO",
      ];
      const docs = contractor?.documents ?? [];

      const missingDocs = requiredDocs?.filter?.(
        (type) => !docs?.find?.((d) => d?.type === type)
      ) ?? [];

      const expiredOrExpiring = docs?.filter?.((doc) => {
        if (!doc?.expirationDate) return false;
        const daysUntil = calculateDaysUntil(doc?.expirationDate);
        return daysUntil <= 30;
      }) ?? [];

      return {
        id: contractor?.id,
        name: contractor?.name,
        status: contractor?.status,
        missingCount: missingDocs?.length ?? 0,
        expiredCount: expiredOrExpiring?.length ?? 0,
      };
    }) ?? [];

  // Últimas entradas de bitácora
  const recentLogs = await prisma.workLog.findMany({
    include: {
      project: {
        select: {
          name: true,
        },
      },
      createdBy: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      date: "desc",
    },
    take: 5,
  });

  // Cortes pendientes de aprobación
  const pendingCuts = await prisma.workCut.findMany({
    where: {
      OR: [
        { status: "PENDING" },
        { status: "IN_REVIEW" },
      ],
    },
    include: {
      project: {
        select: {
          name: true,
        },
      },
      contractor: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 5,
  });

  const stats = {
    projects: projectsCount,
    contractors: contractorsCount,
    pendingCuts: pendingCutsCount,
    alerts: contractorsWithIssues?.length ?? 0,
    workLogs: workLogsCount,
    suppliers: suppliersCount,
    employees: employeesCount,
    pendingPayments: pendingPaymentsCount,
    quotations: quotationsCount,
    clients: clientsCount,
  };

  const financialData = {
    totalPendingAmount,
    totalApprovedAmount,
    totalQuotationsValue,
  };

  return (
    <DashboardOverview
      stats={stats}
      activeProjects={projectsWithBudget ?? []}
      contractorsWithIssues={contractorsWithIssues ?? []}
      recentLogs={recentLogs ?? []}
      pendingCuts={pendingCuts ?? []}
      userRole={(session?.user as any)?.role ?? ""}
      financialData={financialData}
    />
  );
}
