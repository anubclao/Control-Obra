import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import CorteDetailsClient from "./_components/corte-details-client";
import { DocumentType } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function CorteDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
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
    notFound();
  }

  // Validar documentación del subcontratista
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

  const documentationOk = missingDocs?.length === 0 && expiredDocs?.length === 0;

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
  const budgetOk = (workCut?.requestedAmount ?? 0) <= availableBudget;

  return (
    <CorteDetailsClient
      workCut={workCut}
      validation={{
        documentationOk,
        missingDocs,
        expiredDocs,
        budgetOk,
        availableBudget,
      }}
      userRole={(session?.user as any)?.role ?? ""}
    />
  );
}
