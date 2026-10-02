// filepath: src/lib/document-generator/fillers/contrato-laboral.ts
// Filler para "CONTRATO DE TRABAJO A TÉRMINO INDEFINIDO.docx" — Refactor F2.
// Lee del row de `employees`.
// Textos literales de la plantilla:
//   "XXXXXX"                  → position (cargo)
//   "MARZO TRIANGULAR S.A.S." → context.project?.client (empleador)
//   "830.055.571-1"           → NIT del empleador (fijo)

import { replaceInDocx } from "./docx-helpers";
import type { Filler } from "./types";
import type { ContratoLaboralRow } from "./entity-data";

export const contratoLaboralFiller: Filler = async ({
  templateBytes,
  data,
  context,
}) => {
  const row = data as ContratoLaboralRow;
  const replacements: Record<string, string | number> = {
    XXXXXX: row.position,
  };
  if (context.project?.client) {
    replacements["MARZO TRIANGULAR S.A.S."] = context.project.client;
  }
  // NIT del empleador es fijo según la plantilla.
  return {
    content: replaceInDocx(templateBytes, replacements),
    mimetype:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
};
