// filepath: src/lib/document-generator/render.ts
// Dispatcher puro: dado un templateId, carga la plantilla del disco y la
// pasa por el filler correspondiente. Sin I/O de red (SharePoint se hace
// en otro módulo: src/lib/sharepoint/upload.ts).
//
// Para evitar dependencias con filesystem en tests, se acepta `templateLoader`
// inyectable. En producción, defaultLoader lee desde
// /ControlObra/Formatos/<archivo>.

import * as path from "node:path";
import { promises as fs } from "node:fs";
import { TEMPLATE_EXT } from "@/types/documents";
import type { DocumentTemplateId } from "@/types/documents";
import { ocFiller } from "./fillers/oc";
import { anticipoFiller } from "./fillers/anticipo";
import { legalizacionFiller } from "./fillers/legalizacion";
import { osFiller } from "./fillers/os";
import { corteFiller } from "./fillers/corte";
import { ausenciaFiller } from "./fillers/ausencia";
import { contratoGlobalFiller } from "./fillers/contrato-global";
import { contratoUnitarioFiller } from "./fillers/contrato-unitario";
import { contratoDisenosFiller } from "./fillers/contrato-disenos";
import { contratoLaboralFiller } from "./fillers/contrato-laboral";
import type { Filler, FillerContext, FillerRegistry } from "./fillers/types";

/**
 * Mapa templateId → filler. Cada filler se importa aquí para evitar
 * ciclos y mantener el tree-shaking honesto.
 *
 * AUSENCIA: la plantilla es un PDF escaneado sin campos rellenables;
 * el filler lanza NOT_IMPLEMENTED (ver fillers/ausencia.ts).
 */
export const FILLERS: FillerRegistry = {
  OC: ocFiller as Filler,
  "AD-0033": anticipoFiller as Filler,
  LEG: legalizacionFiller as Filler,
  OS: osFiller as Filler,
  CORTE: corteFiller as Filler,
  AUSENCIA: ausenciaFiller as Filler, // throws NOT_IMPLEMENTED
  CONT_GLOBAL: contratoGlobalFiller as Filler,
  CONT_UNITARIO: contratoUnitarioFiller as Filler,
  CONT_DISENOS: contratoDisenosFiller as Filler,
  CONT_LABORAL: contratoLaboralFiller as Filler,
};

export type RenderError =
  | { code: "TEMPLATE_NOT_REGISTERED"; templateId: DocumentTemplateId }
  | { code: "TEMPLATE_FILE_MISSING"; path: string }
  | { code: "FILLER_THREW"; reason: string };

export type RenderResult =
  | {
      ok: true;
      content: Buffer;
      mimetype: FillerContext extends never
        ? never
        :
            | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            | "application/pdf";
    }
  | { ok: false; error: RenderError };

/**
 * Inyectable: dada la ruta absoluta de una plantilla, devuelve sus bytes.
 * Por defecto lee desde /ControlObra/Formatos, donde están los originales.
 */
export type TemplateLoader = (absolutePath: string) => Promise<Buffer>;

export const defaultLoader: TemplateLoader = async (absolutePath) => {
  return await fs.readFile(absolutePath);
};

/**
 * Resuelve la ruta absoluta del archivo de plantilla.
 * Se mantiene como función pura (sin I/O) para testear fácilmente.
 */
export function resolveTemplatePath(
  templateId: DocumentTemplateId,
  formatosRoot: string,
): string {
  const fileName = TEMPLATE_FILE[templateId];
  return path.join(formatosRoot, fileName);
}

