import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { UsuariosClient } from "./_components/usuarios-client";
import { ROLES_CAN_INVITE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const session = await getServerSession(authOptions);
  
  if (!session || !ROLES_CAN_INVITE.includes(session.user.role as any)) {
    redirect("/dashboard");
  }

  // Obtener usuarios
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      isActive: true,
      createdAt: true,
      projectAssignments: {
        include: {
          project: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  let accessRoleRows: { userId: string; accessRoleId: string; accessRoleName: string }[] = [];
  try {
    accessRoleRows = await prisma.$queryRaw<
      { userId: string; accessRoleId: string; accessRoleName: string }[]
    >`
      SELECT uar.userId, ar.id AS accessRoleId, ar.name AS accessRoleName
      FROM UserAccessRole uar
      INNER JOIN AccessRole ar ON ar.id = uar.accessRoleId
      WHERE ar.isActive = 1
    `;
  } catch (error) {
    accessRoleRows = [];
  }

  const accessRoleByUser = new Map(
    accessRoleRows.map((row) => [row.userId, row])
  );

  const usersWithAccessRole = users.map((user) => ({
    ...user,
    accessRoleId: accessRoleByUser.get(user.id)?.accessRoleId || null,
    accessRoleName: accessRoleByUser.get(user.id)?.accessRoleName || null,
  }));

  // Obtener invitaciones activas
  const invitations = await prisma.invitation.findMany({
    where: { isActive: true },
    include: {
      createdBy: { select: { name: true } },
      usedBy: { select: { name: true, email: true } },
      project: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Obtener proyectos para el selector
  const projects = await prisma.project.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  let accessRoles: { id: string; name: string; isActive: number }[] = [];
  try {
    accessRoles = await prisma.$queryRaw<
      { id: string; name: string; isActive: number }[]
    >`
      SELECT id, name, isActive
      FROM AccessRole
      WHERE isActive = 1
      ORDER BY name ASC
    `;
  } catch (error) {
    accessRoles = [];
  }

  return (
    <UsuariosClient
      users={usersWithAccessRole}
      invitations={invitations}
      projects={projects}
      accessRoles={accessRoles.map((role) => ({ ...role, isActive: Boolean(role.isActive) }))}
      currentUserRole={session.user.role}
    />
  );
}
