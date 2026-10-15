// src/lib/providers-documents/validation.ts
//
// Validación de archivos de proveedor antes de subir a SharePoint.

import { query } from "@/lib/db";
import { asString } from "@/lib/db";
import type { ProviderDocumentType } from "@/types";

/** 50 MB máximo. SharePoint soporta hasta 250 MB; 50 MB es razonable para docs. */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/** Tipos MIME permitidos. Coincide con las extensiones de los file pickers. */
export const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
] as const;

export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

export interface ValidateProviderDocumentFileInput {
  /** File-like (browser File o Node ReadStream). Solo necesitamos size/type/name. */
  file: { size: number; type: string; name: string };
  documentType: ProviderDocumentType;
  providerId: string;
}

export type ValidateResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "FILE_TOO_LARGE"
        | "INVALID_CONTENT_TYPE"
        | "INVALID_DOCUMENT_TYPE"
        | "PROVIDER_NOT_FOUND"
        | "FILE_NAME_TOO_LONG";
      status: number;
      message: string;
    };

const VALID_DOCUMENT_TYPES: ReadonlySet<string> = new Set([
  "CEDULA",
  "RUT",
  "CAMARA_COMERCIO",
  "CERTIFICADO_BANCARIO",
  "CERTIFICACIONES_COMERCIALES",
  "OTROS",
]);

/**
 * Valida un archivo de proveedor:
 *  1. documentType en el enum ProviderDocumentType.
 *  2. file.size <= 50 MB.
 *  3. file.type en allowlist.
 *  4. providerId existe en la tabla `providers`.
 *  5. file.name (después de sanitizar) <= 100 chars.
 */
export async function validateProviderDocumentFile(
  input: ValidateProviderDocumentFileInput,
): Promise<ValidateResult> {
  // 1. documentType enum
  if (!VALID_DOCUMENT_TYPES.has(input.documentType)) {
    return {
      ok: false,
      code: "INVALID_DOCUMENT_TYPE",
      status: 400,
      message: `Tipo de documento inválido: ${input.documentType}`,
    };
  }

  // 2. size
  if (input.file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      status: 413,
      message: `El archivo excede el límite de ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`,
    };
  }

  // 3. content type
  if (
    !ALLOWED_CONTENT_TYPES.includes(input.file.type as AllowedContentType)
  ) {
    return {
      ok: false,
      code: "INVALID_CONTENT_TYPE",
      status: 415,
      message: `Tipo de archivo no permitido: ${input.file.type}. Permitidos: PDF, DOCX, JPG, PNG, XLSX.`,
    };
  }

  // 4. providerId existe
  const providerId = asString(input.providerId, "providerId");
  const rows = await query<any[]>(
    `SELECT id FROM providers WHERE id = ? LIMIT 1`,
    [providerId],
  );
  if (rows.length === 0) {
    return {
      ok: false,
      code: "PROVIDER_NOT_FOUND",
      status: 404,
      message: `El provider ${providerId} no existe.`,
    };
  }

  // 5. file.name length (post-sanitize, en el service se hace el sanitize,
  // aquí validamos el input crudo para dar feedback temprano).
  if (input.file.name.length > 200) {
    // Antes de sanitize, máx 200 (sanitize acorta). Después de sanitize, máx 100.
    return {
      ok: false,
      code: "FILE_NAME_TOO_LONG",
      status: 400,
      message: `Nombre de archivo demasiado largo (${input.file.name.length} chars, máx 200).`,
    };
  }

  return { ok: true };
}
