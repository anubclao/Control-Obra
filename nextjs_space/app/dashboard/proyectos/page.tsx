import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { redirect } from "next/navigation";
import ProyectosClient from "./_components/proyectos-client";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProyectosPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  // Obtener proyectos con información agregada
  const projects = await prisma.project.findMany({
    include: {
      createdBy: {
        select: {
          name: true,
        },
      },
      costCenters: true,
      _count: {
        select: {
          workCuts: true,
          workLogs: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Calcular gasto total por proyecto
  const projectsWithSpent = await Promise.all(
    projects?.map?.(async (project) => {
      const approvedCuts = await prisma.workCut.findMany({
        where: {
          projectId: project?.id,
          status: "APPROVED",
        },
      });

      const totalSpent = approvedCuts?.reduce?.(
        (sum, cut) => sum + (cut?.requestedAmount ?? 0),
        0
      ) ?? 0;

      return {
        ...project,
        totalSpent,
      };
    }) ?? []
  );

  return (
    <ProyectosClient
      projects={projectsWithSpent ?? []}
      userRole={(session?.user as any)?.role ?? ""}
    />
  );
}
