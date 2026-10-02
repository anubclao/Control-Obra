export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/**
 * CRUD: /api/work-logs  — bitácora diaria de obra
 * Constraint UNIQUE(project_id, date) → usar UPSERT.
 */
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  requireAuth,
  requireRole,
  requireAdmin,
  authFailureResponse,
  type AuthSuccess,
} from "@/lib/api-auth";
import { can } from "@/lib/permissions-matrix";

function r(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    date: row.date,
    weather: row.weather,
    temperature: row.temperature != null ? Number(row.temperature) : null,
    workersCount: row.workers_count,
    activities: row.activities,
    incidents: row.incidents ?? "",
    materials: row.materials ?? "",
    observations: row.observations ?? "",
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
  };
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  // P0 (seccion 4.4): gate por matriz. CLIENTE/USER -> 403.
  if (!can((auth as any).user.role, "work_logs", "read")) {
    return NextResponse.json(
      { error: "No tienes permisos para ver bitacoras" },
      { status: 403 },
    );
  }
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const where = projectId ? "WHERE project_id = ?" : "";
    const args = projectId ? [projectId] : [];
    const rows = await query<any[]>(
      `SELECT * FROM work_logs ${where} ORDER BY date DESC`,
      args,
    );
    return NextResponse.json(rows.map(r));
  } catch (e: any) {
    console.error("[work-logs GET]", e?.code, e?.message);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireRole(
    "ADMIN",
    "GERENTE",
    "DIRECTOR",
    "RESIDENTE",
    "CONTABILIDAD",
    "TESORERIA",
    "HSEQ",
  );
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const body = await req.json();
    if (
      !body?.projectId ||
      !body?.date ||
      !body?.weather ||
      !body?.activities
    ) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 },
      );
    }
    // P1 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.2):
    //   Antes `body.createdBy ?? "system"` permitia que la UI firmara la
    //   bitacora como cualquier cosa. Ahora la identidad sale SIEMPRE
    //   de la sesion; el body se ignora salvo para datos del registro.
    const { user, userId } = auth as AuthSuccess;
    const id = randomUUID();
    await query(
      `INSERT INTO work_logs
       (id, project_id, date, weather, temperature, workers_count,
        activities, incidents, materials, observations, created_by, created_by_name,
        updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        body.projectId,
        body.date,
        body.weather,
        body.temperature ?? null,
        Number(body.workersCount ?? 0),
        body.activities,
        body.incidents ?? null,
        body.materials ?? null,
        body.observations ?? null,
        userId,
        user.name,
        userId,
      ],
    );
    return NextResponse.json(
      { id, ...body, createdBy: userId, createdByName: user.name },
      { status: 201 },
    );
  } catch (e: any) {
    console.error("[work-logs POST]", e?.code, e?.message);
    if (e?.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { error: "Ya existe una bitácora para esta fecha y proyecto" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Error al crear bitácora" },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  const auth = await requireRole(
    "ADMIN",
    "GERENTE",
    "DIRECTOR",
    "RESIDENTE",
    "CONTABILIDAD",
    "TESORERIA",
    "HSEQ",
  );
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const body = await req.json();
    if (!body?.id)
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    const { userId } = auth as AuthSuccess;
    const m: Record<string, string> = {
      date: "date",
      weather: "weather",
      temperature: "temperature",
      workersCount: "workers_count",
      activities: "activities",
      incidents: "incidents",
      materials: "materials",
      observations: "observations",
    };
    const sets: string[] = [];
    const args: any[] = [];
    for (const [k, c] of Object.entries(m)) {
      if (body[k] !== undefined) {
        sets.push(`${c} = ?`);
        args.push(k === "workersCount" ? Number(body[k]) : body[k]);
      }
    }
    // P1: registrar quien edita. updated_at se actualiza solo por
    // ON UPDATE CURRENT_TIMESTAMP (migracion 011).
    sets.push("updated_by = ?");
    args.push(userId);
    if (!body || !body.id)
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    args.push(body.id);
    await query(`UPDATE work_logs SET ${sets.join(", ")} WHERE id = ?`, args);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[work-logs PUT]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id)
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    await query("DELETE FROM work_logs WHERE id = ?", [id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[work-logs DELETE]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
