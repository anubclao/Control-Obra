// filepath: src/lib/sharepoint/client.ts
// Cliente fino sobre Microsoft Graph (no usa @microsoft/microsoft-graph-client
// para mantener bundle pequeño y poder mockearse fácil con fetch).
//
// Responsabilidad: encapsular HTTP contra Graph y devolver tipos limpios.
// La lógica de negocio (paths, versionado) vive en sharepoint-client.ts.

import type { SharePointConfig } from "./auth";
import { getGraphToken } from "./auth";

/**
 * Errores tipados que pueden venir de Graph. Se traducen a GenerateDocumentError
 * en el API layer.
 */
export type GraphErrorCode =
  | "SP_AUTH_FAILED"
  | "SP_FORBIDDEN"
  | "SP_SITE_NOT_FOUND"
  | "SP_TIMEOUT"
  | "SP_NOT_FOUND"
  | "SP_CONFLICT"
  | "SP_SERVER_ERROR"
  | "SP_UNKNOWN";

export class GraphError extends Error {
  readonly code: GraphErrorCode;
  readonly status: number;
  readonly hint?: string;
  constructor(
    code: GraphErrorCode,
    status: number,
    message: string,
    hint?: string,
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.hint = hint;
    this.name = "GraphError";
  }
}

export interface GraphDriveItem {
  id: string;
  name: string;
  webUrl: string;
  size: number;
  file?: { mimeType: string };
  folder?: { childCount: number };
  lastModifiedDateTime: string;
}

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const TIMEOUT_MS = 30_000;

/**
 * Fetch con timeout (AbortController). Lanza GraphError tipado según status.
 * Acepta body como Buffer | string (JSON ya serializado). Convierte Buffer
 * a Uint8Array porque el tipo lib.dom.d.ts BodyInit no incluye Buffer.
 */
async function graphFetch(
  config: SharePointConfig,
  path: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: Buffer | string;
  } = {},
): Promise<Response> {
  const token = await getGraphToken(config);
  const url = `${GRAPH_BASE}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let resp: Response;
  try {
    let bodyInit: BodyInit | undefined;
    if (init.body instanceof Buffer) {
      bodyInit = new Uint8Array(init.body);
    } else if (typeof init.body === "string") {
      bodyInit = init.body;
    }
    resp = await fetch(url, {
      method: init.method,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
      body: bodyInit,
      signal: controller.signal,
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new GraphError("SP_TIMEOUT", 0, `Timeout after ${TIMEOUT_MS}ms`);
    }
    throw new GraphError("SP_UNKNOWN", 0, (e as Error).message);
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw mapStatusToGraphError(resp.status, body);
  }
  return resp;
}

function mapStatusToGraphError(status: number, body: string): GraphError {
  if (status === 401) {
    return new GraphError(
      "SP_AUTH_FAILED",
      401,
      "Graph 401: token rechazado",
      "Rotar SP_CLIENT_SECRET o re-aplicar Grant admin consent",
    );
  }
  if (status === 403) {
    return new GraphError(
      "SP_FORBIDDEN",
      403,
      "Graph 403: sin permisos",
      body.slice(0, 200),
    );
  }
  if (status === 404) {
    return new GraphError(
      "SP_NOT_FOUND",
      404,
      "Graph 404: recurso no existe",
      body.slice(0, 200),
    );
  }
  if (status === 409) {
    return new GraphError(
      "SP_CONFLICT",
      409,
      "Graph 409: conflicto",
      body.slice(0, 200),
    );
  }
  if (status === 408) {
    return new GraphError("SP_TIMEOUT", 408, "Graph 408: timeout");
  }
  if (status >= 500) {
    return new GraphError(
      "SP_SERVER_ERROR",
      status,
      `Graph ${status}`,
      body.slice(0, 200),
    );
  }
  return new GraphError(
    "SP_UNKNOWN",
    status,
    `Graph ${status}`,
    body.slice(0, 200),
  );
}

/**
 * GET — devuelve JSON parseado.
 */
export async function graphGet<T>(
  config: SharePointConfig,
  path: string,
): Promise<T> {
  const r = await graphFetch(config, path, { method: "GET" });
  return r.json() as Promise<T>;
}

/**
 * PUT raw bytes. Usado para upload de archivos.
 * Content-Type se infiere por extensión si no se pasa.
 */
export async function graphPutBytes(
  config: SharePointConfig,
  path: string,
  body: Buffer,
  contentType: string,
): Promise<GraphDriveItem> {
  const r = await graphFetch(config, path, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(body.length),
    },
    body,
  });
  return r.json() as Promise<GraphDriveItem>;
}

/**
 * PATCH JSON — usado para metadata (rename, etc).
 */
export async function graphPatch<T>(
  config: SharePointConfig,
  path: string,
  data: unknown,
): Promise<T> {
  const r = await graphFetch(config, path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return (await r.json()) as T;
}

/**
 * POST JSON — usado para crear sesiones de upload grandes o carpetas.
 */
export async function graphPost<T>(
  config: SharePointConfig,
  path: string,
  data: unknown,
): Promise<T> {
  const r = await graphFetch(config, path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return (await r.json()) as T;
}

/**
 * Infiere Content-Type por extensión. Para .docx/.xlsx se usa el estándar
 * Office Open XML; para .pdf, application/pdf.
 */
export function contentTypeFor(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "pdf":
      return "application/pdf";
    case "txt":
      return "text/plain; charset=utf-8";
    case "json":
      return "application/json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}
