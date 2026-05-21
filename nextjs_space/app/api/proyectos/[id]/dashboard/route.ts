import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Obtener proyecto con centros de costo
    const project = await prisma.project.findUnique({
      where: { id: params?.id },
      include: {
        costCenters: {
          include: {
            workCuts: {
              where: {
                status: "APPROVED",
              },
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proyecto no encontrado" },
        { status: 404 }
      );
    }

    // Calcular el gasto total por centro de costo
    const costCentersWithSpent = project?.costCenters?.map?.((cc) => {
      const spent = cc?.workCuts?.reduce?.(
        (sum, wc) => sum + (wc?.requestedAmount ?? 0),
        0
      ) ?? 0;
      return {
        id: cc?.id,
        name: cc?.name,
        assignedBudget: cc?.assignedBudget,
        spentAmount: spent,
        available: (cc?.assignedBudget ?? 0) - spent,
        percentage: ((cc?.assignedBudget ?? 0) > 0
          ? (spent / (cc?.assignedBudget ?? 1)) * 100
          : 0),
      };
    }) ?? [];

    // Calcular totales del proyecto
    const totalSpent = costCentersWithSpent?.reduce?.(
      (sum, cc) => sum + (cc?.spentAmount ?? 0),
      0
    ) ?? 0;
    const totalBudget = project?.totalBudget ?? 0;
    const available = totalBudget - totalSpent;
    const executionPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    // Detectar sobrecostos
    const overBudgetCenters = costCentersWithSpent?.filter?.(
      (cc) => (cc?.spentAmount ?? 0) > (cc?.assignedBudget ?? 0)
    ) ?? [];

    return NextResponse.json({
      project: {
        id: project?.id,
        name: project?.name,
        client: project?.client,
        status: project?.status,
      },
      budget: {
        total: totalBudget,
        spent: totalSpent,
        available,
        executionPercentage,
      },
      costCenters: costCentersWithSpent,
      alerts: {
        overBudget: overBudgetCenters?.length ?? 0,
        overBudgetCenters,
      },
    });
  } catch (error) {
    console.error("Error obteniendo dashboard del proyecto:", error);
    return NextResponse.json(
      { error: "Error al obtener dashboard" },
      { status: 500 }
    );
  }
}
