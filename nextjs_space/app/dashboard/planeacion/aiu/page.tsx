import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";
import { AIUClient } from "./_components/aiu-client";

export const dynamic = "force-dynamic";

export default async function AIUPage() {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role || "USER";

  // Obtener proyectos con presupuestos y ejecución
  const projects = await prisma.project.findMany({
    include: {
      budget: {
        select: {
          id: true,
          aiuPercentage: true,
          totalDirectCostPC: true,
          totalDirectCostPT: true,
          totalAIU_PC: true,
          totalAIU_PT: true,
          totalPC: true,
          totalPT: true,
        },
      },
      workCuts: {
        where: { status: "APPROVED" },
        select: {
          requestedAmount: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Procesar datos
  let totalPresupuestoPC = 0;
  let totalPresupuestoPT = 0;
  let totalEjecutado = 0;
  let projectsWithBudget = 0;

  const projectsWithAIU = projects.map((project: any) => {
    const ejecutado = project.workCuts.reduce(
      (sum: number, cut: any) => sum + cut.requestedAmount,
      0
    );

    if (project.budget) {
      projectsWithBudget++;
      totalPresupuestoPC += project.budget.totalPC;
      totalPresupuestoPT += project.budget.totalPT;
    }
    totalEjecutado += ejecutado;

    return {
      id: project.id,
      code: project.code,
      name: project.name,
      client: project.client,
      location: project.location,
      status: project.status,
      hasBudget: !!project.budget,
      aiuPercentage: project.budget?.aiuPercentage || 30,
      totalPC: project.budget?.totalPC || 0,
      totalPT: project.budget?.totalPT || 0,
      totalDirectCostPC: project.budget?.totalDirectCostPC || 0,
      totalDirectCostPT: project.budget?.totalDirectCostPT || 0,
      totalAIU_PC: project.budget?.totalAIU_PC || 0,
      totalAIU_PT: project.budget?.totalAIU_PT || 0,
      ejecutado,
      porcentajeEjecucion: project.budget?.totalPC
        ? (ejecutado / project.budget.totalPC) * 100
        : 0,
    };
  });

  const margenProyectado =
    totalPresupuestoPC > 0
      ? ((totalPresupuestoPC - totalEjecutado) / totalPresupuestoPC) * 100
      : 0;

  const stats = {
    totalProyectos: projects.length,
    proyectosActivos: projects.filter((p: any) => p.status === "IN_EXECUTION").length,
    proyectosConPresupuesto: projectsWithBudget,
    totalPresupuestoPC,
    totalPresupuestoPT,
    totalEjecutado,
    margenProyectado,
  };

  // Obtener alertas
  const contractors = await prisma.contractor.findMany({
    include: {
      documents: true,
    },
  });

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const alerts: any[] = [];

  // Alertas de pólizas próximas a vencer
  contractors.forEach((contractor: any) => {
    contractor.documents.forEach((doc: any) => {
      if (doc.expirationDate) {
        const expDate = new Date(doc.expirationDate);
        if (expDate < now) {
          alerts.push({
            type: "expired",
            title: "Póliza vencida",
            description: `${contractor.name} - ${doc.type}`,
            date: doc.expirationDate,
            icon: "alert",
          });
        } else if (expDate <= thirtyDaysFromNow) {
          const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          alerts.push({
            type: "expiring",
            title: "Póliza próxima a vencer",
            description: `${contractor.name} - Vence en ${daysLeft} días`,
            date: doc.expirationDate,
            icon: "warning",
          });
        }
      }
    });
  });

  // Alertas de desviación de costos
  projectsWithAIU.forEach((project: any) => {
    if (project.hasBudget && project.porcentajeEjecucion > 90) {
      alerts.push({
        type: "cost",
        title: "Desviación de costos > 10%",
        description: `${project.name} - Avance ${project.porcentajeEjecucion.toFixed(0)}%`,
        projectName: project.name,
        icon: "alert",
      });
    }
  });

  // Cortes pendientes
  const pendingCuts = await prisma.workCut.findMany({
    where: { status: "PENDING" },
    include: {
      project: true,
      contractor: true,
    },
    take: 5,
  });

  pendingCuts.forEach((cut: any) => {
    alerts.push({
      type: "workcut",
      title: "Corte de obra pendiente",
      description: `Corte #${cut.cutNumber} - ${cut.contractor.name}`,
      projectName: cut.project.name,
      date: cut.createdAt,
      icon: "document",
    });
  });

  return (
    <AIUClient
      projects={projectsWithAIU}
      stats={stats}
      alerts={alerts.slice(0, 10)}
      userRole={userRole}
    />
  );
}
