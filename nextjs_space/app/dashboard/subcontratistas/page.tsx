import { prisma } from "@/lib/db";
import { SubcontratistasClient } from "./_components/subcontratistas-client";
import { syncContractorStatus } from "@/lib/contractor-status";

export const dynamic = "force-dynamic";

export default async function SubcontratistasPage() {
  const contractors = await prisma.contractor.findMany({
    include: {
      documents: true,
      _count: {
        select: {
          workCuts: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Actualizar estados de subcontratistas
  for (const contractor of contractors) {
    await syncContractorStatus(contractor.id);
  }

  // Re-fetch con estados actualizados
  const updatedContractors = await prisma.contractor.findMany({
    include: {
      documents: true,
      _count: {
        select: {
          workCuts: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return <SubcontratistasClient contractors={updatedContractors} />;
}
