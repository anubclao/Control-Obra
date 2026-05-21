import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";

// GET - Listar capas de un presupuesto
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
        layers: {
          orderBy: { order: "asc" },
          include: {
            _count: {
              select: { items: true },
            },
          },
        },
      },
    });

    if (!budget) {
      return NextResponse.json(
        { error: "Presupuesto no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(budget.layers);
  } catch (error) {
    console.error("Error fetching layers:", error);
    return NextResponse.json(
      { error: "Error al obtener capas" },
      { status: 500 }
    );
  }
}

// POST - Crear nueva capa
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
    const { code, name } = body;

    if (!code || !name) {
      return NextResponse.json(
        { error: "Código y nombre son requeridos" },
        { status: 400 }
      );
    }

    const budget = await prisma.budget.findUnique({
      where: { projectId },
      include: { layers: true },
    });

    if (!budget) {
      return NextResponse.json(
        { error: "Presupuesto no encontrado" },
        { status: 404 }
      );
    }

    // Verificar que el código no exista
    const existingLayer = budget.layers.find(
      (l: any) => l.code.toUpperCase() === code.toUpperCase()
    );
    if (existingLayer) {
      return NextResponse.json(
        { error: "Ya existe una capa con ese código" },
        { status: 400 }
      );
    }

    const layer = await prisma.budgetLayer.create({
      data: {
        budgetId: budget.id,
        code: code.toUpperCase(),
        name,
        order: budget.layers.length,
      },
    });

    return NextResponse.json(layer, { status: 201 });
  } catch (error) {
    console.error("Error creating layer:", error);
    return NextResponse.json(
      { error: "Error al crear capa" },
      { status: 500 }
    );
  }
}
