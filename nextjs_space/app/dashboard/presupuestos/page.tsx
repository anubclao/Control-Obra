import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";
import { PresupuestosClient } from "./_components/presupuestos-client";

export const dynamic = "force-dynamic";

export default async function PresupuestosPage() {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role || "USER";

  // Obtener proyectos con sus presupuestos
  const projects = await prisma.project.findMany({
    include: {
      budget: {
        include: {
          versions: {
            where: { isActive: true },
            take: 1,
          },
          layers: {
            include: {
              _count: {
                select: { items: true },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Calcular estadísticas
  const projectsWithBudget = projects.filter((p: any) => p.budget !== null);
  const projectsWithoutBudget = projects.filter((p: any) => p.budget === null);

  const totalPC = projectsWithBudget.reduce(
    (sum: number, p: any) => sum + (p.budget?.totalPC || 0),
    0
  );
  const totalPT = projectsWithBudget.reduce(
    (sum: number, p: any) => sum + (p.budget?.totalPT || 0),
    0
  );

  // Contar items por estado
  let totalItems = 0;
  projectsWithBudget.forEach((p: any) => {
    p.budget?.layers.forEach((l: any) => {
      totalItems += l._count.items;
    });
  });

  const stats = {
    withBudget: projectsWithBudget.length,
    withoutBudget: projectsWithoutBudget.length,
    totalPC,
    totalPT,
    totalItems,
  };

  return (
    <PresupuestosClient
      projects={projects}
      stats={stats}
      userRole={userRole}
    />
  );
}
