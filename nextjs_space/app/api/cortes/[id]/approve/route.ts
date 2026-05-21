import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";
import { invalidateFinancialReportCache } from '@/lib/financial-report';
import { DocumentType } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Solo admin puede aprobar
    if ((session?.user as any)?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "No tienes permisos para realizar esta acción" },
        { status: 403 }
      );
    }

    const workCut = await prisma.workCut.findUnique({
      where: { id: params?.id },
      include: {
        contractor: {
          include: {
            documents: true,
          },
        },
        costCenter: true,
      },
    });

    if (!workCut) {
      return NextResponse.json(
        { error: "Corte no encontrado" },
        { status: 404 }
      );
    }

    // Verificar documentación del subcontratista
    const requiredDocTypes: DocumentType[] = [
      "CEDULA",
      "RUT",
      "CAMARA_COMERCIO",
      "CERTIFICADO_BANCARIO",
    ];

    const contractorDocs = workCut?.contractor?.documents ?? [];
    const missingDocs: string[] = [];
    const expiredDocs: string[] = [];

    const now = new Date();

    requiredDocTypes?.forEach?.((docType) => {
      const doc = contractorDocs?.find?.((d) => d?.type === docType);
      if (!doc) {
        missingDocs.push(docType);
      } else if (doc?.expirationDate && new Date(doc?.expirationDate) < now) {
        expiredDocs.push(docType);
      }
    });

    if (missingDocs?.length > 0 || expiredDocs?.length > 0) {
      return NextResponse.json(
        {
          error:
            "No se puede aprobar el corte. El subcontratista tiene documentación faltante o vencida.",
          missingDocs,
          expiredDocs,
        },
        { status: 400 }
      );
    }

    // Verificar presupuesto disponible
    const approvedCuts = await prisma.workCut.findMany({
      where: {
        costCenterId: workCut?.costCenterId,
        status: "APPROVED",
      },
    });

    const spentAmount = approvedCuts?.reduce?.(
      (sum, cut) => sum + (cut?.requestedAmount ?? 0),
      0
    ) ?? 0;

    const availableBudget = (workCut?.costCenter?.assignedBudget ?? 0) - spentAmount;

    if ((workCut?.requestedAmount ?? 0) > availableBudget) {
      return NextResponse.json(
        {
          error: "El monto del corte excede el presupuesto disponible del centro de costo",
          availableBudget,
          requestedAmount: workCut?.requestedAmount,
        },
        { status: 400 }
      );
    }

    // Aprobar el corte
    const updatedWorkCut = await prisma.workCut.update({
      where: { id: params?.id },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedById: session?.user?.id ?? null,
      },
    });

    await invalidateFinancialReportCache();

    return NextResponse.json(updatedWorkCut);
  } catch (error) {
    console.error("Error aprobando corte:", error);
    return NextResponse.json(
      { error: "Error al aprobar corte" },
      { status: 500 }
    );
  }
}
