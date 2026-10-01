"use client";

// filepath: src/components/documents/generate-button.tsx
// Botón reutilizable que llama a POST /api/documents/generate.
// Al éxito: muestra el link al archivo subido a SharePoint vía callback
// (típicamente `onGenerated(url, fileName)` que el padre usa para refrescar
// la lista o persistir la URL en la entidad).
//
// Casos cubiertos (consumidos de F2 spec):
//  - SharePoint no configurado → mensaje claro, sin acción
//  - Generación en curso → spinner + texto "Generando y subiendo…"
//  - Éxito → toast/link y callback
//  - Error SharePoint (401/403/404/5xx) → mensaje accionable
//  - Error de validación (ej. payment.type sin plantilla) → mensaje tipado

import { useState } from "react";
import { FileText, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DocumentLink } from "./document-link";
import { cn } from "@/lib/utils";
import type {
  DocumentEntity,
  DocumentTemplateId,
  GenerateDocumentRequest,
  GenerateDocumentResponse,
} from "@/types/documents";

// ---------- Tipos de error tipados que devuelve la API (subset) ----------
// Mantener sincronizado con src/types/documents.ts §4.1.
type ApiErrorBody =
  | { error: "ENTITY_NOT_FOUND" }
  | { error: "ENTITY_INCOMPLETE"; missing: string[] }
  | { error: "TEMPLATE_MISSING"; templateId: string }
  | { error: "TEMPLATE_MISMATCH"; expected: string; got: string }
  | { error: "SP_AUTH_FAILED"; hint: string }
  | { error: "SP_FORBIDDEN" }
  | { error: "SP_SITE_NOT_FOUND" }
  | { error: "SP_TIMEOUT" }
  | { error: "RENDER_FAILED"; reason: string }
  | { error: "INTERNAL"; message: string };

function isApiError(v: unknown): v is ApiErrorBody {
  if (!v || typeof v !== "object") return false;
  const e = (v as { error?: unknown }).error;
  return typeof e === "string" && e.length > 0;
}

function errorToMessage(body: ApiErrorBody): {
  title: string;
  description: string;
} {
  switch (body.error) {
    case "ENTITY_NOT_FOUND":
      return {
        title: "Entidad no encontrada",
        description: "El registro ya no existe. Recarga la página.",
      };
    case "ENTITY_INCOMPLETE":
      return {
        title: "Datos incompletos",
        description: `Faltan campos: ${body.missing.join(", ")}`,
      };
    case "TEMPLATE_MISSING":
      return {
        title: "Sin plantilla",
        description: `No hay plantilla configurada para "${body.templateId}".`,
      };
    case "TEMPLATE_MISMATCH":
      return {
        title: "Tipo no soportado",
        description: `Este registro (${body.got}) no genera un documento con plantilla ${body.expected}.`,
      };
    case "SP_AUTH_FAILED":
      return {
        title: "SharePoint: autenticación",
        description: body.hint,
      };
    case "SP_FORBIDDEN":
      return {
        title: "Sin permisos en SharePoint",
        description:
          "Contacta al administrador para que otorgue acceso al sitio.",
      };
    case "SP_SITE_NOT_FOUND":
      return {
        title: "Sitio SharePoint no encontrado",
        description: "Verifica SP_SITE_ID y SP_DRIVE_ID en .env.local.",
      };
    case "SP_TIMEOUT":
      return {
        title: "Tiempo agotado",
        description: "La subida tardó demasiado. Reintenta en unos segundos.",
      };
    case "RENDER_FAILED":
      return {
        title: "Error al generar el documento",
        description: body.reason,
      };
    case "INTERNAL":
      return {
        title: "Error interno",
        description: body.message,
      };
  }
}

