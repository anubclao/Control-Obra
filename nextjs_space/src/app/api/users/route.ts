export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * CRUD: /api/users — usuarios del sistema
 *
 * Spec: docs/specs/admin-user-authorization-with-otp.md
 * Migración SQL: database/mysql/migrations/002_user_authorization.sql
 *
 * Esquema esperado (post-migración):
 *   id, email, name, role, area, avatar_url,
 *   status ENUM('PENDING','ACTIVE','SUSPENDED') DEFAULT 'ACTIVE',
 *   project_id, created_by, authorized_by, authorized_at,
 *   suspended_by, suspended_at, last_login_at,
 *   is_active, created_at, updated_at
 *
 * Esta ruta reemplaza el endpoint legacy para soportar el nuevo ciclo de vida
 * controlado por el Super Admin (rol ADMIN).
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { rowToAuthorizedUser } from "@/lib/admin-users";
import type { AuthorizedUser, AuthorizedUserStatus } from "@/types";

function isAuthorizedUserStatus(v: unknown): v is AuthorizedUserStatus {
  return v === "PENDING" || v === "ACTIVE" || v === "SUSPENDED";
}

// =============================================================================
// GET — listar todos los usuarios autorizados
// =============================================================================
export async function GET() {
  try {
    const rows = await query<any[]>(
      `SELECT * FROM users ORDER BY name ASC`,
    );
    const users: AuthorizedUser[] = rows.map(rowToAuthorizedUser);
    return NextResponse.json(users);
  } catch (e: any) {
    console.error("[users GET]", e?.code, e?.message);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// =============================================================================
// POST — crear usuario autorizado (status inicial PENDING)
// =============================================================================
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const name = String(body?.name ?? "").trim();
    const role = body?.role;
    const area = body?.area;
    const projectId = body?.projectId ?? null;
    const createdBy = String(body?.createdBy ?? "").trim();

    if (!email || !name || !role || !area || !createdBy) {
      return NextResponse.json(
        { error: "email, name, role, area y createdBy son requeridos" },
        { status: 400 },
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Correo no válido" }, { status: 400 });
    }

    const id = require("crypto").randomUUID();

    await query(
      `INSERT INTO users
         (id, email, name, role, area, project_id, status, is_active,
          created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, NOW())`,
      [id, email, name, role, area, projectId, createdBy],
    );

    const rows = await query<any[]>(`SELECT * FROM users WHERE id = ?`, [id]);
    const user: AuthorizedUser = rowToAuthorizedUser(rows[0]);
    return NextResponse.json(user, { status: 201 });
  } catch (e: any) {
    console.error("[users POST]", e?.code, e?.message);
    if (e?.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { error: "Este correo ya está registrado" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Error al crear usuario" },
      { status: 500 },
    );
  }
}

// =============================================================================
// PATCH — actualizar campos (status, role, area, projectId)
// =============================================================================
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const id = String(body?.id ?? "").trim();
    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }
    const sets: string[] = [];
    const args: unknown[] = [];

    if (body.status !== undefined) {
      if (!isAuthorizedUserStatus(body.status)) {
        return NextResponse.json(
          { error: "status inválido" },
          { status: 400 },
        );
      }
      sets.push("status = ?");
      args.push(body.status);
      // Mantener is_active sincronizado por compatibilidad legacy.
      sets.push("is_active = ?");
      args.push(body.status === "ACTIVE" ? 1 : 0);

      // Auditoría de transición.
      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      if (body.status === "ACTIVE") {
        sets.push("authorized_by = ?");
        args.push(body.authorizedBy ?? null);
        sets.push("authorized_at = ?");
        args.push(now);
        sets.push("suspended_by = NULL");
        sets.push("suspended_at = NULL");
      } else if (body.status === "SUSPENDED") {
        sets.push("suspended_by = ?");
        args.push(body.suspendedBy ?? null);
        sets.push("suspended_at = ?");
        args.push(now);
      } else if (body.status === "PENDING") {
        sets.push("authorized_by = NULL");
        sets.push("authorized_at = NULL");
        sets.push("suspended_by = NULL");
        sets.push("suspended_at = NULL");
      }
    }

    if (body.name !== undefined) {
      sets.push("name = ?");
      args.push(String(body.name).trim());
    }
    if (body.role !== undefined) {
      sets.push("role = ?");
      args.push(body.role);
    }
    if (body.area !== undefined) {
      sets.push("area = ?");
      args.push(body.area);
    }
    if (body.projectId !== undefined) {
      sets.push("project_id = ?");
      args.push(body.projectId ?? null);
    }

    if (!sets.length) {
      return NextResponse.json(
        { error: "Nada que actualizar" },
        { status: 400 },
      );
    }

    args.push(id);
    await query(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, args);

    const rows = await query<any[]>(`SELECT * FROM users WHERE id = ?`, [id]);
    if (!rows.length) {
      return NextResponse.json({ error: "Usuario no existe" }, { status: 404 });
    }
    return NextResponse.json(rowToAuthorizedUser(rows[0]));
  } catch (e: any) {
    console.error("[users PATCH]", e?.code, e?.message);
    return NextResponse.json(
      { error: "Error al actualizar" },
      { status: 500 },
    );
  }
}

// =============================================================================
// PUT — compatibilidad legacy con la firma anterior (acepta isActive)
// =============================================================================
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    if (!body?.id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }
    const sets: string[] = [];
    const args: unknown[] = [];
    for (const k of ["name", "role", "area"]) {
      if (body[k] !== undefined) {
        sets.push(`${k} = ?`);
        args.push(body[k]);
      }
    }
    if (body.isActive !== undefined) {
      sets.push("is_active = ?");
      args.push(body.isActive ? 1 : 0);
    }
    if (!sets.length) {
      return NextResponse.json(
        { error: "Nada que actualizar" },
        { status: 400 },
      );
    }
    args.push(body.id);
    await query(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, args);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[users PUT]", e?.code, e?.message);
    return NextResponse.json(
      { error: "Error al actualizar" },
      { status: 500 },
    );
  }
}

// =============================================================================
// DELETE — eliminar usuario (solo si no tiene historial)
// =============================================================================
export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }
    // Verificar que no tenga historial crítico.
    const counts = await query<any[]>(
      `SELECT
         (SELECT COUNT(*) FROM work_cuts        WHERE created_by  = ?) AS cuts,
         (SELECT COUNT(*) FROM payment_requests WHERE created_by  = ?) AS payments,
         (SELECT COUNT(*) FROM contracts        WHERE created_by  = ?) AS contracts,
         (SELECT COUNT(*) FROM expenses         WHERE created_by  = ?) AS expenses,
         (SELECT COUNT(*) FROM work_logs        WHERE created_by  = ?) AS logs`,
      [id, id, id, id, id],
    );
    const row = counts[0] ?? {};
    const total =
      Number(row.cuts) + Number(row.payments) + Number(row.contracts) +
      Number(row.expenses) + Number(row.logs);
    if (total > 0) {
      return NextResponse.json(
        {
          error:
            "No se puede eliminar: el usuario tiene historial (cortes, pagos, contratos, gastos o bitácora). Usa Suspender.",
        },
        { status: 409 },
      );
    }
    await query(`DELETE FROM users WHERE id = ?`, [id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[users DELETE]", e?.code, e?.message);
    return NextResponse.json(
      { error: "Error al eliminar" },
      { status: 500 },
    );
  }
}
