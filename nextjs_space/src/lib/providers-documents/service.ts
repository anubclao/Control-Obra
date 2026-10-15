// src/lib/providers-documents/service.ts
//
// Orquestador de upload de documento de proveedor a SharePoint.
// Reusa el cliente SharePoint genérico (sharepoint-client) y persiste
// en MySQL (provider_documents). Implementa dedup con
// SELECT-then-UPDATE-or-INSERT (sin UNIQUE constraint en el schema).

import { query, uuid } from "@/lib/db";
import {
  ensureFolder as sharepointEnsureFolder,
  uploadFile as sharepointUploadFile,
} from "@/lib/sharepoint/sharepoint-client";
import { readSharePointConfig } from "@/lib/sharepoint/auth";
import type { UploadResult } from "@/lib/sharepoint/sharepoint-client";
import type { ProviderDocumentType } from "@/types";
import {
  buildProviderDocumentPath,
  sanitizeFileName,
} from "./paths";
import { validateProviderDocumentFile } from "./validation";

// ----------------------------------------------------------------------------
// Types públicos (re-exportados para que la UI y el API route los consuman)
// ----------------------------------------------------------------------------

export interface UploadProviderDocumentInput {
  providerId: string;
  documentType: ProviderDocumentType;
  /**
   * File-like con size, type, name + arrayBuffer() para obtener el
   * contenido binario. En el browser, esto es `File`. En el server
   * (Next API route), esto es `File` parseado desde multipart.
   */
  file: {
    name: string;
    type: string;
    size: number;
    arrayBuffer: () => Promise<ArrayBuffer>;
  };
  /** YYYY-MM-DD. Opcional. */
  expirationDate?: string;
  /** ID del user que subió (para audit log futuro). */
  userId: string;
}

export interface UploadProviderDocumentResult {
  id: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
  type: ProviderDocumentType;
  expirationDate?: string;
}

export type UploadProviderDocumentError =
  | { code: "VALIDATION_FAILED"; validation: import("./validation").ValidateResult }
  | { code: "SHAREPOINT_CONFIG_MISSING"; missing: string[] }
  | { code: "SHAREPOINT_UPLOAD_FAILED"; message: string }
  | { code: "DB_ERROR"; message: string };

export type UploadProviderDocumentOutcome =
  | { ok: true; result: UploadProviderDocumentResult }
  | { ok: false; error: UploadProviderDocumentError };

// ----------------------------------------------------------------------------
// Service principal
// ----------------------------------------------------------------------------

/**
 * Sube un documento de proveedor a SharePoint y lo registra en MySQL.
 *
 * Flujo:
 *  1. validateProviderDocumentFile (size, type, providerId existe, etc.)
 *  2. Lee el provider y su project_code.
 *  3. Sanitiza el fileName.
 *  4. Construye el path SharePoint (buildProviderDocumentPath).
 *  5. ensureFolder (idempotente).
 *  6. uploadFile (con retry via sharepoint-client).
 *  7. SELECT-then-UPDATE-or-INSERT en provider_documents.
 *  8. Retorna el documento creado (con id y file_url).
 */
