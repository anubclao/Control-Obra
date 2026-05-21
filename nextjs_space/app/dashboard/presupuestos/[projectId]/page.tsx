import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { PresupuestoDetailClient } from "./_components/presupuesto-detail-client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { projectId: string };
}

export default async function PresupuestoDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role || "USER";

  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: {
      budget: {
        include: {
          versions: {
            orderBy: { createdAt: "desc" },
          },
          layers: {
            orderBy: { order: "asc" },
            include: {
              items: {
                orderBy: { itemNumber: "asc" },
              },
            },
          },
        },
      },
      budgetFiles: {
        orderBy: { uploadedAt: "desc" },
      },
    },
  });

  if (!project) {
    notFound();
  }

  // Calcular estadísticas de items
  let greenCount = 0;
  let yellowCount = 0;
  let redCount = 0;
  let totalItems = 0;

  if (project.budget) {
    project.budget.layers.forEach((layer: any) => {
      layer.items.forEach((item: any) => {
        totalItems++;
        if (item.status === "GREEN") greenCount++;
        else if (item.status === "YELLOW") yellowCount++;
        else if (item.status === "RED") redCount++;
      });
    });
  }

  const itemStats = {
    total: totalItems,
    green: greenCount,
    yellow: yellowCount,
    red: redCount,
  };

  // Obtener todos los proyectos para el dialog de importar
  const allProjects = await prisma.project.findMany({
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  return (
    <PresupuestoDetailClient
      project={project}
      itemStats={itemStats}
      userRole={userRole}
      allProjects={allProjects}
    />
  );
}
