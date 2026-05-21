import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";

// GET - Listar todos los presupuestos con sus proyectos
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Obtener todos los proyectos con sus presupuestos
    const projects = await prisma.project.findMany({
      include: {
        budget: {
          include: {
            versions: {
              where: { isActive: true },
              take: 1,
            },
            layers: {
              include: {
                _count: {
                  select: { items: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calcular estadísticas
    const projectsWithBudget = projects.filter((p: any) => p.budget !== null);
    const projectsWithoutBudget = projects.filter((p: any) => p.budget === null);
    
    const totalPC = projectsWithBudget.reduce(
      (sum: number, p: any) => sum + (p.budget?.totalPC || 0),
      0
    );
    const totalPT = projectsWithBudget.reduce(
      (sum: number, p: any) => sum + (p.budget?.totalPT || 0),
      0
    );

    return NextResponse.json({
      projects,
      stats: {
        withBudget: projectsWithBudget.length,
        withoutBudget: projectsWithoutBudget.length,
        totalPC,
        totalPT,
      },
    });
  } catch (error) {
    console.error("Error fetching budgets:", error);
    return NextResponse.json(
      { error: "Error al obtener presupuestos" },
      { status: 500 }
    );
  }
}

// POST - Crear presupuesto para un proyecto
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, aiuPercentage = 30 } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: "ID de proyecto requerido" },
        { status: 400 }
      );
    }

    // Verificar que el proyecto existe
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { budget: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proyecto no encontrado" },
        { status: 404 }
      );
    }

    if (project.budget) {
      return NextResponse.json(
        { error: "El proyecto ya tiene un presupuesto" },
        { status: 400 }
      );
    }

    // Crear el presupuesto con una versión inicial
    const budget = await prisma.budget.create({
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
      include: {
        versions: true,
        layers: true,
      },
    });

    return NextResponse.json(budget, { status: 201 });
  } catch (error) {
    console.error("Error creating budget:", error);
    return NextResponse.json(
      { error: "Error al crear presupuesto" },
      { status: 500 }
    );
  }
}
