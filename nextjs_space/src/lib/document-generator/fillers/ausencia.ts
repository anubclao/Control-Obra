// filepath: src/lib/document-generator/fillers/ausencia.ts
// STUB para la plantilla "3.9. FORMATO AUSENCIA LABORAL[1].pdf".
//
// Estado: NO IMPLEMENTADO en F1B. La plantilla es un PDF escaneado que
// NO tiene campos rellenables automáticamente; requiere superposición de
// texto con coordenadas o re-creación del formato en otro formato (HTML
// → PDF con puppeteer, o PDF AcroForm con pdf-lib).
//
// Para no bloquear la integración de los otros 9 templates, este filler
// devuelve un error tipado `NOT_IMPLEMENTED` y el dispatcher lo propaga
// al endpoint con 501 / 422.
//
// Decisiones pendientes (para F3 o fase siguiente):
//   1. ¿Re-crear el formato en HTML+CSS y generar PDF con puppeteer?
//   2. ¿Usar pdf-lib para crear un PDF AcroForm desde cero?
//   3. ¿Reemplazar por un Word (.docx) con placeholders?
//
// Ver docs/specs/document-generation-sharepoint.md §9 (Riesgos).

import type { Filler } from "./types";

export const ausenciaFiller: Filler = async () => {
  throw new Error(
    "AUSENCIA_FILLER_NOT_IMPLEMENTED: el formato es un PDF escaneado sin " +
      "campos rellenables. Ver spec §9 (Riesgos) para opciones de " +
      "implementación (HTML→PDF, AcroForm, reemplazo a docx).",
  );
};
