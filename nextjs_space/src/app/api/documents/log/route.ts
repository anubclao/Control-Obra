// filepath: src/app/api/documents/log/route.ts
// GET /api/documents/log?entity=...&entityId=...&limit=...
// Auth: requireAuth. Por defecto solo ve sus propios logs. ADMIN/GERENTE
// pueden ver los logs de cualquier usuario (para auditoría centralizada).
//
// H-2 fix: el endpoint antes dejaba ver a cualquier usuario autenticado
// el log completo (incluyendo webUrl + ip + user_agent de otros), lo que
// filtraba PII cross-tenant. Ahora se filtra por user_id salvo para
// roles privilegiados.

import { NextResponse } from "next/server";
import { requireAuth, authFailureResponse } from "@/lib/api-auth";
import { listLog } from "@/lib/document-generator/log";
import type { DocumentEntity } from "@/types/documents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_ENTITIES: ReadonlySet<DocumentEntity> = new Set<DocumentEntity>([
  "payments",
  "expenses",
  "cuts",
  "contracts",
  "employees",
  "workLogs",
]);

// Roles que pueden ver logs de todos los usuarios.
const PRIVILEGED_ROLES: ReadonlySet<string> = new Set([
  "ADMIN",
  "GERENTE",
  "DIRECTOR",
  "CONTABILIDAD",
]);

export async function GET(req: Request) {
  const auth = await requireAuth();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  if (!auth.ok) return fail!;

  const url = new URL(req.url);
  const entity = url.searchParams.get("entity");
  const entityId = url.searchParams.get("entityId");
  const limitStr = url.searchParams.get("limit");

  if (entity && !VALID_ENTITIES.has(entity as DocumentEntity)) {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: `entity inválido` },
      { status: 400 },
    );
  }
  const limit = limitStr
    ? Math.max(1, Math.min(Number(limitStr) || 50, 200))
    : 50;

  // Filtro de aislamiento: usuario normal solo ve sus propios logs.
  const isPrivileged = PRIVILEGED_ROLES.has(auth.user.role);
  const userIdFilter = isPrivileged ? undefined : auth.userId;

  try {
    const items = await listLog({
      entity: (entity as DocumentEntity) || undefined,
      entityId: entityId || undefined,
      userId: userIdFilter,
      limit,
    });
    return NextResponse.json(items);
  } catch (e: any) {
    console.error("[documents log GET]", e?.code, e?.message);
    return NextResponse.json(
      { error: "INTERNAL", message: "Error al consultar el log" },
      { status: 500 },
    );
  }
}
