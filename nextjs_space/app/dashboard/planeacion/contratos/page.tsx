import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";
import { ContratosClient } from "./_components/contratos-client";

export const dynamic = "force-dynamic";

export default async function ContratosPage() {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role || "USER";

  // Obtener contratos
  const contracts = await prisma.contract.findMany({
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
  const stats = {
    total: contracts.length,
    draft: contracts.filter((c: any) => c.status === "DRAFT").length,
    enabled: contracts.filter((c: any) => c.status === "ENABLED").length,
    closed: contracts.filter((c: any) => c.status === "CLOSED").length,
    totalValue: contracts.reduce((sum: number, c: any) => sum + c.contractValue, 0),
  };

  // Obtener proyectos para el selector
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      code: true,
    },
    orderBy: { name: "asc" },
  });

  // Obtener contratistas para el selector
  const contractors = await prisma.contractor.findMany({
    select: {
      id: true,
      name: true,
      nit: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <ContratosClient
      contracts={contracts}
      stats={stats}
      projects={projects}
      contractors={contractors}
      userRole={userRole}
    />
  );
}
