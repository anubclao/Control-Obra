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

    const workLog = await prisma.workLog.findUnique({
      where: { id: params?.id },
      include: {
        project: true,
        contractor: true,
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
        photos: {
          orderBy: {
            uploadedAt: "asc",
          },
        },
      },
    });

    if (!workLog) {
      return NextResponse.json(
        { error: "Bitácora no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(workLog);
  } catch (error) {
    console.error("Error obteniendo bitácora:", error);
    return NextResponse.json(
      { error: "Error al obtener bitácora" },
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

    const workLog = await prisma.workLog.findUnique({
      where: { id: params?.id },
    });

    if (!workLog) {
      return NextResponse.json(
        { error: "Bitácora no encontrada" },
        { status: 404 }
      );
    }

    // Verificar que sea el mismo día o admin
    const isSameDay =
      new Date(workLog?.date).toDateString() === new Date().toDateString();
    const isAdmin = (session?.user as any)?.role === "ADMIN";
    const isOwner = workLog?.createdById === session?.user?.id;

    if (!isAdmin && (!isOwner || !isSameDay)) {
      return NextResponse.json(
        { error: "No tienes permisos para editar esta entrada" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { activities, weather, personnel, observations } = body;

    const updatedWorkLog = await prisma.workLog.update({
      where: { id: params?.id },
      data: {
        ...(activities && { activities }),
        ...(weather && { weather }),
        ...(personnel && { personnel }),
        ...(observations !== undefined && { observations }),
      },
    });

    return NextResponse.json(updatedWorkLog);
  } catch (error) {
    console.error("Error actualizando bitácora:", error);
    return NextResponse.json(
      { error: "Error al actualizar bitácora" },
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

    // Solo admin puede eliminar
    if ((session?.user as any)?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "No tienes permisos para eliminar bitácoras" },
        { status: 403 }
      );
    }

    await prisma.workLog.delete({
      where: { id: params?.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error eliminando bitácora:", error);
    return NextResponse.json(
      { error: "Error al eliminar bitácora" },
      { status: 500 }
    );
  }
}
