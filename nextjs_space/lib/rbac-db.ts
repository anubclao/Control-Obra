import { prisma } from "@/lib/db";
import { getDefaultMenuPermissionsForRole, normalizeMenuPermissions } from "@/lib/rbac";

interface AssignedRoleRow {
  accessRoleId: string;
  accessRoleName: string;
}

interface PermissionRow {
  menuKey: string;
}

export async function getAssignedAccessRoleForUser(userId: string): Promise<{ id: string; name: string } | null> {
  try {
    const rows = await prisma.$queryRaw<AssignedRoleRow[]>`
      SELECT ar.id AS accessRoleId, ar.name AS accessRoleName
      FROM UserAccessRole uar
      INNER JOIN AccessRole ar ON ar.id = uar.accessRoleId
      WHERE uar.userId = ${userId} AND ar.isActive = 1
      LIMIT 1
    `;

    if (!rows.length) return null;

    return {
      id: rows[0].accessRoleId,
      name: rows[0].accessRoleName,
    };
  } catch (error) {
    return null;
  }
}

export async function getEffectiveMenuPermissionsForUser(userId: string, legacyRole?: string | null): Promise<{
  permissions: string[];
  accessRoleId: string | null;
  accessRoleName: string | null;
}> {
  const fallbackPermissions = getDefaultMenuPermissionsForRole(legacyRole);

  try {
    const assignedRole = await getAssignedAccessRoleForUser(userId);
    if (!assignedRole) {
      return {
        permissions: fallbackPermissions,
        accessRoleId: null,
        accessRoleName: null,
      };
    }

    const permissionsRows = await prisma.$queryRaw<PermissionRow[]>`
      SELECT mp.menuKey
      FROM MenuPermission mp
      WHERE mp.accessRoleId = ${assignedRole.id} AND mp.allowed = 1
    `;

    const normalizedPermissions = normalizeMenuPermissions(
      permissionsRows.map((row) => row.menuKey)
    );

    return {
      permissions: normalizedPermissions.length ? normalizedPermissions : ["dashboard"],
      accessRoleId: assignedRole.id,
      accessRoleName: assignedRole.name,
    };
  } catch (error) {
    return {
      permissions: fallbackPermissions,
      accessRoleId: null,
      accessRoleName: null,
    };
  }
}
