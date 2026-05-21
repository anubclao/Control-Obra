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

    const workCut = await prisma.workCut.findUnique({
      where: { id: params?.id },
      include: {
        project: true,
        contractor: {
          include: {
            documents: true,
          },
        },
        costCenter: true,
        approvedBy: {
          select: {
            name: true,
            email: true,
          },
        },
        documents: {
          orderBy: {
            uploadedAt: "desc",
          },
        },
      },
    });

    if (!workCut) {
      return NextResponse.json(
        { error: "Corte no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(workCut);
  } catch (error) {
    console.error("Error obteniendo corte:", error);
    return NextResponse.json(
      { error: "Error al obtener corte" },
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

    // Solo admin puede editar cortes
    if ((session?.user as any)?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "No tienes permisos para realizar esta acción" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status } = body;

    const workCut = await prisma.workCut.update({
      where: { id: params?.id },
      data: {
        ...(status && { status }),
      },
    });

    return NextResponse.json(workCut);
  } catch (error) {
    console.error("Error actualizando corte:", error);
    return NextResponse.json(
      { error: "Error al actualizar corte" },
      { status: 500 }
    );
  }
}
