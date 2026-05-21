import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import BitacoraClient from "./_components/bitacora-client";

export const dynamic = "force-dynamic";

export default async function BitacoraPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const workLogs = await prisma.workLog.findMany({
    include: {
      project: {
        select: {
          name: true,
        },
      },
      contractor: {
        select: {
          name: true,
        },
      },
      createdBy: {
        select: {
          name: true,
          email: true,
        },
      },
      _count: {
        select: {
          photos: true,
        },
      },
    },
    orderBy: {
      date: "desc",
    },
  });

  return (
    <BitacoraClient
      workLogs={workLogs ?? []}
      userRole={(session?.user as any)?.role ?? ""}
    />
  );
}
