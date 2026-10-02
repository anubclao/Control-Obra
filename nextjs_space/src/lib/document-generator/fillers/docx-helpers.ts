// filepath: src/lib/document-generator/fillers/docx-helpers.ts
// Wrappers para rellenar plantillas docx con dos estrategias:
//
// 1. **renderDocx(bytes, data)** — usa docxtemplater. Requiere que la
//    plantilla tenga placeholders {campo}. Ideal para plantillas oficiales
//    producidas por la app con un editor.
//
// 2. **replaceInDocx(bytes, replacements)** — busca texto literal en
//    word/document.xml y lo reemplaza. Útil para los formatos entregados
//    por el cliente que son EJEMPLOS rellenados (no plantillas con
//    placeholders). Es más frágil pero funciona out-of-the-box.
//
// Estrategia híbrida recomendada:
//   - F1B (actual): replaceInDocx con los textos literales identificados.
//   - F2 (futuro): cuando el cliente agregue {campo} a sus plantillas,
//     migrar a renderDocx. El switch es 1 línea.

import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

/**
 * Renderiza una plantilla docx sustituyendo los placeholders {campo} y
 * los loops {#items} por los datos proporcionados.
 */
export function renderDocx(
  templateBytes: Buffer,
  data: Record<string, unknown>,
): Buffer {
  const zip = new PizZip(templateBytes);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });
  doc.render(data);
  const out = doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  return out as Buffer;
}

/**
 * Lista placeholders {campo} en una plantilla docx.
 */
export function listDocxPlaceholders(templateBytes: Buffer): string[] {
  const xml = readDocumentXml(templateBytes);
  const placeholders: string[] = [];
  const re = /\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const token = m[1].trim();
    if (token.startsWith("#") || token.startsWith("/")) continue;
    if (!placeholders.includes(token)) placeholders.push(token);
  }
  return placeholders;
}

/**
 * Reemplaza texto literal en word/document.xml. Cada entry de
 * `replacements` es `{ buscar: reemplazar }`. El buscar se trata como
 * texto literal (no regex). NO se preservan marcas de formato si el
 * texto original estaba partido en varios <w:r>, pero en la práctica
 * los nombres de empresa / NIT / etc. caben en un solo <w:t>.
 *
 * Si el texto a buscar NO existe en la plantilla, el reemplazo se omite
 * silenciosamente (no falla). Esto permite llamar la función con campos
 * opcionales.
 */
export function replaceInDocx(
  templateBytes: Buffer,
  replacements: Record<string, string | number | undefined | null>,
): Buffer {
  const zip = new PizZip(templateBytes);
  const file = zip.file("word/document.xml");
  if (!file) {
    throw new Error("docx has no word/document.xml");
  }
  let xml = file.asText();

  for (const [buscar, valorRaw] of Object.entries(replacements)) {
    if (valorRaw === undefined || valorRaw === null) continue;
    const valor = String(valorRaw);
    if (!xml.includes(buscar)) continue; // skip silenciosamente

    // Caso 1: el texto cabe en un solo <w:t>...</w:t>
    const tRe = new RegExp(
      `(<w:t[^>]*>)([^<]*?)(${escapeRegex(buscar)})([^<]*?)(</w:t>)`,
      "g",
    );
    xml = xml.replace(tRe, (_, open, pre, _mid, post, close) => {
      return `${open}${pre}${valor}${post}${close}`;
    });
  }

  zip.file("word/document.xml", xml);
  const out = zip.generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  return out as Buffer;
}

/** Lee word/document.xml como string. Helper interno. */
function readDocumentXml(templateBytes: Buffer): string {
  const zip = new PizZip(templateBytes);
  const file = zip.file("word/document.xml");
  if (!file) return "";
  return file.asText();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
