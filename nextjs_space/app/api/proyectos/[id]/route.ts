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

    const project = await prisma.project.findUnique({
      where: { id: params?.id },
      include: {
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
        costCenters: {
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
        },
        workCuts: {
          include: {
            contractor: true,
            costCenter: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        workLogs: {
          include: {
            createdBy: {
              select: {
                name: true,
              },
            },
            contractor: true,
          },
          orderBy: {
            date: "desc",
          },
          take: 10,
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proyecto no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("Error obteniendo proyecto:", error);
    return NextResponse.json(
      { error: "Error al obtener proyecto" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Solo admin puede editar proyectos
    if ((session?.user as any)?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "No tienes permisos para realizar esta acción" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, client, startDate, estimatedEndDate, totalBudget, description, status } = body;

    const project = await prisma.project.update({
      where: { id: params?.id },
      data: {
        ...(name && { name }),
        ...(client && { client }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(estimatedEndDate && { estimatedEndDate: new Date(estimatedEndDate) }),
        ...(totalBudget && { totalBudget: parseFloat(totalBudget) }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
      },
      include: {
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("Error actualizando proyecto:", error);
    return NextResponse.json(
      { error: "Error al actualizar proyecto" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Solo admin puede eliminar proyectos
    if ((session?.user as any)?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "No tienes permisos para realizar esta acción" },
        { status: 403 }
      );
    }

    await prisma.project.delete({
      where: { id: params?.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error eliminando proyecto:", error);
    return NextResponse.json(
      { error: "Error al eliminar proyecto" },
      { status: 500 }
    );
  }
}
