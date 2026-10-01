// filepath: src/lib/document-generator/service.ts
// Orquestador del flujo: load entity + lookups → resolve template →
// render → build path → upload a SharePoint → log + persistir webUrl.
// Es el "use case" que el endpoint POST /api/documents/generate invoca.
//
// Refactor F2:
//   - Hace lookup de `projects` y `providers` para construir el FillerContext.
//   - Pasa el row normalizado directo a cada filler (sin mapping intermedio).
//   - Persiste `generated_document_url` en la fila de la entidad al éxito.

import * as path from "node:path";
import { promises as fs } from "node:fs";

import {
  renderDocument,
  resolveTemplatePath,
  detectTemplateVersion,
} from "./render";
import { resolveTemplate } from "./registry";
import { buildProjectPath, type BuildPathResult } from "@/lib/sharepoint/paths";
import { readSharePointConfig } from "@/lib/sharepoint/auth";
import {
  createRealSharePointClient,
  type SharePointClient,
  type UploadResult,
} from "@/lib/sharepoint/sharepoint-client";
import {
  loadEntity,
  loadProject,
  loadProvider,
  normalizeEntity,
  toResolveInput,
  extractProjectId,
  extractProviderId,
  type ProjectView,
} from "./entity-loader";
import {
  logGeneration,
  logGenerationTx,
  persistUrlTx,
  sanitizeIp,
} from "./log";
import { query, transaction } from "@/lib/db";

import type {
  DocumentEntity,
  DocumentTemplateId,
  GenerateDocumentResponse,
} from "@/types/documents";

export interface ServiceDeps {
  templateLoader?: (absolutePath: string) => Promise<Buffer>;
  spClient?: SharePointClient;
  formatosRoot?: string;
  /** Inyectable para tests: ejecuta la query de UPDATE generated_document_url. */
  persistUrl?: (
    entity: DocumentEntity,
    entityId: string,
    webUrl: string,
  ) => Promise<void>;
  /** F4: hook para reportar reintentos del upload a SharePoint. */
  onRetry?: (info: { attempt: number; delayMs: number; error: Error }) => void;
  /** F4: número de intentos de subida (post-retry). */
  attempts?: number;
}

export type ServiceErrorCode =
  | "SP_NOT_CONFIGURED"
  | "ENTITY_NOT_FOUND"
  | "ENTITY_INCOMPLETE"
  | "TEMPLATE_MISSING"
  | "TEMPLATE_MISMATCH"
  | "TEMPLATE_FILE_MISSING"
  | "FILLER_THREW"
  | "SP_AUTH_FAILED"
  | "SP_FORBIDDEN"
  | "SP_SITE_NOT_FOUND"
  | "SP_TIMEOUT"
  | "UPLOAD_FAILED"
  | "INTERNAL";

export interface ServiceInput {
  entity: DocumentEntity;
  entityId: string;
  templateId?: DocumentTemplateId;
  fileNameOverride?: string;
  userId?: string | null;
  /** F4: metadata del request HTTP para auditoría. */
  ip?: string | null;
  userAgent?: string | null;
}

export type ServiceResult =
  | {
      ok: true;
      response: GenerateDocumentResponse;
      durationMs: number;
      attempts: number;
    }
  | {
      ok: false;
      errorCode: ServiceErrorCode;
      message: string;
      missing?: string[];
      got?: string;
      expected?: DocumentTemplateId[];
      durationMs: number;
      attempts: number;
    };

export function defaultFormatosRoot(): string {
  return path.resolve(process.cwd(), "..", "Formatos");
}

async function defaultTemplateLoader(absolutePath: string): Promise<Buffer> {
  return await fs.readFile(absolutePath);
}

const ENTITY_TO_TABLE_FOR_UPDATE: Record<DocumentEntity, string> = {
  payments: "payment_requests",
  expenses: "expenses",
  cuts: "work_cuts",
  contracts: "contracts",
  employees: "employees",
  workLogs: "work_logs",
};

