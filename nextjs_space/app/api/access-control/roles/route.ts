import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";
import { MENU_PERMISSION_CATALOG } from "@/lib/rbac";
import { ROLES_CAN_INVITE } from "@/lib/constants";

interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  isActive: number;
  isSystem: number;
  createdAt: Date;
  usersCount: number;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!ROLES_CAN_INVITE.includes(session.user.role as any)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    let rows = await prisma.$queryRaw<RoleRow[]>`
      SELECT id, name, description, isActive, isSystem, createdAt, usersCount
      FROM v_access_role_summary
      ORDER BY createdAt DESC
    `;

    if (!rows.length) {
      rows = await prisma.$queryRaw<RoleRow[]>`
        SELECT
          ar.id,
          ar.name,
          ar.description,
          ar.isActive,
          ar.isSystem,
          ar.createdAt,
          COUNT(uar.userId) AS usersCount
        FROM AccessRole ar
        LEFT JOIN UserAccessRole uar ON uar.accessRoleId = ar.id
        GROUP BY ar.id, ar.name, ar.description, ar.isActive, ar.isSystem, ar.createdAt
        ORDER BY ar.createdAt DESC
      `;
    }

    return NextResponse.json(
      rows.map((row) => ({
        ...row,
        usersCount: Number(row.usersCount || 0),
        isActive: Boolean(row.isActive),
        isSystem: Boolean(row.isSystem),
      }))
    );
  } catch (error) {
    console.error("Error fetching access roles:", error);
    return NextResponse.json(
      { error: "Error al obtener roles. Ejecuta primero la migracion de access control." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!ROLES_CAN_INVITE.includes(session.user.role as any)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const body = await request.json();
    const name = String(body?.name || "").trim();
    const description = String(body?.description || "").trim() || null;

    if (!name) {
      return NextResponse.json({ error: "El nombre del rol es obligatorio" }, { status: 400 });
    }

    const existing = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM AccessRole WHERE LOWER(name) = LOWER(${name}) LIMIT 1
    `;

    if (existing.length) {
      return NextResponse.json({ error: "Ya existe un rol con ese nombre" }, { status: 409 });
    }

    const roleId = `ar_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO AccessRole (id, name, description, isActive, isSystem, createdAt, updatedAt)
        VALUES (${roleId}, ${name}, ${description}, 1, 0, NOW(), NOW())
      `;

      for (const menu of MENU_PERMISSION_CATALOG) {
        const permissionId = `mp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${menu.key}`;
        await tx.$executeRaw`
          INSERT INTO MenuPermission (id, accessRoleId, menuKey, allowed, createdAt, updatedAt)
          VALUES (${permissionId}, ${roleId}, ${menu.key}, 0, NOW(), NOW())
        `;
      }
    });

    return NextResponse.json({ id: roleId, name, description }, { status: 201 });
  } catch (error) {
    console.error("Error creating access role:", error);
    return NextResponse.json(
      { error: "Error al crear rol. Verifica que la migracion de access control este aplicada." },
      { status: 500 }
    );
  }
}
