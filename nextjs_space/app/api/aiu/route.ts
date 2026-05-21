import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";
import { calculateAiuBaseTotals } from "@/lib/budget-aiu";

// GET - Obtener configuración AIU de todos los proyectos
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Obtener todos los proyectos con sus presupuestos y AIU
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

    // Calcular estadísticas globales
    let totalPresupuestoPC = 0;
    let totalPresupuestoPT = 0;
    let totalEjecutado = 0;
    let projectsWithBudget = 0;

    const projectsWithAIU = projects.map((project) => {
      const ejecutado = project.workCuts.reduce(
        (sum, cut) => sum + cut.requestedAmount,
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

    // Calcular margen proyectado
    const margenProyectado =
      totalPresupuestoPC > 0
        ? ((totalPresupuestoPC - totalEjecutado) / totalPresupuestoPC) * 100
        : 0;

    return NextResponse.json({
      projects: projectsWithAIU,
      stats: {
        totalProyectos: projects.length,
        proyectosActivos: projects.filter((p) => p.status === "IN_EXECUTION").length,
        proyectosConPresupuesto: projectsWithBudget,
        totalPresupuestoPC,
        totalPresupuestoPT,
        totalEjecutado,
        margenProyectado,
      },
    });
  } catch (error) {
    console.error("Error fetching AIU data:", error);
    return NextResponse.json(
      { error: "Error al obtener datos de AIU" },
      { status: 500 }
    );
  }
}

// PUT - Actualizar AIU de un proyecto
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, aiuPercentage } = body;

    if (!projectId || aiuPercentage === undefined) {
      return NextResponse.json(
        { error: "ID de proyecto y porcentaje AIU requeridos" },
        { status: 400 }
      );
    }

    if (aiuPercentage < 0 || aiuPercentage > 100) {
      return NextResponse.json(
        { error: "El porcentaje AIU debe estar entre 0 y 100" },
        { status: 400 }
      );
    }

    // Buscar o crear el presupuesto
    let budget = await prisma.budget.findUnique({
      where: { projectId },
    });

    if (!budget) {
      // Crear presupuesto si no existe
      budget = await prisma.budget.create({
        data: {
          projectId,
          aiuPercentage,
          versions: {
            create: {
              name: "V1 Inicial",
              isActive: true,
            },
          },
        },
      });
    } else {
      const items = await prisma.budgetItem.findMany({
        where: { layer: { budgetId: budget.id } },
        select: {
          itemNumber: true,
          description: true,
          totalPC: true,
          totalPT: true,
        },
      });
      const totals = calculateAiuBaseTotals(items);

      // Recalcular totales con nuevo AIU
      const newAIU_PC = totals.aiuBasePC * (aiuPercentage / 100);
      const newAIU_PT = totals.aiuBasePT * (aiuPercentage / 100);

      budget = await prisma.budget.update({
        where: { projectId },
        data: {
          aiuPercentage,
          totalDirectCostPC: totals.aiuBasePC,
          totalDirectCostPT: totals.aiuBasePT,
          totalAIU_PC: newAIU_PC,
          totalAIU_PT: newAIU_PT,
          totalPC: totals.aiuBasePC + newAIU_PC + totals.tramitesPC,
          totalPT: totals.aiuBasePT + newAIU_PT + totals.tramitesPT,
        },
      });
    }

    return NextResponse.json(budget);
  } catch (error) {
    console.error("Error updating AIU:", error);
    return NextResponse.json(
      { error: "Error al actualizar AIU" },
      { status: 500 }
    );
  }
}
