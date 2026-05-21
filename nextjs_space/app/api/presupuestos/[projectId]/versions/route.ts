import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";

// GET - Listar versiones de un presupuesto
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { projectId } = params;

    const budget = await prisma.budget.findUnique({
      where: { projectId },
      include: {
        versions: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!budget) {
      return NextResponse.json(
        { error: "Presupuesto no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(budget.versions);
  } catch (error) {
    console.error("Error fetching versions:", error);
    return NextResponse.json(
      { error: "Error al obtener versiones" },
      { status: 500 }
    );
  }
}

// POST - Crear nueva versión (snapshot)
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { projectId } = params;
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Nombre de versión requerido" },
        { status: 400 }
      );
    }

    const budget = await prisma.budget.findUnique({
      where: { projectId },
    });

    if (!budget) {
      return NextResponse.json(
        { error: "Presupuesto no encontrado" },
        { status: 404 }
      );
    }

    // Desactivar versión anterior
    await prisma.budgetVersion.updateMany({
      where: { budgetId: budget.id, isActive: true },
      data: { isActive: false },
    });

    // Crear nueva versión activa con snapshot de totales
    const version = await prisma.budgetVersion.create({
      data: {
        budgetId: budget.id,
        name,
        description,
        isActive: true,
        snapshotTotalPC: budget.totalPC,
        snapshotTotalPT: budget.totalPT,
      },
    });

    return NextResponse.json(version, { status: 201 });
  } catch (error) {
    console.error("Error creating version:", error);
    return NextResponse.json(
      { error: "Error al crear versión" },
      { status: 500 }
    );
  }
}
