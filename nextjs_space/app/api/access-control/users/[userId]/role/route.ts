import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";
import { ROLES_CAN_INVITE } from "@/lib/constants";

export async function PUT(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!ROLES_CAN_INVITE.includes(session.user.role as any)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const body = await request.json();
    const accessRoleId = body?.accessRoleId ? String(body.accessRoleId) : null;

    if (accessRoleId) {
      const roleExists = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM AccessRole
        WHERE id = ${accessRoleId} AND isActive = 1
        LIMIT 1
      `;

      if (!roleExists.length) {
        return NextResponse.json({ error: "Rol de acceso no valido" }, { status: 400 });
      }
    }

    const userExists = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true },
    });

    if (!userExists) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    let assignedWithProcedure = false;
    try {
      await prisma.$executeRaw`
        CALL sp_assign_user_access_role(${params.userId}, ${accessRoleId}, ${session.user.id})
      `;
      assignedWithProcedure = true;
    } catch (_error) {
      assignedWithProcedure = false;
    }

    if (!assignedWithProcedure) {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          DELETE FROM UserAccessRole
          WHERE userId = ${params.userId}
        `;

        if (accessRoleId) {
          const assignmentId = `uar_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          await tx.$executeRaw`
            INSERT INTO UserAccessRole (id, userId, accessRoleId, assignedAt, assignedById)
            VALUES (${assignmentId}, ${params.userId}, ${accessRoleId}, NOW(), ${session.user.id})
          `;
        }
      });
    }

    return NextResponse.json({ ok: true, userId: params.userId, accessRoleId });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al asignar rol de acceso al usuario" },
      { status: 500 }
    );
  }
}
