import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { ContratoDetails } from "./_components/contrato-details";

export const dynamic = "force-dynamic";

interface Props {
  params: { contractId: string };
}

export default async function ContratoDetailPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role || "USER";

  const contract = await prisma.contract.findUnique({
    where: { id: params.contractId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          code: true,
          client: true,
          budget: {
            select: {
              totalPC: true,
              totalPT: true,
            },
          },
        },
      },
      contractor: {
        select: {
          id: true,
          name: true,
          nit: true,
          email: true,
          phone: true,
          contact: true,
          status: true,
        },
      },
      documents: {
        orderBy: { uploadedAt: "desc" },
      },
    },
  });

  if (!contract) {
    notFound();
  }

  return <ContratoDetails contract={contract} userRole={userRole} />;
}
