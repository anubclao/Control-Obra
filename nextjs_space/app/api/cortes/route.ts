import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";
import { invalidateFinancialReportCache } from '@/lib/financial-report';

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const workCuts = await prisma.workCut.findMany({
      include: {
        project: {
          select: {
            name: true,
          },
        },
        contractor: {
          select: {
            name: true,
            nit: true,
          },
        },
        costCenter: {
          select: {
            name: true,
          },
        },
        approvedBy: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            documents: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(workCuts);
  } catch (error) {
    console.error("Error obteniendo cortes:", error);
    return NextResponse.json(
      { error: "Error al obtener cortes" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Solo admin puede crear cortes
    if ((session?.user as any)?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "No tienes permisos para realizar esta acción" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      projectId,
      contractorId,
      costCenterId,
      periodStart,
      periodEnd,
      requestedAmount,
      description,
    } = body;

    if (
      !projectId ||
      !contractorId ||
      !periodStart ||
      !periodEnd ||
      !requestedAmount ||
      !description
    ) {
      return NextResponse.json(
        { error: "Todos los campos son requeridos" },
        { status: 400 }
      );
    }

    const requestedAmountNumber = parseFloat(requestedAmount);

    // Validar que el monto sea positivo
    if (requestedAmountNumber <= 0) {
      return NextResponse.json(
        { error: "El monto debe ser mayor a cero" },
        { status: 400 }
      );
    }

    // Validar que las fechas sean coherentes
    if (new Date(periodStart) > new Date(periodEnd)) {
      return NextResponse.json(
        { error: "La fecha de inicio debe ser anterior a la fecha de fin" },
        { status: 400 }
      );
    }

    let resolvedCostCenterId = costCenterId;

    // Fallback temporal: si no llega centro de costo, usar el primero del proyecto.
    if (!resolvedCostCenterId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { totalBudget: true },
      });

      const fallbackBudget = Math.max(
        project?.totalBudget ?? 0,
        requestedAmountNumber
      );

      const defaultCostCenter = await prisma.costCenter.findFirst({
        where: { projectId },
        orderBy: { createdAt: "asc" },
        select: { id: true, assignedBudget: true },
      });

      if (defaultCostCenter) {
        if ((defaultCostCenter.assignedBudget ?? 0) <= 0) {
          await prisma.costCenter.update({
            where: { id: defaultCostCenter.id },
            data: { assignedBudget: fallbackBudget },
          });
        }

        resolvedCostCenterId = defaultCostCenter.id;
      } else {
        const autoCostCenter = await prisma.costCenter.create({
          data: {
            name: "General",
            assignedBudget: fallbackBudget,
            projectId,
          },
          select: { id: true },
        });

        resolvedCostCenterId = autoCostCenter.id;
      }
    }

    // Obtener el último número de corte para este proyecto
    const lastCut = await prisma.workCut.findFirst({
      where: { projectId },
      orderBy: { cutNumber: "desc" },
    });

    const cutNumber = (lastCut?.cutNumber ?? 0) + 1;

    const workCut = await prisma.workCut.create({
      data: {
        cutNumber,
        projectId,
        contractorId,
        costCenterId: resolvedCostCenterId,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        requestedAmount: requestedAmountNumber,
        description,
        status: "PENDING",
      },
      include: {
        project: true,
        contractor: true,
        costCenter: true,
      },
    });

    await invalidateFinancialReportCache();

    return NextResponse.json(workCut, { status: 201 });
  } catch (error) {
    console.error("Error creando corte:", error);
    return NextResponse.json(
      { error: "Error al crear corte" },
      { status: 500 }
    );
  }
}
