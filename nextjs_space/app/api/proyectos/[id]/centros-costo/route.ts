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

    const costCenters = await prisma.costCenter.findMany({
      where: { projectId: params?.id },
      include: {
        _count: {
          select: {
            workCuts: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json(costCenters);
  } catch (error) {
    console.error("Error obteniendo centros de costo:", error);
    return NextResponse.json(
      { error: "Error al obtener centros de costo" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Solo admin puede crear centros de costo
    if ((session?.user as any)?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "No tienes permisos para realizar esta acción" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, assignedBudget } = body;

    if (!name || !assignedBudget) {
      return NextResponse.json(
        { error: "Nombre y presupuesto son requeridos" },
        { status: 400 }
      );
    }

    // Verificar que el proyecto existe
    const project = await prisma.project.findUnique({
      where: { id: params?.id },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proyecto no encontrado" },
        { status: 404 }
      );
    }

    const costCenter = await prisma.costCenter.create({
      data: {
        name,
        assignedBudget: parseFloat(assignedBudget),
        projectId: params?.id,
      },
    });

    return NextResponse.json(costCenter, { status: 201 });
  } catch (error) {
    console.error("Error creando centro de costo:", error);
    return NextResponse.json(
      { error: "Error al crear centro de costo" },
      { status: 500 }
    );
  }
}
