// filepath: src/lib/document-generator/fillers/contrato-unitario.ts
// Filler para "V2-MODELO OBRA-PRECIO UNITARIO.docx" — Refactor F2.
// Lee del row de `contracts` con type='OBRA' y pricingMode='UNIT_PRICE'.
// Reemplaza "XXXXXXXX" con un resumen del `scopeOfWork`.

import { replaceInDocx } from "./docx-helpers";
import type { Filler } from "./types";
import type { ContratoObraRow } from "./entity-data";

export const contratoUnitarioFiller: Filler = async ({
  templateBytes,
  data,
}) => {
  const row = data as ContratoObraRow;
  return {
    content: replaceInDocx(templateBytes, {
      XXXXXXXX: row.scopeOfWork,
    }),
    mimetype:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
};
