// src/lib/providers-documents/paths.ts
//
// Construcción de paths y sanitización de nombres para documentos de
// proveedor en SharePoint.
//
// Convención (decidida 2026-10-14, spec §3):
//   Proyectos/{projectCode}/Proveedores/{providerCode}/{DocumentType}/
//
// NO se debe importar desde src/lib/sharepoint/paths.ts (que es para
// documentos GENERADOS desde plantilla, e.g. Anticipos, OC). Esta
// función es específica de documentos de PROVEEDOR.

import type { ProviderDocumentType } from "@/types";

export interface BuildProviderDocumentPathInput {
  /** "Proyectos" (default, configurable via SP_BASE_PATH). */
  basePath: string;
  /** Código del proyecto (ej: "PV-2026-001"). */
  projectCode: string;
  /** Código del proveedor (ej: "PROV-EMPRESA-A"). */
  providerCode: string;
  /** Tipo de documento del enum ProviderDocumentType. */
  documentType: ProviderDocumentType;
  /** Nombre del archivo (ya sanitizado por `sanitizeFileName`). */
  fileName: string;
}

export interface BuildProviderDocumentPathResult {
  folderPath: string;
  fileName: string;
}

/**
 * Resuelve la ruta SharePoint para un documento de proveedor.
 * Ejemplo:
 *   buildProviderDocumentPath({
 *     basePath: "Proyectos",
 *     projectCode: "PV-2026-001",
 *     providerCode: "PROV-EMPRESA-A",
 *     documentType: "CEDULA",
 *     fileName: "cedula-representante-legal.pdf",
 *   })
 *   => {
 *     folderPath: "Proyectos/PV-2026-001/Proveedores/PROV-EMPRESA-A/CEDULA",
 *     fileName: "cedula-representante-legal.pdf",
 *   }
 */
export function buildProviderDocumentPath(
  input: BuildProviderDocumentPathInput,
): BuildProviderDocumentPathResult {
  // Limpia cada segmento de leading/trailing slashes para evitar
  // "Proyectos//PV-001/..." (que SharePoint rechaza).
  const clean = (s: string) => s.replace(/^\/+|\/+$/g, "");
  return {
    folderPath: `${clean(input.basePath)}/${clean(input.projectCode)}/Proveedores/${clean(input.providerCode)}/${clean(input.documentType)}`,
    fileName: input.fileName,
  };
}

/**
 * Sanitiza un nombre de archivo para que sea seguro en SharePoint:
 *  - Reemplaza caracteres no permitidos (acentos, ñ, espacios) por equivalentes ASCII.
 *  - Colapsa separadores múltiples.
 *  - Limita a 100 chars.
 *  - Retorna "archivo" si queda vacío.
 */
export function sanitizeFileName(name: string): string {
  if (!name || typeof name !== "string") return "archivo";

  // 1. NFD normalization: descompone acentos (á → a + ́).
  // 2. Strip combining marks (remove ́).
  // 3. Reemplaza ñ → n (es un solo carácter, no se descompone).
  // 4. Lowercase.
  // 5. Reemplaza cualquier cosa que no sea [a-z0-9._-] por -.
  // 6. Colapsa separadores múltiples.
  // 7. Trim - de los extremos.
  // 8. Si queda vacío, "archivo".
  // 9. Cap a 100 chars.
  let s = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // combining marks
    .replace(/ñ/g, "n")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-") // no-ASCII alnum → -
    .replace(/-+/g, "-") // colapsa -
    .replace(/^-+|-+$/g, ""); // trim -

  if (!s) s = "archivo";

  if (s.length > 100) {
    // Mantener la extensión si existe
    const dot = s.lastIndexOf(".");
    if (dot > 0 && s.length - dot <= 10) {
      const ext = s.slice(dot);
      s = s.slice(0, 100 - ext.length) + ext;
    } else {
      s = s.slice(0, 100);
    }
  }

  return s;
}
