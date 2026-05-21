import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const workLogs = await prisma.workLog.findMany({
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
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            photos: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    return NextResponse.json(workLogs);
  } catch (error) {
    console.error("Error obteniendo bitácoras:", error);
    return NextResponse.json(
      { error: "Error al obtener bitácoras" },
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

    const body = await request.json();
    const { projectId, date, activities, weather, personnel, observations, contractorId } =
      body;

    if (!projectId || !date || !activities || !weather || !personnel) {
      return NextResponse.json(
        { error: "Todos los campos requeridos deben ser completados" },
        { status: 400 }
      );
    }

    const workLog = await prisma.workLog.create({
      data: {
        projectId,
        date: new Date(date),
        activities,
        weather,
        personnel,
        observations: observations || null,
        contractorId: contractorId || null,
        createdById: session?.user?.id ?? "",
      },
      include: {
        project: true,
        contractor: true,
        createdBy: {
          select: {
            name: true,
          },
        },
      },
    });

    return NextResponse.json(workLog, { status: 201 });
  } catch (error) {
    console.error("Error creando bitácora:", error);
    return NextResponse.json(
      { error: "Error al crear bitácora" },
      { status: 500 }
    );
  }
}
