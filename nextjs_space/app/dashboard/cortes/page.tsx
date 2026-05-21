import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import CortesClient from "./_components/cortes-client";

export const dynamic = "force-dynamic";

export default async function CortesPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const [workCuts, projects] = await Promise.all([
    prisma.workCut.findMany({
      include: {
        project: {
          select: {
            name: true,
          },
        },
        contractor: {
          select: {
            name: true,
            nit: true,
          },
        },
        costCenter: {
          select: {
            name: true,
          },
        },
        approvedBy: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            documents: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.project.findMany({
      where: {
        budget: { isNot: null },
      },
      select: {
        id: true,
        code: true,
        name: true,
        client: true,
        status: true,
        budget: {
          select: {
            id: true,
            totalPC: true,
            totalPT: true,
          },
        },
        dailyProgress: {
          orderBy: { date: "desc" },
          take: 1,
          select: {
            id: true,
            date: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <CortesClient
      workCuts={workCuts ?? []}
      projects={projects ?? []}
      userRole={(session?.user as any)?.role ?? ""}
    />
  );
}
