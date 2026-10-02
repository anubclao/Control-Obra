// filepath: src/lib/document-generator/fillers/contrato-disenos.ts
// Filler para "CONTRATO DISEÑOS.docx" — Refactor F2.
// Lee del row de `contracts` con type='DISENOS'.
// Reemplaza "XXXXXXXX" con `scopeOfWork`.

import { replaceInDocx } from "./docx-helpers";
import type { Filler } from "./types";
import type { ContratoDisenosRow } from "./entity-data";

export const contratoDisenosFiller: Filler = async ({
  templateBytes,
  data,
}) => {
  const row = data as ContratoDisenosRow;
  return {
    content: replaceInDocx(templateBytes, {
      XXXXXXXX: row.scopeOfWork,
    }),
    mimetype:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
};