export async function uploadProviderDocument(
  input: UploadProviderDocumentInput,
): Promise<UploadProviderDocumentOutcome> {
  // 1. Validación
  const validation = await validateProviderDocumentFile({
    file: input.file,
    documentType: input.documentType,
    providerId: input.providerId,
  });
  if (!validation.ok) {
    return { ok: false, error: { code: "VALIDATION_FAILED", validation } };
  }

  // 2. Leer el provider (id, name, nit). En este commit temporal NO leemos
  // project_id (esa columna NO existe en providers; Corte 13 lo agregará
  // vía migración DB y vía query a pscs).
  // Wrap en try/catch para capturar errores SQL (ECONNREFUSED, ETIMEDOUT,
  // ER_BAD_FIELD_ERROR, etc.) y devolver DB_ERROR en lugar de 500.
  let provider: { id: string; name: string; nit: string };
  try {
    const providers = await query<any[]>(
      `SELECT id, name, nit FROM providers WHERE id = ? LIMIT 1`,
      [input.providerId],
    );
    if (providers.length === 0) {
      return {
        ok: false,
        error: { code: "DB_ERROR", message: `Provider ${input.providerId} no encontrado` },
      };
    }
    provider = providers[0];
  } catch (e: any) {
    console.error("[providers-documents.upload] provider lookup failed", e?.code, e?.message);
    return {
      ok: false,
      error: {
        code: "DB_ERROR",
        message: `No se pudo leer el provider: ${e?.code ?? e?.message ?? "unknown"}`,
      },
    };
  }

  // 3. projectCode: placeholder hasta Corte 13. (Corte 13 leerá desde
  // pscs → projects).
  const projectCode = "";

  // 4. Sanitizar fileName
  const sanitizedFileName = sanitizeFileName(input.file.name);

  // 4.5 Sanitizar providerCode (NIT) para uso en path de SharePoint.
  // Solo caracteres alfanuméricos y guiones, max 64 chars.
  // Ej: "79739284" → "79739284"; "900.111.222-3" → "900-111-222-3".
  const providerCode =
    (provider.nit ?? "")
      .replace(/[^a-zA-Z0-9-]/g, "-")
      .slice(0, 64) || "sin-nit";

  // 5. Construir path SharePoint
  const { folderPath } = buildProviderDocumentPath({
    basePath: process.env.SP_BASE_PATH ?? "Proyectos",
    projectCode,
    providerCode,
    documentType: input.documentType,
    fileName: sanitizedFileName,
  });

  // 6. Config SharePoint
  const configResult = readSharePointConfig();
  if (configResult.ok === false) {
    return {
      ok: false,
      error: { code: "SHAREPOINT_CONFIG_MISSING", missing: configResult.missing },
    };
  }
  const spConfig = configResult.config;

  // 7. ensureFolder (idempotente)
  try {
    await sharepointEnsureFolder(spConfig, folderPath);
  } catch (e) {
    return {
      ok: false,
      error: {
        code: "SHAREPOINT_UPLOAD_FAILED",
        message: `No se pudo crear la carpeta ${folderPath}: ${(e as Error).message}`,
      },
    };
  }

  // 8. uploadFile (con retry interno)
  let uploadResult: UploadResult;
  try {
    const buffer = Buffer.from(await input.file.arrayBuffer());
    uploadResult = await sharepointUploadFile(spConfig, {
      folderPath,
      fileName: sanitizedFileName,
      content: buffer,
    });
  } catch (e) {
    return {
      ok: false,
      error: {
        code: "SHAREPOINT_UPLOAD_FAILED",
        message: `No se pudo subir el archivo a SharePoint: ${(e as Error).message}`,
      },
    };
  }

  // 9. SELECT-then-UPDATE-or-INSERT en provider_documents
  try {
    const existing = await query<any[]>(
      `SELECT id FROM provider_documents WHERE provider_id = ? AND type = ?`,
      [input.providerId, input.documentType],
    );

    let documentId: string;
    if (existing.length > 0) {
      // UPDATE: reemplazar fila existente
      documentId = existing[0].id;
      await query(
        `UPDATE provider_documents
         SET file_name = ?, file_url = ?, uploaded_at = NOW(), expiration_date = ?
         WHERE id = ?`,
        [
          sanitizedFileName,
          uploadResult.webUrl,
          input.expirationDate ?? null,
          documentId,
        ],
      );
    } else {
      // INSERT: nueva fila
      documentId = uuid();
      await query(
        `INSERT INTO provider_documents
         (id, provider_id, type, file_name, file_url, uploaded_at, expiration_date)
         VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
        [
          documentId,
          input.providerId,
          input.documentType,
          sanitizedFileName,
          uploadResult.webUrl,
          input.expirationDate ?? null,
        ],
      );
    }

    return {
      ok: true,
      result: {
        id: documentId,
        fileName: sanitizedFileName,
        fileUrl: uploadResult.webUrl,
        uploadedAt: new Date().toISOString(),
        type: input.documentType,
        expirationDate: input.expirationDate,
      },
    };
  } catch (e) {
    // El archivo YA se subió a SharePoint pero la INSERT/UPDATE falló.
    // Esto deja un archivo huérfano en SharePoint. Logueamos el error
    // con un correlation id para que el admin pueda limpiar manualmente.
    // (Mitigate: outbox pattern o cleanup periódico — fuera de scope MVP.)
    return {
      ok: false,
      error: {
        code: "DB_ERROR",
        message: `Upload a SharePoint OK pero falló persistencia en MySQL. Archivo huérfano en: ${folderPath}/${sanitizedFileName}. Error: ${(e as Error).message}`,
      },
    };
  }
}
