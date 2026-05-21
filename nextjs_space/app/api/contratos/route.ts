import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";

// GET - Obtener todos los contratos
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const where: any = {};

    if (projectId && projectId !== "all") {
      where.projectId = projectId;
    }

    if (status && status !== "all") {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { contractNumber: { contains: search, mode: "insensitive" } },
        { contractObject: { contains: search, mode: "insensitive" } },
        { contractor: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const contracts = await prisma.contract.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        contractor: {
          select: {
            id: true,
            name: true,
            nit: true,
          },
        },
        _count: {
          select: {
            documents: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calcular estadísticas
    const allContracts = await prisma.contract.findMany({
      select: { status: true, contractValue: true },
    });

    const stats = {
      total: allContracts.length,
      draft: allContracts.filter((c) => c.status === "DRAFT").length,
      enabled: allContracts.filter((c) => c.status === "ENABLED").length,
      closed: allContracts.filter((c) => c.status === "CLOSED").length,
      totalValue: allContracts.reduce((sum, c) => sum + c.contractValue, 0),
    };

    return NextResponse.json({ contracts, stats });
  } catch (error) {
    console.error("Error fetching contracts:", error);
    return NextResponse.json(
      { error: "Error al obtener contratos" },
      { status: 500 }
    );
  }
}

// POST - Crear nuevo contrato
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      (session.user.role !== "ADMIN" && session.user.role !== "DIRECTOR")
    ) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const {
      projectId,
      contractorId,
      contractType,
      paymentMethod,
      startDate,
      endDate,
      contractObject,
      contractValue,
      observations,
    } = body;

    // Validaciones
    if (!projectId || !contractorId || !startDate || !contractObject) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      );
    }

    // Verificar que el proyecto existe
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proyecto no encontrado" },
        { status: 404 }
      );
    }

    // Verificar que el contratista existe
    const contractor = await prisma.contractor.findUnique({
      where: { id: contractorId },
    });

    if (!contractor) {
      return NextResponse.json(
        { error: "Contratista no encontrado" },
        { status: 404 }
      );
    }

    if (contractor.status !== "COMPLETE") {
      return NextResponse.json(
        {
          error:
            "El subcontratista debe estar en estado Completo para poder crearle un contrato.",
        },
        { status: 400 }
      );
    }

    const hasProjectAssignment = await prisma.projectAssignment.findFirst({
      where: {
        userId: session.user.id,
        projectId,
      },
      select: { id: true },
    });

    if (session.user.role === "DIRECTOR" && !hasProjectAssignment) {
      return NextResponse.json(
        {
          error:
            "Como director solo puedes crear contratos en proyectos donde tienes asignacion activa.",
        },
        { status: 403 }
      );
    }

    // Generar número de contrato
    const year = new Date().getFullYear();
    const lastContract = await prisma.contract.findFirst({
      where: {
        contractNumber: { startsWith: `CTR-${year}` },
      },
      orderBy: { contractNumber: "desc" },
    });

    let nextNumber = 1;
    if (lastContract) {
      const parts = lastContract.contractNumber.split("-");
      nextNumber = parseInt(parts[2]) + 1;
    }

    const contractNumber = `CTR-${year}-${nextNumber.toString().padStart(4, "0")}`;

    // Crear contrato
    const contract = await prisma.contract.create({
      data: {
        contractNumber,
        projectId,
        contractorId,
        contractType: contractType || "OBRA",
        paymentMethod: paymentMethod || "POR_CORTES",
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        contractObject,
        contractValue: contractValue || 0,
        observations,
        status: "DRAFT",
      },
      include: {
        project: {
          select: { name: true },
        },
        contractor: {
          select: { name: true },
        },
      },
    });

    return NextResponse.json(contract, { status: 201 });
  } catch (error) {
    console.error("Error creating contract:", error);
    return NextResponse.json(
      { error: "Error al crear contrato" },
      { status: 500 }
    );
  }
}
