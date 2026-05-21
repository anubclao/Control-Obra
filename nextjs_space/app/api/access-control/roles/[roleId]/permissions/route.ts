import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";
import { MENU_PERMISSION_CATALOG, normalizeMenuPermissions } from "@/lib/rbac";
import { ROLES_CAN_INVITE } from "@/lib/constants";

interface PermissionRow {
  menuKey: string;
  allowed: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { roleId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!ROLES_CAN_INVITE.includes(session.user.role as any)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const rows = await prisma.$queryRaw<PermissionRow[]>`
      SELECT menuKey, allowed
      FROM MenuPermission
      WHERE accessRoleId = ${params.roleId}
    `;

    const allowedSet = new Set(
      rows.filter((row) => Boolean(row.allowed)).map((row) => row.menuKey)
    );

    return NextResponse.json(
      MENU_PERMISSION_CATALOG.map((item) => ({
        ...item,
        allowed: allowedSet.has(item.key),
      }))
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Error al obtener permisos del rol" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { roleId: string } }
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
    const allowedPermissions = normalizeMenuPermissions(
      Array.isArray(body?.permissions) ? body.permissions : []
    );

    const exists = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM AccessRole WHERE id = ${params.roleId} LIMIT 1
    `;

    if (!exists.length) {
      return NextResponse.json({ error: "Rol no encontrado" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        DELETE FROM MenuPermission
        WHERE accessRoleId = ${params.roleId}
      `;

      for (const menuItem of MENU_PERMISSION_CATALOG) {
        const permissionId = `mp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${menuItem.key}`;
        const isAllowed = allowedPermissions.includes(menuItem.key) ? 1 : 0;

        await tx.$executeRaw`
          INSERT INTO MenuPermission (id, accessRoleId, menuKey, allowed, createdAt, updatedAt)
          VALUES (${permissionId}, ${params.roleId}, ${menuItem.key}, ${isAllowed}, NOW(), NOW())
        `;
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al actualizar permisos del rol" },
      { status: 500 }
    );
  }
}