async function defaultPersistUrl(
  entity: DocumentEntity,
  entityId: string,
  webUrl: string,
): Promise<void> {
  const table = ENTITY_TO_TABLE_FOR_UPDATE[entity];
  await query(`UPDATE ${table} SET generated_document_url = ? WHERE id = ?`, [
    webUrl,
    entityId,
  ]);
}

export async function generateAndUpload(
  args: ServiceInput,
  deps: ServiceDeps = {},
): Promise<ServiceResult> {
  const startedAt = Date.now();
  const elapsed = () => Date.now() - startedAt;

  const templateLoader = deps.templateLoader ?? defaultTemplateLoader;
  const formatosRoot = deps.formatosRoot ?? defaultFormatosRoot();
  const persistUrl = deps.persistUrl ?? defaultPersistUrl;

  // 1) Cargar entidad
  const loaded = await loadEntity(args.entity, args.entityId);
  if (!loaded.ok) {
    return {
      ok: false,
      errorCode: "ENTITY_NOT_FOUND",
      message: `${args.entity}#${args.entityId} no existe`,
      durationMs: elapsed(),
      attempts: 0,
    };
  }
  const normalized = normalizeEntity(loaded.entity.raw);

  // 2) Lookups paralelos: project + provider
  const projectId = extractProjectId(normalized);
  const providerId = extractProviderId(args.entity, normalized);
  const [project, provider] = await Promise.all([
    projectId ? loadProject(projectId) : Promise.resolve(null),
    providerId ? loadProvider(providerId) : Promise.resolve(null),
  ]);

  // 3) Resolver plantilla
  let templateId: DocumentTemplateId;
  if (args.templateId) {
    templateId = args.templateId;
  } else {
    const resolved = resolveTemplate(
      args.entity,
      toResolveInput(args.entity, normalized),
    );
    if (!(resolved as { ok: boolean }).ok) {
      const e = (
        resolved as {
          error: {
            code: string;
            got?: string;
            expected?: DocumentTemplateId[];
          };
        }
      ).error;
      if (e.code === "TEMPLATE_MISSING") {
        return {
          ok: false,
          errorCode: "TEMPLATE_MISSING",
          message: `Sin plantilla para ${args.entity}`,
          durationMs: elapsed(),
          attempts: 0,
        };
      }
      return {
        ok: false,
        errorCode: "TEMPLATE_MISMATCH",
        message: `Tipo de ${args.entity} no soportado`,
        got: e.got,
        expected: e.expected,
        durationMs: elapsed(),
        attempts: 0,
      };
    }
    templateId = (resolved as { templateId: DocumentTemplateId }).templateId;
  }

  // 4) Resolver ruta SharePoint
  const pathInput: Record<string, unknown> = { ...normalized };
  if (!pathInput.projectCode) {
    pathInput.projectCode =
      project?.code ?? pathInput.projectId ?? "SIN_PROYECTO";
  }
  const basePath = process.env.SP_BASE_PATH || "Proyectos";
  let build: BuildPathResult;
  try {
    build = buildProjectPath(basePath, templateId, args.entity, pathInput);
  } catch (e: unknown) {
    return {
      ok: false,
      errorCode: "INTERNAL",
      attempts: 0,
      message: e instanceof Error ? e.message : String(e),
      durationMs: elapsed(),
    };
  }

  // 5) Renderizar plantilla con context enriquecido
  const tplPath = resolveTemplatePath(templateId, formatosRoot);
  const fallbackProject: ProjectView = {
    code: String(pathInput.projectCode ?? ""),
    name: project?.name ?? "",
    client: project?.client ?? "",
    location: project?.location ?? "",
  };
  const context = {
    project: project ?? fallbackProject,
    provider: provider ?? undefined,
    today: new Date().toISOString().slice(0, 10),
  };
  const rendered = await renderDocument(templateId, normalized, context, {
    formatosRoot,
    loader: templateLoader,
  });
  if (!(rendered as { ok: boolean }).ok) {
    const rerr = (
      rendered as { error: { code: string; reason?: string; path?: string } }
    ).error;
    // H-3: log del detalle completo server-side (para debug). El cliente
    // recibe solo la versión sanitizada.
    if (rerr.code === "FILLER_THREW" && rerr.reason) {
      console.error(
        `[generateAndUpload] FILLER_THREW (${templateId}): ${rerr.reason}`,
      );
    }
    if (rerr.code === "TEMPLATE_FILE_MISSING") {
      return {
        ok: false,
        errorCode: "TEMPLATE_FILE_MISSING",
        message: `Plantilla no encontrada: ${tplPath}`,
        durationMs: elapsed(),
        attempts: 0,
      };
    }
    if (rerr.code === "TEMPLATE_NOT_REGISTERED") {
      return {
        ok: false,
        errorCode: "TEMPLATE_MISSING",
        message: `Plantilla ${templateId} no registrada`,
        durationMs: elapsed(),
        attempts: 0,
      };
    }
    return {
      ok: false,
      errorCode: "FILLER_THREW",
      message:
        rerr.code === "FILLER_THREW"
          ? sanitizeFillerError(rerr.reason ?? "")
          : "",
      durationMs: elapsed(),
      attempts: 0,
    };
  }

  // 6) Subir a SharePoint
  const spConfigRes = readSharePointConfig();
  if (!spConfigRes.ok) {
    await logGeneration({
      entity: args.entity,
      entityId: args.entityId,
      templateId,
      fileName: build.fileName,
      sharepointPath: build.folderPath,
      webUrl: "",
      status: "ERROR",
      errorCode: "SP_NOT_CONFIGURED",
      durationMs: elapsed(),
      userId: args.userId ?? null,
      ip: sanitizeIp(args.ip),
      userAgent: args.userAgent ?? null,
      attempts: 0,
      templateVersion: detectTemplateVersion(templateId),
    });
    return {
      ok: false,
      errorCode: "SP_NOT_CONFIGURED",
      message: "SharePoint no está configurado en .env.local",
      durationMs: elapsed(),
      attempts: 0,
    };
  }

  // Capturamos attempts vía onRetry (que se ejecuta desde el withRetry
  // interno en sharepoint-client.ts). El counter empieza en 1 (el primer
  // intento) y se incrementa cada vez que el cliente nos avisa de un retry.
  let uploadAttempts = 1;
  const onRetryHook = (info: {
    attempt: number;
    delayMs: number;
    error: Error;
  }) => {
    uploadAttempts = info.attempt + 1; // el próximo será attempt+1
    deps.onRetry?.(info);
  };

  const spClient: SharePointClient =
    deps.spClient ??
    createRealSharePointClient(spConfigRes.config, {
      onRetry: onRetryHook,
    });

  let upload: UploadResult;
  try {
    upload = await spClient.uploadFile({
      folderPath: build.folderPath,
      fileName: build.fileName,
      content: (rendered as { content: Buffer }).content,
      fileNameOverride: args.fileNameOverride,
    });
  } catch (e: unknown) {
    const code = mapSpErrorCode(e);
    await logGeneration({
      entity: args.entity,
      entityId: args.entityId,
      templateId,
      fileName: build.fileName,
      sharepointPath: build.folderPath,
      webUrl: "",
      status: "ERROR",
      errorCode: code,
      durationMs: elapsed(),
      userId: args.userId ?? null,
      ip: sanitizeIp(args.ip),
      userAgent: args.userAgent ?? null,
      attempts: uploadAttempts,
      templateVersion: detectTemplateVersion(templateId),
    });
    return {
      ok: false,
      errorCode: code,
      message: e instanceof Error ? e.message : String(e),
      durationMs: elapsed(),
      attempts: uploadAttempts,
    };
  }

  // 7) Persistir URL en la fila + log OK (M-2: atómico via transacción).
  //    Si la transacción falla, el archivo en SharePoint queda huérfano;
  //    la siguiente generación lo re-sobrescribirá como nueva versión.
  //    Loggeamos el problema y devolvemos éxito parcial: el usuario ve
  //    el link al archivo y la próxima vez que refresque, el store
  //    tendrá la URL (o no, y volverá a regenerar).
  let persistFailed: string | null = null;
  try {
    await transaction(async (conn) => {
      const persistResult = await persistUrlTx(
        conn,
        args.entity,
        args.entityId,
        upload.webUrl,
      );
      if (!persistResult.ok === true) {
        // Forzar rollback y propagación controlada
        throw new Error((persistResult as { error: string }).error);
      }
      const logResult = await logGenerationTx(conn, {
        entity: args.entity,
        entityId: args.entityId,
        templateId,
        fileName: build.fileName,
        sharepointPath: build.folderPath,
        webUrl: upload.webUrl,
        status: "OK",
        durationMs: elapsed(),
        userId: args.userId ?? null,
        ip: sanitizeIp(args.ip),
        userAgent: args.userAgent ?? null,
        attempts: uploadAttempts,
        templateVersion: detectTemplateVersion(templateId),
      });
      if (!logResult.ok === true) {
        throw new Error((logResult as { error: string }).error);
      }
    });
  } catch (e: unknown) {
    // Log y persist fallaron juntos (o por separado, vía rollback).
    // El archivo en SharePoint sí quedó. Devolvemos OK con un warning
    // en el log server-side.
    persistFailed = e instanceof Error ? e.message : String(e);
    console.warn(
      `[generateAndUpload] transacción persist+log falló (SharePoint OK): ${persistFailed}`,
    );
    // Hacemos un log secundario (no-transaccional) para que quede
    // constancia del evento.
    await logGeneration({
      entity: args.entity,
      entityId: args.entityId,
      templateId,
      fileName: build.fileName,
      sharepointPath: build.folderPath,
      webUrl: upload.webUrl,
      status: "OK",
      errorCode: "PERSIST_TX_FAILED",
      durationMs: elapsed(),
      userId: args.userId ?? null,
      ip: sanitizeIp(args.ip),
      userAgent: args.userAgent ?? null,
      attempts: uploadAttempts,
      templateVersion: detectTemplateVersion(templateId),
    }).catch((e2) => {
      console.error(
        "[generateAndUpload] log secundario también falló:",
        e2 instanceof Error ? e2.message : e2,
      );
    });
  }

  return {
    ok: true,
    durationMs: elapsed(),
    attempts: uploadAttempts,
    response: {
      ok: true,
      webUrl: upload.webUrl,
      fileName: build.fileName,
      path: build.folderPath,
      sizeBytes: upload.sizeBytes,
      version: upload.version,
      templateId,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * H-3: Sanitiza el mensaje de error de un filler antes de devolverlo al
 * cliente. El detalle completo se preserva en el log server-side vía
 * `console.error`, pero al cliente solo llega un código corto y
 * accionable. Esto evita exponer paths internos, decisiones de
 * arquitectura o mensajes de parser.
 *
 * Mapeo: extrae el prefijo "CODIGO:" del mensaje y lo acorta a una
 * versión segura. Si el mensaje no tiene el formato esperado, devuelve
 * un genérico.
 */
function sanitizeFillerError(reason: string): string {
  // El log completo va a server-side, conservamos detalles en logGeneration.
  // Aquí solo devolvemos un código de error corto.
  const m = /^([A-Z_]+(?:_[A-Z]+)*(?=_FILLER|_ERROR|_NOT_))/i.exec(reason);
  if (m) return m[1];
  // Si no matchea un patrón conocido, devolver un mensaje genérico
  // (no exponemos el contenido del error al cliente).
  return "RENDER_FAILED";
}

function mapSpErrorCode(e: unknown): ServiceErrorCode {
  const code =
    e && typeof e === "object" && "code" in e
      ? String((e as { code: unknown }).code)
      : "";
  switch (code) {
    case "SP_AUTH_FAILED":
      return "SP_AUTH_FAILED";
    case "SP_FORBIDDEN":
      return "SP_FORBIDDEN";
    case "SP_NOT_FOUND":
    case "SP_SITE_NOT_FOUND":
      return "SP_SITE_NOT_FOUND";
    case "SP_TIMEOUT":
      return "SP_TIMEOUT";
    default:
      return "UPLOAD_FAILED";
  }
}
