// filepath: src/lib/document-generator/fillers/types.ts
// Contrato común para todos los fillers. Cada filler (oc.ts, anticipo.ts, etc.)
// exporta una función `fill` que recibe la plantilla en bytes y los datos
// validados del form, y devuelve el documento final.

import type { DocumentTemplateId } from "@/types/documents";

/**
 * Contexto que el dispatcher pasa a cada filler.
 * - templateBytes: la plantilla leída del disco (en /Formatos o /templates)
 * - data: resultado de validar el form con EXTRA_FIELDS[tpl]
 * - context: datos derivados (proyecto, proveedor, contratista) ya en camelCase
 */
export interface FillerContext<TData = unknown> {
  templateBytes: Buffer;
  data: TData;
  context: {
    project?: { code: string; name: string; client: string; location: string };
    provider?: { name: string; nit: string; email?: string; phone?: string };
    contractNumber?: string;
    today: string; // ISO YYYY-MM-DD
  };
}

/**
 * Resultado uniforme de un filler.
 * - content: bytes del documento generado
 * - mimetype: para la respuesta HTTP
 */
export interface FillerResult {
  content: Buffer;
  mimetype:
    | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    | "application/pdf";
}

export type Filler = (ctx: FillerContext) => Promise<FillerResult>;

/**
 * Registry de fillers — cada templateId conoce su función de relleno.
 * Se exporta desde render.ts (donde se importan los fillers uno a uno).
 */
export type FillerRegistry = Partial<Record<DocumentTemplateId, Filler>>;
