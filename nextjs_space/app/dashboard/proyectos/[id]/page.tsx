import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import ProyectoDetailsClient from "./_components/proyecto-details-client";

export const dynamic = "force-dynamic";

export default async function ProyectoDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const project = await prisma.project.findUnique({
    where: { id: params?.id },
    include: {
      createdBy: {
        select: {
          name: true,
          email: true,
        },
      },
      costCenters: {
        include: {
          workCuts: {
            where: {
              status: "APPROVED",
            },
          },
          _count: {
            select: {
              workCuts: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      workCuts: {
        where: {
          status: "APPROVED",
        },
        include: {
          contractor: true,
          costCenter: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      },
      workLogs: {
        include: {
          createdBy: {
            select: {
              name: true,
            },
          },
          contractor: true,
        },
        orderBy: {
          date: "desc",
        },
        take: 5,
      },
    },
  });

  if (!project) {
    notFound();
  }

  // Calcular datos para el dashboard
  const costCentersWithSpent = project?.costCenters?.map?.((cc) => {
    const spent = cc?.workCuts?.reduce?.(
      (sum, wc) => sum + (wc?.requestedAmount ?? 0),
      0
    ) ?? 0;
    return {
      ...cc,
      spentAmount: spent,
    };
  }) ?? [];

  const totalSpent = costCentersWithSpent?.reduce?.(
    (sum, cc) => sum + (cc?.spentAmount ?? 0),
    0
  ) ?? 0;

  return (
    <ProyectoDetailsClient
      project={{
        ...project,
        costCenters: costCentersWithSpent,
      }}
      totalSpent={totalSpent}
      userRole={(session?.user as any)?.role ?? ""}
    />
  );
}
