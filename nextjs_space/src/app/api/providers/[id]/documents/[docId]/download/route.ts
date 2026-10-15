// filepath: src/app/api/providers/[id]/documents/[docId]/download/route.ts
// GET /api/providers/[id]/documents/[docId]/download
// Auth: requireAuth + requireRole(ADMIN, GERENTE, DIRECTOR, RESIDENTE)
//
// Responses:
//   302: redirect a file_url de SharePoint
//   401: { error: "UNAUTHENTICATED" }
//   403: { error: "FORBIDDEN" }
//   404: { error: "DOCUMENT_NOT_FOUND" }
//
// Decisión MVP: 302 redirect a file_url (no proxy). El cliente (browser)
// hace el GET. SharePoint valida el link. Si en el futuro el link es
// privado, podemos cambiar a proxy via Graph API con token de la app.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  requireAuth,
  requireRole,
  authFailureResponse,
} from "@/lib/api-auth";
import { query } from "@/lib/db";

const ALLOWED_ROLES = [
  "ADMIN",
  "GERENTE",
  "DIRECTOR",
  "RESIDENTE",
] as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
): Promise<NextResponse> {
  // 1. Auth
  const auth = await requireAuth();
  if (auth.ok === false) {
    return NextResponse.json(
      { error: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  // 2. Role check
  const roleAuth = await requireRole(...ALLOWED_ROLES);
  if (roleAuth.ok === false) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  // 3. Parsear providerId y docId de la URL
  const { id: providerId, docId } = await params;
  if (!providerId || !docId) {
    return NextResponse.json(
      { error: "DOCUMENT_NOT_FOUND" },
      { status: 404 },
    );
  }

  // 4. Buscar el documento (verificar que pertenece al provider)
  const rows = await query<any[]>(
    `SELECT id, provider_id, file_url
     FROM provider_documents
     WHERE id = ? AND provider_id = ?
     LIMIT 1`,
    [docId, providerId],
  );

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "DOCUMENT_NOT_FOUND" },
      { status: 404 },
    );
  }

  // 5. Redirigir al file_url de SharePoint (302)
  return NextResponse.redirect(rows[0].file_url, 302);
}
