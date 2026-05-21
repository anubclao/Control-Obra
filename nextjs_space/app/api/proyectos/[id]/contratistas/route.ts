import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const contracts = await prisma.contract.findMany({
      where: {
        projectId: params?.id,
        OR: [
          {
            budgets: {
              some: {},
            },
          },
          {
            dailyProgress: {
              some: {},
            },
          },
        ],
      },
      include: {
        contractor: {
          select: {
            id: true,
            name: true,
            nit: true,
          },
        },
        budgets: {
          select: {
            id: true,
          },
          where: {
            isActive: true,
          },
          take: 1,
        },
        _count: {
          select: {
            dailyProgress: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const contractors = contracts.map((contract) => ({
      id: contract.contractor.id,
      name: contract.contractor.name,
      nit: contract.contractor.nit,
      contractId: contract.id,
      contractNumber: contract.contractNumber,
      contractStatus: contract.status,
      hasBudget: contract.budgets.length > 0,
      hasProgress: contract._count.dailyProgress > 0,
    }));

    return NextResponse.json(contractors);
  } catch (error) {
    console.error("Error obteniendo contratistas por proyecto:", error);
    return NextResponse.json(
      { error: "Error al obtener contratistas del proyecto" },
      { status: 500 }
    );
  }
}