// filepath: src/types/documents.ts
// Tipos para el feature "Generación de documentos por módulo + SharePoint".
// Esta capa es SOLO tipos y constantes — sin I/O, sin dependencias externas.

/**
 * Entidades que pueden generar un documento.
 * Mantener sincronizado con la matriz del spec
 * (docs/specs/document-generation-sharepoint.md §2.1).
 */
export type DocumentEntity =
  | "payments"
  | "expenses"
  | "cuts"
  | "contracts"
  | "employees"
  | "workLogs";

/**
 * ID de cada plantilla soportada.
 * Corresponde 1:1 con los archivos en /ControlObra/Formatos.
 */
export type DocumentTemplateId =
  | "AD-0033" // 3.2. SOLICITUD DE ANTICIPO.xlsx
  | "LEG" // 3.3. LEGALIZACIÓN O REINTEGRO.xlsx
  | "OC" // 3.5. ORDEN DE COMPRA.xlsx
  | "OS" // 3.6. ORDEN DE SERVICIO.xlsx
  | "CORTE" // 3.7. CORTE Y MEMORIAS DE OBRA.xlsx
  | "AUSENCIA" // 3.9. AUSENCIA LABORAL.pdf
  | "CONT_GLOBAL" // V1-OBRA-PRECIO GLOBAL.docx
  | "CONT_UNITARIO" // V2-OBRA-PRECIO UNITARIO.docx
  | "CONT_DISENOS" // CONTRATO DISEÑOS.docx
  | "CONT_LABORAL"; // CONTRATO DE TRABAJO A TÉRMINO INDEFINIDO.docx

/**
 * Convención de carpeta SharePoint por plantilla.
 * Se usa en buildProjectPath() para resolver la ruta.
 */
export const TEMPLATE_FOLDER = {
  "AD-0033": "01-Anticipos",
  LEG: "04-Legalizaciones",
  OC: "02-OC-OS",
  OS: "02-OC-OS",
  CORTE: "03-Cortes",
  AUSENCIA: "05-Ausencias",
  CONT_GLOBAL: "06-Contratos/Obra",
  CONT_UNITARIO: "06-Contratos/Obra",
  CONT_DISENOS: "06-Contratos/Disenos",
  CONT_LABORAL: "06-Contratos/Laboral",
} as const satisfies Record<DocumentTemplateId, string>;

/**
 * Extensión esperada por plantilla. Sirve para validar antes de subir.
 */
export const TEMPLATE_EXT = {
  "AD-0033": "xlsx",
  LEG: "xlsx",
  OC: "xlsx",
  OS: "xlsx",
  CORTE: "xlsx",
  AUSENCIA: "pdf",
  CONT_GLOBAL: "docx",
  CONT_UNITARIO: "docx",
  CONT_DISENOS: "docx",
  CONT_LABORAL: "docx",
} as const satisfies Record<DocumentTemplateId, "xlsx" | "docx" | "pdf">;

/**
 * Errores tipados que devuelve el endpoint /api/documents/generate.
 * El cliente los puede discriminar para mostrar mensajes accionables.
 */
export type GenerateDocumentError =
  | { error: "ENTITY_NOT_FOUND" }
  | { error: "ENTITY_INCOMPLETE"; missing: string[] }
  | { error: "TEMPLATE_MISSING"; templateId: string }
  | { error: "TEMPLATE_MISMATCH"; expected: DocumentTemplateId; got: string }
  | { error: "RENDER_FAILED"; reason: string }
  | { error: "SP_AUTH_FAILED"; hint: string }
  | { error: "SP_FORBIDDEN" }
  | { error: "SP_SITE_NOT_FOUND" }
  | { error: "SP_TIMEOUT" }
  | { error: "INTERNAL"; message: string };

/**
 * Body de POST /api/documents/generate.
 */
export interface GenerateDocumentRequest {
  entity: DocumentEntity;
  entityId: string;
  templateId?: DocumentTemplateId;
  fileNameOverride?: string;
}

/**
 * Respuesta exitosa de POST /api/documents/generate.
 */
export interface GenerateDocumentResponse {
  ok: true;
  webUrl: string;
  fileName: string;
  path: string;
  sizeBytes: number;
  version: number;
  templateId: DocumentTemplateId;
  generatedAt: string;
}