export interface GenerateButtonProps {
  entity: DocumentEntity;
  entityId: string;
  /** Si la entity puede usar varias plantillas, el caller puede forzar una. */
  templateId?: DocumentTemplateId;
  /** URL ya existente (modo "re-generar"). Si se omite, simplemente no muestra el link. */
  currentUrl?: string | null;
  currentFileName?: string | null;
  /** Callback al éxito. El padre decide si refresca la lista o persiste la URL. */
  onGenerated?: (result: GenerateDocumentResponse) => void;
  /** Variante visual del botón. */
  variant?:
    | "default"
    | "outline"
    | "secondary"
    | "destructive"
    | "ghost"
    | "link";
  size?: "default" | "sm" | "lg" | "icon";
  /** Texto del botón. Default: "Generar documento" */
  label?: string;
  /** Deshabilitar manualmente (ej. sin permisos, sin proyecto, etc.) */
  disabled?: boolean;
  /** Tooltip / motivo cuando disabled es true. */
  disabledReason?: string;
  className?: string;
  /** Si true, muestra el documento actual arriba del botón (default true). */
  showCurrentLink?: boolean;
}

export function GenerateButton({
  entity,
  entityId,
  templateId,
  currentUrl,
  currentFileName,
  onGenerated,
  variant = "default",
  size = "sm",
  label = "Generar documento",
  disabled = false,
  disabledReason,
  className,
  showCurrentLink = true,
}: GenerateButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{
    title: string;
    description: string;
  } | null>(null);
  const [lastResult, setLastResult] = useState<GenerateDocumentResponse | null>(
    null,
  );

  async function handleClick() {
    if (loading) return;
    setError(null);
    setLastResult(null);
    setLoading(true);
    try {
      const body: GenerateDocumentRequest = {
        entity,
        entityId,
      };
      if (templateId) body.templateId = templateId;

      const res = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      // 503 con HTML/text → probablemente SharePoint no configurado
      const contentType = res.headers.get("content-type") ?? "";
      const raw: unknown = contentType.includes("application/json")
        ? await res.json()
        : { error: "INTERNAL", message: await res.text() };

      if (!res.ok) {
        if (isApiError(raw)) {
          // 503 con "INTERNAL" + mensaje "SharePoint no configurado" → mostrar
          // versión "no disponible" sin tratarlo como error de sistema.
          if (
            res.status === 503 &&
            raw.error === "INTERNAL" &&
            typeof (raw as { message?: string }).message === "string" &&
            (raw as { message: string }).message
              .toLowerCase()
              .includes("sharepoint")
          ) {
            setError({
              title: "Funcionalidad no disponible",
              description:
                "SharePoint no está configurado en este entorno. Pide al admin configurar las variables SP_* en .env.local.",
            });
          } else {
            setError(errorToMessage(raw));
          }
        } else {
          setError({
            title: `Error ${res.status}`,
            description: "Respuesta inesperada del servidor.",
          });
        }
        return;
      }

      // Éxito
      const ok = raw as GenerateDocumentResponse;
      setLastResult(ok);
      onGenerated?.(ok);
    } catch (e: unknown) {
      setError({
        title: "Error de red",
        description:
          e instanceof Error ? e.message : "No se pudo conectar al servidor.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={cn("flex flex-col gap-2", className)}
      data-testid="generate-button-root"
    >
      {showCurrentLink && currentUrl && !lastResult && (
        <DocumentLink
          webUrl={currentUrl}
          fileName={currentFileName ?? null}
          size="sm"
          label="Documento actual"
        />
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={variant}
          size={size}
          onClick={handleClick}
          disabled={disabled || loading || !entityId}
          title={disabled ? disabledReason : undefined}
          data-testid="generate-button"
          data-entity={entity}
          data-entity-id={entityId}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Generando y subiendo…
            </>
          ) : (
            <>
              <FileText className="mr-2 h-3.5 w-3.5" />
              {label}
            </>
          )}
        </Button>

        {lastResult && (
          <span
            data-testid="generate-button-success"
            className="inline-flex items-center gap-1 text-xs text-emerald-700"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Subido a SharePoint
          </span>
        )}
      </div>

      {lastResult && (
        <DocumentLink
          webUrl={lastResult.webUrl}
          fileName={lastResult.fileName}
          size="sm"
          label="Último documento"
        />
      )}

      {error && (
        <Alert variant="destructive" data-testid="generate-button-error">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{error.title}</AlertTitle>
          <AlertDescription>{error.description}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
