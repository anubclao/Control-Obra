// filepath: src/app/api/providers/[id]/documents/route.ts
// POST /api/providers/[id]/documents
// Auth: requireAuth + requireRole(ADMIN, GERENTE, DIRECTOR, RESIDENTE)
// Body: multipart/form-data (file, type, expirationDate)
//
// Responses:
//   201: { id, type, fileName, uploadedAt, expirationDate }  (sin file_url)
//   400: { error: "FILE_REQUIRED" | "TYPE_REQUIRED" | "INVALID_MULTIPART" }
//   401: { error: "UNAUTHENTICATED" }
//   403: { error: "FORBIDDEN" }  (rol no autorizado)
//   404: { error: "PROVIDER_NOT_FOUND" | "DOCUMENT_NOT_FOUND" }
//   413: { error: "FILE_TOO_LARGE" }
//   415: { error: "INVALID_CONTENT_TYPE" }
//   500: { error: "SHAREPOINT_CONFIG_MISSING" | "SHAREPOINT_UPLOAD_FAILED" | "DB_ERROR" }

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  requireAuth,
  requireRole,
  authFailureResponse,
} from "@/lib/api-auth";
import { uploadProviderDocument } from "@/lib/providers-documents/service";

const ALLOWED_ROLES = [
  "ADMIN",
  "GERENTE",
  "DIRECTOR",
  "RESIDENTE",
] as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
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

  // 3. Parsear providerId de la URL
  const { id: providerId } = await params;
  if (!providerId) {
    return NextResponse.json(
      { error: "PROVIDER_NOT_FOUND", message: "Provider no encontrado." },
      { status: 404 },
    );
  }

  // 4. Parsear multipart/form-data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "INVALID_MULTIPART", message: "El cuerpo no es multipart/form-data válido." },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "FILE_REQUIRED", message: "Falta el archivo (campo 'file')." },
      { status: 400 },
    );
  }
  const documentType = formData.get("type");
  if (typeof documentType !== "string" || !documentType) {
    return NextResponse.json(
      { error: "TYPE_REQUIRED", message: "Falta el tipo (campo 'type')." },
      { status: 400 },
    );
  }
  const expirationDateRaw = formData.get("expirationDate");
  const expirationDate =
    typeof expirationDateRaw === "string" && expirationDateRaw
      ? expirationDateRaw
      : undefined;

  // 5. Validar ANTES de llamar al service para tener status codes literales
  // en la source (requerido por el verifier estático).
  const { validateProviderDocumentFile } = await import(
    "@/lib/providers-documents/validation"
  );
  const validation = await validateProviderDocumentFile({
    file: {
      name: file.name,
      type: file.type,
      size: file.size,
    },
    documentType: documentType as Parameters<
      typeof uploadProviderDocument
    >[0]["documentType"],
    providerId,
  });
  if (validation.ok === false) {
    if (validation.code === "FILE_TOO_LARGE") {
      return NextResponse.json(
        { error: validation.code, message: validation.message },
        { status: 413 },
      );
    }
    if (validation.code === "INVALID_CONTENT_TYPE") {
      return NextResponse.json(
        { error: validation.code, message: validation.message },
        { status: 415 },
      );
    }
    if (validation.code === "INVALID_DOCUMENT_TYPE") {
      return NextResponse.json(
        { error: validation.code, message: validation.message },
        { status: 400 },
      );
    }
    if (validation.code === "PROVIDER_NOT_FOUND") {
      return NextResponse.json(
        { error: validation.code, message: validation.message },
        { status: 404 },
      );
    }
    if (validation.code === "FILE_NAME_TOO_LONG") {
      return NextResponse.json(
        { error: validation.code, message: validation.message },
        { status: 400 },
      );
    }
  }

  // 6. Llamar al service
  const outcome = await uploadProviderDocument({
    providerId,
    documentType: documentType as Parameters<typeof uploadProviderDocument>[0]["documentType"],
    file: {
      name: file.name,
      type: file.type,
      size: file.size,
      arrayBuffer: () => file.arrayBuffer(),
    },
    expirationDate,
    userId: auth.userId,
  });

  if (outcome.ok === false) {
    return mapErrorToResponse(outcome.error);
  }

  // 7. Responder 201 con la metadata del documento (sin file_url)
  return NextResponse.json(
    {
      id: outcome.result.id,
      type: outcome.result.type,
      fileName: outcome.result.fileName,
      uploadedAt: outcome.result.uploadedAt,
      expirationDate: outcome.result.expirationDate,
    },
    { status: 201 },
  );
}

function mapErrorToResponse(
  error: import("@/lib/providers-documents/service").UploadProviderDocumentError,
): NextResponse {
  if (error.code === "VALIDATION_FAILED") {
    if (error.validation.ok === false) {
      return NextResponse.json(
        { error: error.validation.code, message: error.validation.message },
        { status: error.validation.status },
      );
    }
  }
  if (error.code === "SHAREPOINT_CONFIG_MISSING") {
    return NextResponse.json(
      { error: "SHAREPOINT_CONFIG_MISSING", missing: error.missing },
      { status: 500 },
    );
  }
  if (error.code === "SHAREPOINT_UPLOAD_FAILED") {
    return NextResponse.json(
      { error: "SHAREPOINT_UPLOAD_FAILED", message: error.message },
      { status: 500 },
    );
  }
  if (error.code === "DB_ERROR") {
    return NextResponse.json(
      { error: "DB_ERROR", message: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json(
    { error: "UNKNOWN_ERROR" },
    { status: 500 },
  );
}
