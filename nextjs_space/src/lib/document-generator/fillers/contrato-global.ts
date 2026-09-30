// filepath: src/lib/document-generator/fillers/contrato-global.ts
// Filler para "V1-OBRA-PRECIO GLOBAL.docx" — Refactor F2.
// Lee del row de `contracts` con type='OBRA' y pricingMode='LUMP_SUM'.
// Reemplaza el literal "XXXXXXXX" en la plantilla con `scopeOfWork`.

import { replaceInDocx } from "./docx-helpers";
import type { Filler } from "./types";
import type { ContratoObraRow } from "./entity-data";

export const contratoGlobalFiller: Filler = async ({ templateBytes, data }) => {
  const row = data as ContratoObraRow;
  const replacements: Record<string, string | number> = {
    XXXXXXXX: row.scopeOfWork,
  };
  return {
    content: replaceInDocx(templateBytes, replacements),
    mimetype:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
};
