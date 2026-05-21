import { prisma } from "@/lib/db";
import { REQUIRED_CONTRACTOR_DOCUMENTS } from "@/lib/constants";

type ContractorDocLike = {
  type: string;
  expirationDate?: Date | null;
};

export function resolveContractorStatus(documents: ContractorDocLike[]): "COMPLETE" | "INCOMPLETE" | "EXPIRED" {
  const existingDocs = documents.map((d) => d.type);
  const hasAllRequired = REQUIRED_CONTRACTOR_DOCUMENTS.every((docType) =>
    existingDocs.includes(docType)
  );

  if (!hasAllRequired) {
    return "INCOMPLETE";
  }

  const now = Date.now();
  const hasExpired = documents.some((doc) => {
    if (!doc.expirationDate) return false;
    return new Date(doc.expirationDate).getTime() < now;
  });

  if (hasExpired) {
    return "EXPIRED";
  }

  return "COMPLETE";
}

export async function syncContractorStatus(contractorId: string): Promise<"COMPLETE" | "INCOMPLETE" | "EXPIRED"> {
  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
    select: {
      id: true,
      status: true,
      documents: {
        select: {
          type: true,
          expirationDate: true,
        },
      },
    },
  });

  if (!contractor) {
    throw new Error("Subcontratista no encontrado");
  }

  const resolvedStatus = resolveContractorStatus(contractor.documents);

  if (contractor.status !== resolvedStatus) {
    await prisma.contractor.update({
      where: { id: contractorId },
      data: { status: resolvedStatus },
    });
  }

  return resolvedStatus;
}