/**
 * Versión semántica de la plantilla, inferida del nombre de archivo.
 *
 * Patrones detectados (en orden de prioridad):
 *   1. Prefijo "V<n>-" → ej: "V1-OBRA-PRECIO GLOBAL.docx" → "v1"
 *   2. Prefijo "<n>.<m>. " (numeración del PRD) → ej: "3.2. AD-0033-..."
 *      → "3.2"
 *   3. Sufijo "[<n>]" → ej: "AUSENCIA LABORAL[1].pdf" → "[1]"
 *   4. Si no hay patrón, devuelve "unversioned"
 *
 * F4: este valor se persiste en document_generation_log.template_version
 * para auditoría. Permite detectar cuándo se subió un documento con una
 * versión desactualizada del template y planificar migraciones.
 */
export function detectTemplateVersion(templateId: DocumentTemplateId): string {
  const fileName = TEMPLATE_FILE[templateId];
  // 1) Prefijo V<n>- (más específico, va primero)
  const m1 = /^V(\d+)-/i.exec(fileName);
  if (m1) return `v${m1[1]}`;
  // 2) Sufijo [n] antes que la numeración 3.x para no perderlo
  //    (ej: "3.9. FORMATO AUSENCIA LABORAL[1].pdf" → "[1]", no "3.9").
  const m3 = /\[(\d+)\]/.exec(fileName);
  if (m3) return `[${m3[1]}]`;
  // 3) Prefijo <n>.<m>.
  const m2 = /^(\d+\.\d+)\.\s/.exec(fileName);
  if (m2) return m2[1];
  return "unversioned";
}

/**
 * Tabla de archivos en /ControlObra/Formatos.
 * Mantener sincronizada con la matriz del spec §2.1.
 */
const TEMPLATE_FILE: Record<DocumentTemplateId, string> = {
  "AD-0033": "3.2. AD-0033- SOLICITUD DE ANTICIPO.xlsx",
  LEG: "3.3. FORMATO DE LEGALIZACIÓN O REINTEGRO.xlsx",
  OC: "3.5. FORMATO OC_ ORDEN DE COMPRA.xlsx",
  OS: "3.6. FORMATO OS_ ORDEN DE SERVICIO.xlsx",
  CORTE: "3.7. FORMATO DE CORTE Y MEMORIAS DE OBRA.xlsx",
  AUSENCIA: "3.9. FORMATO AUSENCIA LABORAL[1].pdf",
  CONT_GLOBAL: "V1-OBRA-PRECIO GLOBAL.docx",
  CONT_UNITARIO: "V2-MODELO OBRA-PRECIO UNITARIO.docx",
  CONT_DISENOS: "CONTRATO DISEÑOS.docx",
  CONT_LABORAL: "CONTRATO DE TRABAJO A TÉRMINO INDEFINIDO.docx",
};

/**
 * Renderiza una plantilla con los datos del form + contexto del proyecto.
 *
 * @param templateId  ej: "OC"
 * @param data        datos validados con EXTRA_FIELDS[templateId]
 * @param context     proyecto, proveedor, fecha
 * @param opts        formatosRoot: ruta a /Formatos; loader: override para tests
 */
export async function renderDocument(
  templateId: DocumentTemplateId,
  data: unknown,
  context: FillerContext["context"],
  opts: {
    formatosRoot: string;
    loader?: TemplateLoader;
  },
): Promise<RenderResult> {
  const filler = FILLERS[templateId];
  if (!filler) {
    return {
      ok: false,
      error: { code: "TEMPLATE_NOT_REGISTERED", templateId },
    };
  }
  const tplPath = resolveTemplatePath(templateId, opts.formatosRoot);
  const loader = opts.loader ?? defaultLoader;
  let templateBytes: Buffer;
  try {
    templateBytes = await loader(tplPath);
  } catch (e) {
    return {
      ok: false,
      error: {
        code: "TEMPLATE_FILE_MISSING",
        path: tplPath,
      },
    };
  }
  try {
    const result = await filler({
      templateBytes,
      data,
      context,
    });
    return { ok: true, content: result.content, mimetype: result.mimetype };
  } catch (e: unknown) {
    const reason = e instanceof Error ? e.message : String(e);
    return { ok: false, error: { code: "FILLER_THREW", reason } };
  }
}
