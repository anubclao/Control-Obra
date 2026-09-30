// filepath: src/lib/sharepoint/paths.ts
// Resolución pura de rutas SharePoint a partir del proyecto + entidad.
// No hace I/O. Mantener en sincronía con la matriz del spec
// docs/specs/document-generation-sharepoint.md §2.1.

import { TEMPLATE_FOLDER } from "@/types/documents";
import type { DocumentEntity, DocumentTemplateId } from "@/types/documents";

/**
 * Slug amigable para nombres de archivo. Quita tildes, reemplaza
 * caracteres no seguros por "_". Sin dependencias externas.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita diacríticos
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function isoYearMonth(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function entityRecordGet(record: unknown, key: string): unknown {
  if (record && typeof record === "object") {
    return (record as Record<string, unknown>)[key];
  }
  return undefined;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/**
 * Devuelve la fecha de la entidad si existe (createdAt, fecha, fechaCorte,
 * fechaInicio, etc.). Si no, hoy.
 */
function pickDate(entity: DocumentEntity, record: unknown): Date {
  const candidates = [
    "fecha",
    "fechaCorte",
    "fechaInicio",
    "createdAt",
    "created_at",
    "fechaInicioAusencia",
  ];
  for (const k of candidates) {
    const v = entityRecordGet(record, k);
    const d = parseDateLike(v);
    if (d) return d;
  }
  return new Date();
}

/**
 * Parsea un valor a Date respetando fecha local si es YYYY-MM-DD puro.
 * - "2026-05-15" -> 15 de mayo local (no UTC, evita off-by-1 en zonas -X).
 * - "2026-05-15T..." o con hora -> new Date() estándar.
 * - number (epoch ms) o Date -> new Date().
 */
function parseDateLike(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "string" && v.trim() !== "") {
    const s = v.trim();
    // YYYY-MM-DD puro -> local
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
    const dt = new Date(s);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  return null;
}

function pickProjectCode(record: unknown): string {
  // El record puede tener `projectCode` o `projectId` + relación.
  // Para F1B asumimos que el caller ya resuelve y nos pasa `projectCode` aquí.
  const direct =
    asString(entityRecordGet(record, "projectCode")) ||
    asString(entityRecordGet(record, "code")) ||
    asString(entityRecordGet(record, "proyectoCodigo"));
  if (direct) return direct;
  // Fallback: del project embebido
  const project = entityRecordGet(record, "project");
  if (project && typeof project === "object") {
    const p = project as Record<string, unknown>;
    return asString(p.code) || asString(p.codigo);
  }
  return "SIN_PROYECTO";
}

function pickNum(entity: DocumentEntity, record: unknown): number {
  const candidates =
    entity === "cuts"
      ? ["numeroCorte", "numero", "consecutivo"]
      : entity === "expenses"
        ? ["numero", "consecutivo"]
        : ["numero", "consecutivo", "id"];
  for (const k of candidates) {
    const n = asNumber(entityRecordGet(record, k));
    if (n) return n;
  }
  return 0;
}

function pickEmployeeSlug(record: unknown): string {
  return (
    asString(entityRecordGet(record, "empleadoSlug")) ||
    slugify(asString(entityRecordGet(record, "nombre")) || "EMPLEADO")
  );
}

function pickClientSlug(record: unknown): string {
  return (
    asString(entityRecordGet(record, "clienteSlug")) ||
    slugify(asString(entityRecordGet(record, "cliente")) || "CLIENTE")
  );
}

function pickContratistaSlug(record: unknown): string {
  return (
    asString(entityRecordGet(record, "contratistaSlug")) ||
    slugify(asString(entityRecordGet(record, "contratista")) || "CONTRATISTA")
  );
}

export interface BuildPathResult {
  /** Carpeta relativa dentro de la biblioteca. Ej: "Proyectos/P001/01-Anticipos" */
  folderPath: string;
  /** Nombre del archivo (sin ruta). */
  fileName: string;
}

/**
 * Resuelve la ruta SharePoint a partir de la plantilla + record de la entidad.
 * - basePath viene de SP_BASE_PATH (default "Proyectos").
 * - Subcarpeta de proyecto es basePath/{projectCode}.
 * - Subcarpeta de plantilla es TEMPLATE_FOLDER[templateId].
 * - Nombre de archivo: ver spec §2.1.
 */
export function buildProjectPath(
  basePath: string,
  templateId: DocumentTemplateId,
  entity: DocumentEntity,
  record: unknown,
): BuildPathResult {
  const projectCode = pickProjectCode(record);
  const templateFolder = TEMPLATE_FOLDER[templateId];

  const projectFolder = `${basePath}/${projectCode}`;
  const folderPath = `${projectFolder}/${templateFolder}`;
  const date = pickDate(entity, record);
  const dateStr = isoDate(date);
  const yearMonth = isoYearMonth(date);

  let fileName: string;
  switch (templateId) {
    case "AD-0033":
      fileName = `AD-0033_${projectCode}_${dateStr}.xlsx`;
      break;
    case "LEG":
      fileName = `LEG_${projectCode}_${dateStr}.xlsx`;
      break;
    case "OC": {
      const num = pickNum(entity, record);
      fileName = `OC_${projectCode}_${num || dateStr}.xlsx`;
      break;
    }
    case "OS": {
      const num = pickNum(entity, record);
      fileName = `OS_${projectCode}_${num || dateStr}.xlsx`;
      break;
    }
    case "CORTE": {
      const num = pickNum(entity, record);
      fileName = `CORTE_${projectCode}_${num || "X"}_${yearMonth}.xlsx`;
      break;
    }
    case "AUSENCIA": {
      const emp = pickEmployeeSlug(record);
      fileName = `AUS_${emp}_${dateStr}.pdf`;
      break;
    }
    case "CONT_GLOBAL": {
      const c = pickContratistaSlug(record);
      fileName = `CONT_${projectCode}_${c}_GLOBAL.docx`;
      break;
    }
    case "CONT_UNITARIO": {
      const c = pickContratistaSlug(record);
      fileName = `CONT_${projectCode}_${c}_UNITARIO.docx`;
      break;
    }
    case "CONT_DISENOS": {
      const c = pickClientSlug(record);
      fileName = `CONT-DIS_${projectCode}_${c}.docx`;
      break;
    }
    case "CONT_LABORAL": {
      const emp = pickEmployeeSlug(record);
      fileName = `LAB_${emp}_${dateStr}.docx`;
      break;
    }
    default: {
      const _exhaustive: never = templateId;
      throw new Error(
        `buildProjectPath: templateId no soportado: ${String(_exhaustive)}`,
      );
    }
  }

  return { folderPath, fileName };
}
