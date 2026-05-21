import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";
import { DocumentType } from "@prisma/client";

export const dynamic = "force-dynamic";

// Validar si se puede aprobar un corte (verificar documentación del subcontratista)
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
    const expiredDocs: { type: string; expirationDate: Date | null }[] = [];

    const now = new Date();

    requiredDocTypes?.forEach?.((docType) => {
      const doc = contractorDocs?.find?.((d) => d?.type === docType);
      if (!doc) {
        missingDocs.push(docType);
      } else if (doc?.expirationDate && new Date(doc?.expirationDate) < now) {
        expiredDocs.push({
          type: docType,
          expirationDate: doc?.expirationDate,
        });
      }
    });

    const canApprove = missingDocs?.length === 0 && expiredDocs?.length === 0;

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
    const exceedsBudget = (workCut?.requestedAmount ?? 0) > availableBudget;

    return NextResponse.json({
      canApprove: canApprove && !exceedsBudget,
      validation: {
        documentationOk: canApprove,
        missingDocs,
        expiredDocs,
        budgetOk: !exceedsBudget,
        availableBudget,
        requestedAmount: workCut?.requestedAmount,
      },
    });
  } catch (error) {
    console.error("Error validando corte:", error);
    return NextResponse.json(
      { error: "Error al validar corte" },
      { status: 500 }
    );
  }
}
