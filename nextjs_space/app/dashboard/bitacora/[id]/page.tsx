import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import BitacoraDetailsClient from "./_components/bitacora-details-client";

export const dynamic = "force-dynamic";

export default async function BitacoraDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const workLog = await prisma.workLog.findUnique({
    where: { id: params?.id },
    include: {
      project: true,
      contractor: true,
      createdBy: {
        select: {
          name: true,
          email: true,
        },
      },
      photos: {
        orderBy: {
          uploadedAt: "asc",
        },
      },
    },
  });

  if (!workLog) {
    notFound();
  }

  // Verificar permisos de edición
  const isSameDay =
    new Date(workLog?.date).toDateString() === new Date().toDateString();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const isOwner = workLog?.createdById === session?.user?.id;
  const canEdit = isAdmin || (isOwner && isSameDay);

  return (
    <BitacoraDetailsClient
      workLog={workLog}
      userRole={(session?.user as any)?.role ?? ""}
      userId={session?.user?.id ?? ""}
      canEdit={canEdit}
    />
  );
}
