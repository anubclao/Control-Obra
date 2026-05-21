import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { SubcontratistaDetails } from "./_components/subcontratista-details";
import { calculateDaysUntil } from "@/lib/format";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { syncContractorStatus } from "@/lib/contractor-status";

export const dynamic = "force-dynamic";

export default async function SubcontratistaDetailsPage({
  params,
}: {
  params: { contractorId: string };
}) {
  const { contractorId } = params;

  const session = await getServerSession(authOptions);
  await syncContractorStatus(contractorId);

  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
    include: {
      documents: {
        orderBy: { uploadedAt: "desc" },
      },
      workCuts: {
        include: {
          project: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!contractor) {
    notFound();
  }

  // Calcular alertas de documentos
  const documentAlerts = contractor.documents
    .filter((doc) => doc.expirationDate)
    .map((doc) => {
      const daysUntil = calculateDaysUntil(doc.expirationDate!);
      return {
        ...doc,
        daysUntil,
        isExpired: daysUntil < 0,
        isExpiringSoon: daysUntil >= 0 && daysUntil <= 30,
      };
    });

  return (
    <SubcontratistaDetails
      contractor={contractor}
      documentAlerts={documentAlerts}
      userRole={(session?.user as any)?.role}
    />
  );
}
