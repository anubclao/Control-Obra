// filepath: src/app/api/documents/generate/route.ts
// POST /api/documents/generate
// Auth: requiere sesión con rol ADMIN | GERENTE | DIRECTOR | RESIDENTE.
// Body: GenerateDocumentRequest
// Resp 200: GenerateDocumentResponse
// Resp 4xx/5xx: GenerateDocumentError

import { NextResponse } from "next/server";
import { requireAuth, authFailureResponse } from "@/lib/api-auth";
import {
  generateAndUpload,
  type ServiceErrorCode,
} from "@/lib/document-generator/service";
import { rateLimitByIdentity } from "@/lib/rate-limit";
import { validateFileName } from "@/lib/filename-validate";
import { sanitizeIp } from "@/lib/document-generator/log";
import type {
  DocumentEntity,
  DocumentTemplateId,
  GenerateDocumentRequest,
  GenerateDocumentError,
} from "@/types/documents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_ROLES = ["ADMIN", "GERENTE", "DIRECTOR", "RESIDENTE"] as const;

const VALID_ENTITIES: ReadonlySet<DocumentEntity> = new Set<DocumentEntity>([
  "payments",
  "expenses",
  "cuts",
  "contracts",
  "employees",
  "workLogs",
]);

// H-4: allowlist de templateId. Sin esto, un atacante podría mandar
// cualquier string y castearlo en el service a `DocumentTemplateId`,
// lo que permite a un filler recibir un `data` que no matchea la forma
// esperada y producir documentos corruptos.
const VALID_TEMPLATE_IDS: ReadonlySet<DocumentTemplateId> =
  new Set<DocumentTemplateId>([
    "AD-0033",
    "LEG",
    "OC",
    "OS",
    "CORTE",
    "AUSENCIA",
    "CONT_GLOBAL",
    "CONT_UNITARIO",
    "CONT_DISENOS",
    "CONT_LABORAL",
  ]);

function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: "BAD_REQUEST", message }, { status: 400 });
}

function mapServiceErrorToApi(
  code: ServiceErrorCode,
  message: string,
  extra?: { got?: string; expected?: DocumentTemplateId[]; missing?: string[] },
): { status: number; body: GenerateDocumentError } {
  switch (code) {
    case "ENTITY_NOT_FOUND":
      return { status: 404, body: { error: "ENTITY_NOT_FOUND" } };
    case "TEMPLATE_MISSING":
      return {
        status: 404,
        body: { error: "TEMPLATE_MISSING", templateId: message },
      };
    case "TEMPLATE_MISMATCH":
      return {
        status: 400,
        body: {
          error: "TEMPLATE_MISMATCH",
          expected: extra?.expected?.[0] ?? "AD-0033",
          got: extra?.got ?? "unknown",
        },
      };
    case "TEMPLATE_FILE_MISSING":
      return {
        status: 500,
        body: { error: "TEMPLATE_MISSING", templateId: message },
      };
    case "FILLER_THREW":
      return { status: 500, body: { error: "RENDER_FAILED", reason: message } };
    case "SP_AUTH_FAILED":
      return {
        status: 503,
        body: {
          error: "SP_AUTH_FAILED",
          hint: "Rotar SP_CLIENT_SECRET o re-autorizar el app registration",
        },
      };
    case "SP_FORBIDDEN":
      return { status: 403, body: { error: "SP_FORBIDDEN" } };
    case "SP_SITE_NOT_FOUND":
      return { status: 500, body: { error: "SP_SITE_NOT_FOUND" } };
    case "SP_TIMEOUT":
      return { status: 504, body: { error: "SP_TIMEOUT" } };
    case "SP_NOT_CONFIGURED":
      return {
        status: 503,
        body: { error: "INTERNAL", message: "SharePoint no configurado" },
      };
    default:
      return { status: 500, body: { error: "INTERNAL", message } };
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  if (!auth.ok) return fail!;
  if (
    !ALLOWED_ROLES.includes(auth.user.role as (typeof ALLOWED_ROLES)[number])
  ) {
    return NextResponse.json(
      {
        error: "FORBIDDEN",
        message: `Acceso restringido: requiere uno de los roles [${ALLOWED_ROLES.join(", ")}]`,
      },
      { status: 403 },
    );
  }

  // F4: Rate limit por usuario autenticado.
  // 20 generaciones por minuto por usuario. Suficiente para uso legítimo;
  // previene abuso automatizado (bots, scripts de prueba masiva, etc.).
  const rl = rateLimitByIdentity(auth.userId, {
    key: "documents:generate",
    limit: 20,
    windowMs: 60_000,
  });
  if (!rl.allowed) return rl.response!;

  // F4: extraer metadata de auditoría (IP + UA) para el log.
  // M-4: sanitizar IP con regex IPv4/IPv6 antes de pasar al service.
  const xff = req.headers.get("x-forwarded-for");
  const rawIp = xff ? xff.split(",")[0].trim() : req.headers.get("x-real-ip");
  const ip = sanitizeIp(rawIp);
  const userAgent = req.headers.get("user-agent");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Body JSON inválido");
  }
  if (!body || typeof body !== "object") {
    return badRequest("Body debe ser un objeto");
  }
  const reqBody = body as Partial<GenerateDocumentRequest>;
  if (!VALID_ENTITIES.has(reqBody.entity as DocumentEntity)) {
    return badRequest(
      `entity inválido. Esperado uno de: ${Array.from(VALID_ENTITIES).join(", ")}`,
    );
  }
  if (!reqBody.entityId || typeof reqBody.entityId !== "string") {
    return badRequest("entityId requerido");
  }
  if (
    reqBody.templateId !== undefined &&
    typeof reqBody.templateId !== "string"
  ) {
    return badRequest("templateId debe ser string");
  }
  if (
    typeof reqBody.templateId === "string" &&
    !VALID_TEMPLATE_IDS.has(reqBody.templateId as DocumentTemplateId)
  ) {
    return badRequest(
      `templateId inválido. Esperado uno de: ${Array.from(VALID_TEMPLATE_IDS).join(", ")}`,
    );
  }
  // H-1: validar fileNameOverride antes de llegar al service. Si está
  // mal formado, no queremos siquiera intentar la generación.
  if (
    reqBody.fileNameOverride !== undefined &&
    reqBody.fileNameOverride !== null
  ) {
    const v = validateFileName(reqBody.fileNameOverride);
    if (!v.ok === true) {
      return badRequest(
        `fileNameOverride inválido: ${(v as { reason: string }).reason}`,
      );
    }
  }

  const result = await generateAndUpload(
    {
      entity: reqBody.entity as DocumentEntity,
      entityId: reqBody.entityId,
      templateId: reqBody.templateId as DocumentTemplateId | undefined,
      fileNameOverride:
        typeof reqBody.fileNameOverride === "string"
          ? reqBody.fileNameOverride
          : undefined,
      userId: auth.userId,
      ip: ip ?? null,
      userAgent: userAgent ?? null,
    },
    {},
  );

  if (!result.ok) {
    const errResult = result as {
      errorCode: ServiceErrorCode;
      message: string;
      got?: string;
      expected?: DocumentTemplateId[];
      missing?: string[];
    };
    const mapped = mapServiceErrorToApi(
      errResult.errorCode,
      errResult.message,
      {
        got: errResult.got,
        expected: errResult.expected,
        missing: errResult.missing,
      },
    );
    return NextResponse.json(mapped.body, { status: mapped.status });
  }

  return NextResponse.json(
    (
      result as {
        response: import("@/types/documents").GenerateDocumentResponse;
      }
    ).response,
    { status: 200 },
  );
}
