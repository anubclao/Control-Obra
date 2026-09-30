// filepath: src/lib/sharepoint/sharepoint-client.ts
// Capa de negocio sobre el cliente Graph: ensureProjectFolder + uploadFile.
// Idempotente: si la carpeta existe, no falla. Si el archivo existe, sube
// como nueva versión (PUT sobre el path resuelve a overwrite en Graph).
//
// F4: la subida (PUT) se reintenta con backoff exponencial si falla por
// timeout/5xx/error de red. Errores 4xx (auth/forbidden/not-found/conflict)
// NO se reintentan — son causas conocidas.

import type { SharePointConfig } from "./auth";
import {
  GraphError,
  contentTypeFor,
  graphGet,
  graphPost,
  graphPutBytes,
  type GraphDriveItem,
} from "./client";
import { withRetry, isRetryableError } from "./retry";
import { validateFileName } from "@/lib/filename-validate";

export interface UploadResult {
  webUrl: string;
  sizeBytes: number;
  version: number;
}

export interface SharePointClient {
  ensureFolder(folderPath: string): Promise<string>;
  uploadFile(args: {
    folderPath: string;
    fileName: string;
    content: Buffer;
    fileNameOverride?: string;
  }): Promise<UploadResult>;
}

export interface RetryConfig {
  /** Máximo de intentos para la subida. Default 3. */
  maxAttempts?: number;
  /** Hook opcional para reportar reintentos (logs, métricas). */
  onRetry?: (info: { attempt: number; delayMs: number; error: Error }) => void;
}

/**
 * Devuelve el drive-relative path absoluto para una subcarpeta de un drive.
 * Graph acepta "/drives/{id}/root:/Proyectos/P001/01-Anticipos:".
 */
function driveItemPath(driveId: string, relPath: string): string {
  const clean = relPath.replace(/^\/+/, "").replace(/\/+$/, "");
  return `/drives/${driveId}/root:/${clean}`;
}

/**
 * Garantiza que `folderPath` exista (crea recursivamente si no).
 * Idempotente: si ya existe, devuelve su id sin crearla.
 *
 * Implementación: navega segmento a segmento. Para cada nivel, si no
 * existe (404), lo crea con POST /children.
 */
export async function ensureFolder(
  config: SharePointConfig,
  folderPath: string,
): Promise<string> {
  const segments = folderPath.split("/").filter(Boolean);
  let accumulated = "";
  let parentId: string | null = null; // null = root del drive

  for (const seg of segments) {
    accumulated = accumulated ? `${accumulated}/${seg}` : seg;
    const checkPath = parentId
      ? `/drives/${config.driveId}/items/${parentId}:/${seg}:`
      : driveItemPath(config.driveId, accumulated);

    try {
      const item = await graphGet<GraphDriveItem>(config, checkPath);
      parentId = item.id;
      continue;
    } catch (e) {
      if (!(e instanceof GraphError) || e.code !== "SP_NOT_FOUND") throw e;
    }

    // No existe → crear bajo el parent (o root)
    const createPath = parentId
      ? `/drives/${config.driveId}/items/${parentId}/children`
      : `/drives/${config.driveId}/root/children`;

    const created = await graphPost<GraphDriveItem>(config, createPath, {
      name: seg,
      folder: {},
      "@microsoft.graph.conflictBehavior": "replace",
    });
    parentId = created.id;
  }

  if (!parentId) {
    throw new Error(`ensureFolder: no se pudo crear ${folderPath}`);
  }
  return parentId;
}

/**
 * Sube `content` a `folderPath/fileName`. Si el archivo ya existe,
 * PUT sobre el mismo path lo sobrescribe (versión nueva en SharePoint).
 *
 * Devuelve webUrl, size y el último número de versión observado en
 * `lastModifiedDateTime` (Graph no expone `eTag` numérico en v1.0, así
 * que usamos una heurística: el webUrl trae #vN).
 *
 * F4: la subida (PUT) se reintenta con backoff exponencial si falla
 * por timeout/5xx/error de red. Errores 4xx (auth/forbidden/not-found/
 * conflict) NO se reintentan — son causas conocidas.
 */
export async function uploadFile(
  config: SharePointConfig,
  args: {
    folderPath: string;
    fileName: string;
    content: Buffer;
    fileNameOverride?: string;
  },
  retry: RetryConfig = {},
): Promise<UploadResult> {
  const folderId = await ensureFolder(config, args.folderPath);
  const rawName = args.fileNameOverride ?? args.fileName;

  // H-1: validación defensiva del nombre de archivo. La API route ya
  // valida fileNameOverride; el fileName computado por buildProjectPath
  // también debe cumplir el formato.
  const v = validateFileName(rawName);
  if (!v.ok === true) {
    throw new Error(
      `uploadFile: nombre inválido (${(v as { reason: string }).reason})`,
    );
  }
  const finalName = v.normalized;

  // 1) Verificar si ya existe (para reportar versión correctamente)
  let existingVersion = 0;
  try {
    const existing = await graphGet<GraphDriveItem>(
      config,
      `/drives/${config.driveId}/items/${folderId}:/${encodeURIComponent(finalName)}:`,
    );
    // Graph embebe la versión en el webUrl como "...#vN"
    const m = /#v(\d+)/.exec(existing.webUrl);
    if (m) existingVersion = Number(m[1]);
  } catch (e) {
    if (!(e instanceof GraphError) || e.code !== "SP_NOT_FOUND") throw e;
  }

  // 2) Subir (PUT sobre el path = nuevo contenido, nueva versión)
  const putPath = `/drives/${config.driveId}/items/${folderId}:/${encodeURIComponent(finalName)}:/content`;
  const item = await withRetry(
    () =>
      graphPutBytes(config, putPath, args.content, contentTypeFor(finalName)),
    {
      maxAttempts: retry.maxAttempts ?? 3,
      onRetry: retry.onRetry,
    },
  )
    .then((r) => r.value)
    .catch((e: unknown) => {
      // Re-lanzar con metadata para diagnóstico
      if (e instanceof Error) {
        if (isRetryableError(e)) {
          (e as Error & { retriedOut?: boolean }).retriedOut = true;
        }
      }
      throw e;
    });

  // 3) Extraer versión del webUrl
  const m = /#v(\d+)/.exec(item.webUrl);
  const version = m ? Number(m[1]) : existingVersion + 1;

  return {
    webUrl: item.webUrl,
    sizeBytes: item.size,
    version,
  };
}

/**
 * Implementación por defecto: cliente real contra Graph.
 * Para tests, se inyecta un mock vía createSharePointClient(fakeHttp).
 */
export function createRealSharePointClient(
  config: SharePointConfig,
  retry: RetryConfig = {},
): SharePointClient {
  return {
    ensureFolder: (folderPath: string) => ensureFolder(config, folderPath),
    uploadFile: (args) => uploadFile(config, args, retry),
  };
}
