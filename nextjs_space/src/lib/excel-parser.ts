// Parser de Excel para Presupuesto Tope
// Usa xlsx (SheetJS) para leer .xlsx/.xls/.csv en el browser.

import * as XLSX from "xlsx";
import type { BudgetLayer, BudgetItem, BudgetLayerType } from "@/types";

export interface ParsedExcelRow {
  rowNumber: number;
  raw: Record<string, string>;
  code: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  layerType: BudgetLayerType;
  layerName?: string;
  classification?: string;
  computedTotal?: number;
}

/**
 * Resumen por frente (clasificacion del Excel). Un proyecto puede tener N
 * frentes, todos parte del mismo PT.
 */
export interface FrenteSummary {
  name: string;
  itemCount: number;
  subtotal: number;
  chapterCount: number;
}

export interface ParsedExcel {
  /** Contenido de la fila 1 del Excel (titulo del proyecto). */
  title: string;
  rows: ParsedExcelRow[];
  frentes: FrenteSummary[];
  totalValue: number;
  chapterCount: number;
  itemCount: number;
  warnings: string[];
}

export interface ExcelColumnMapping {
  code: string;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  classification?: string;
}

// Detección automática: busca en los headers palabras clave
export function detectColumns(headers: string[]): ExcelColumnMapping {
  // P0 plan 2026-10-02 (bugfix): normalizar acentos antes de comparar.
  // Headers como "ÍTEM DE PAGO" o "DESCRIPCIÓN" no matcheaban con keywords
  // "item" / "descripcion" porque la i/d con tilde son code points distintos.
  // NFD descompone "í" en "i" + combining acute (U+0301), y la regex
  // strip combining marks se queda con el caracter base. Asi
  // "ÍTEM DE PAGO" → "item de pago" y matchea "item".
  const strip = (s: string) =>
    s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const lower = headers.map(strip);
  const find = (...keywords: string[]) => {
    for (const kw of keywords) {
      const normalizedKw = strip(kw);
      const idx = lower.findIndex((h) => h.includes(normalizedKw));
      if (idx >= 0) return headers[idx];
    }
    return "";
  };

  return {
    code: find(
      "código",
      "codigo",
      "cod",
      "item",
      "número",
      "numero",
      "no.",
      "n°",
    ),
    description: find(
      "descripción",
      "descripcion",
      "desc",
      "concepto",
      "actividad",
      "detalle",
    ),
    unit: find("unidad", "un", "u.m.", "um"),
    quantity: find(
      "cantidad",
      "cant",
      "qty",
      "volumen",
      "metrado",
      "rendimiento",
    ),
    unitPrice: find(
      "precio unitario",
      "p. unitario",
      "p.unit",
      "valor unit",
      "v. unit",
      "precio",
    ),
    totalPrice: find("total", "valor total", "importe", "subtotal", "v. total"),
    classification: find(
      "clasificación",
      "clasificacion",
      "categoria",
      "categoría",
      "capitulo",
      "capítulo",
    ),
  };
}

// ---------------------------------------------------------------------------
// Title extraction + matching (SPEC: budget-upload-validation.md AC-1)
// ---------------------------------------------------------------------------

/**
 * Devuelve el primer string no-vacio de la fila 1 del Excel, sin espacios
 * al inicio/final. Si todas las celdas de la fila 1 estan vacias (algunos
 * Excel exportados dejan 2-3 filas vacias), salta hasta encontrar una fila
 * con contenido.
 *
 * El titulo suele ser el nombre del proyecto: "PRESUPUESTO GENERAL
 * PARQUES DEL VALLE". La validacion contra project.name se hace con
 * `titlesMatch` (case + accent insensitive, por contencion).
 */
export function extractTitle(firstRow: ReadonlyArray<unknown>): string {
  for (const cell of firstRow) {
    const s = String(cell ?? "").trim();
    if (s) return s;
  }
  return "";
}

/** Lowercase + trim + sin diacriticos. Util para matching flexible. */
export function normalizeForTitleMatch(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * True si los dos titulos "son equivalentes" tras normalizar (case +
 * acentos). Acepta por contencion en cualquier direccion: o `a` esta
 * dentro de `b`, o `b` esta dentro de `a`. Esto cubre el caso real donde
 * el Excel dice "PRESUPUESTO GENERAL <X>" y el project.name es "<X>".
 *
 * Si alguno es vacio, devuelve false (no aceptamos titulos faltantes).
 */
export function titlesMatch(a: string, b: string): boolean {
  const na = normalizeForTitleMatch(a);
  const nb = normalizeForTitleMatch(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

// ---------------------------------------------------------------------------
// Frente grouping (SPEC: budget-upload-validation.md AC-4)
// ---------------------------------------------------------------------------

const UNCLASSIFIED = "__UNCLASSIFIED__";

/**
 * Agrupa rows por `classification` (frente), preservando el orden de primera
 * aparicion. Rows sin classification caen en `UNCLASSIFIED`. Solo rows
 * `layerType === 'ITEM'` se cuentan; CHAPTER / SUBCHAPTER son headers
 * que no son "trabajo" por si mismos.
 */
export function groupByFrente(
  rows: ReadonlyArray<ParsedExcelRow>,
): Map<string, ParsedExcelRow[]> {
  const map = new Map<string, ParsedExcelRow[]>();
  for (const row of rows) {
    if (row.layerType !== "ITEM") continue;
    const key = row.classification?.trim() || UNCLASSIFIED;
    const bucket = map.get(key);
    if (bucket) bucket.push(row);
    else map.set(key, [row]);
  }
  return map;
}

/**
 * Resumen numerico de un frente: cantidad de items, subtotal sumado, y
 * cantidad de capitulos distintos. Capitulos = la parte del codigo hasta
 * el primer punto (1.1.1 -> 1).
 */
export function computeFrenteSummary(
  name: string,
  rows: ReadonlyArray<ParsedExcelRow>,
): FrenteSummary {
  let itemCount = 0;
  let subtotal = 0;
  const chapters = new Set<string>();
  for (const row of rows) {
    if (row.layerType !== "ITEM") continue;
    itemCount++;
    subtotal += row.totalPrice;
    const chapter = String(row.code ?? "").split(".")[0];
    if (chapter) chapters.add(chapter);
  }
  return {
    name,
    itemCount,
    subtotal,
    chapterCount: chapters.size,
  };
}

// Convierte un string a número, manejando formatos comunes (1.234,56 → 1234.56)
// y el formato anglosajón (1,234.56 → 1234.56). Regla: el separador que
// aparezca MÁS A LA DERECHA es el decimal; el otro es separador de miles.
//
// Caso especial para moneda colombiana (comun en presupuestos oficiales):
// "$ 7,434,742" tiene SOLO comas (sin punto). En ese caso las comas son
// SIEMPRE separadores de miles, no decimales. El codigo anterior las
// trataba como decimales (cayendo en el return final que reemplaza la
// ultima coma por punto), lo que daba "$ 7,434,742" -> 7.434742 en vez
// de 7434742. Por eso los totales del modal salian como $56.069 en vez
// de $11.234.939.521.
export function parseNumber(value: string | undefined): number {
  if (value === undefined || value === null) return 0;
  const trimmed = String(value).trim();
  if (trimmed === "") return 0;
  // Limpiar símbolos de moneda y espacios, conservar dígitos, coma, punto y signo.
  const cleaned = trimmed.replace(/[^\d,.\-]/g, "");
  if (cleaned === "" || cleaned === "-") return 0;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  // Sin separadores: parseo directo (ej: "1234").
  if (lastComma === -1 && lastDot === -1) {
    return parseFloat(cleaned) || 0;
  }
  // Solo comas, sin punto: el caso ambiguo. Heuristica:
  //  - Si hay UNA sola coma ("0,99" o "3703,68"), tratar como decimal
  //    EU (coma = decimal, ej: presupuestos que usan coma para decimales).
  //  - Si hay DOS o mas comas ("7,434,742" o "1,234,567"), NO puede
  //    ser decimal (un decimal solo tiene una coma); tratar como miles.
  //    Caso del Excel "PARQUES DEL VALLE" del 2026-10-03 donde
  //    "$ 7,434,742" (sin punto) daba 7.434742 en vez de 7434742.
  if (lastDot === -1) {
    const commaCount = (cleaned.match(/,/g) || []).length;
    if (commaCount >= 2) {
      // Multi-coma sin punto: miles seguros.
      return parseFloat(cleaned.replace(/,/g, "")) || 0;
    }
    // Una sola coma sin punto: decimal EU.
    return parseFloat(cleaned.replace(",", ".")) || 0;
  }
  // Solo puntos, sin coma: misma heuristica que el caso de solo comas.
  //  - Un solo punto: "1.234" como 1.234 decimal.
  //  - Dos o mas puntos: "1.234.567" -> 1234567 (miles). Un decimal solo
  //    tiene un punto, asi que multiples puntos = miles seguros.
  //    Caso del 2026-10-03 que descubrimos con los nuevos tests.
  if (lastComma === -1) {
    const dotCount = (cleaned.match(/\./g) || []).length;
    if (dotCount >= 2) {
      return parseFloat(cleaned.replace(/\./g, "")) || 0;
    }
    return parseFloat(cleaned) || 0;
  }
  // Ambos: el que aparece MÁS A LA DERECHA es el decimal; el otro es miles.
  if (lastComma > lastDot) {
    // Formato colombiano/europeo: 1.234,56
    return parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
  }
  // Formato anglosajón: 1,234.56
  return parseFloat(cleaned.replace(/,/g, "")) || 0;
}

// Detecta si una fila es un capítulo (sin cantidad/precio pero tiene código y descripción)
function detectRowType(
  row: Record<string, string>,
  mapping: ExcelColumnMapping,
): {
  type: BudgetLayerType;
  layerName?: string;
} {
  const code = (row[mapping.code] || "").trim();
  const description = (row[mapping.description] || "").trim();
  const quantity = parseNumber(row[mapping.quantity]);
  const unitPrice = parseNumber(row[mapping.unitPrice]);
  const dots = (code.match(/\./g) || []).length;

  // P0 plan 2026-10-02 (bugfix): si la fila no tiene cantidad ni precio,
  // es un encabezado (capitulo o subcapitulo). Antes toda fila sin cant/
  // precio quedaba como CHAPTER, asi que '1.1 PRELIMINARES' aparecia como
  // CAP y no como SUB. Ahora: 1+ puntos en el codigo = SUBCHAPTER.
  if (!quantity && !unitPrice && description) {
    if (dots >= 1) return { type: "SUBCHAPTER", layerName: description };
    return { type: "CHAPTER", layerName: description };
  }

  // Fila con cant/precio: es un item (puede tener 0, 1 o 2+ puntos en el
  // codigo, p.ej. '1', '1.1' o '1,1,1' en presupuestos municipales).
  return { type: "ITEM" };
}

// Parsea el contenido "crudo" (simulando haber leído el Excel)
export function parseExcelContent(
  rows: Array<Record<string, string>>,
  customMapping?: Partial<ExcelColumnMapping>,
): ParsedExcel {
  if (rows.length === 0) {
    return {
      title: "",
      rows: [],
      frentes: [],
      totalValue: 0,
      chapterCount: 0,
      itemCount: 0,
      warnings: ["Archivo vacío"],
    };
  }

  const headers = Object.keys(rows[0]);
  const mapping: ExcelColumnMapping = {
    ...detectColumns(headers),
    ...customMapping,
  };
  const warnings: string[] = [];

  if (!mapping.description)
    warnings.push("No se detectó columna de descripción");
  if (!mapping.quantity) warnings.push("No se detectó columna de cantidad");
  if (!mapping.unitPrice)
    warnings.push("No se detectó columna de precio unitario");

  const parsedRows: ParsedExcelRow[] = rows.map((raw, idx) => {
    const { type, layerName } = detectRowType(raw, mapping);
    const quantity = parseNumber(raw[mapping.quantity]);
    const unitPrice = parseNumber(raw[mapping.unitPrice]);
    const total = parseNumber(raw[mapping.totalPrice]) || quantity * unitPrice;
    return {
      rowNumber: idx + 2, // +1 header, +1 base 1
      raw,
      code: (raw[mapping.code] || "").trim(),
      description: (raw[mapping.description] || "").trim(),
      unit: (raw[mapping.unit] || "").trim() || "GL",
      quantity,
      unitPrice,
      totalPrice: total,
      layerType: type,
      layerName,
      classification: mapping.classification
        ? (raw[mapping.classification] || "").trim() || undefined
        : undefined,
    };
  });

  // P0 plan 2026-10-02 (espejo del Excel): calcular el TOTAL de cada
  // capitulo/subcapitulo sumando los items que vienen debajo hasta el
  // proximo encabezado. En presupuestos municipales, la celda de total
  // de los encabezados esta vacia — el usuario espera ver la suma
  // acumulada (asi figura en la planilla original). Tambien detectamos
  // cuando la Clasificacion cambia: si lo hace sin haber encontrado un
  // encabezado con codigo "1", "2", etc., forzamos el row como CHAPTER.
  let currentClassification = "";
  for (let i = 0; i < parsedRows.length; i++) {
    const row = parsedRows[i];
    if (row.classification && row.classification !== currentClassification) {
      // Cambio de clasificacion = nuevo capitulo logico
      if (currentClassification !== "" && row.layerType === "ITEM") {
        row.layerType = "CHAPTER";
        row.layerName = row.classification;
      }
      currentClassification = row.classification;
    }

    if (row.layerType !== "CHAPTER" && row.layerType !== "SUBCHAPTER") continue;
    let sum = 0;
    for (let j = i + 1; j < parsedRows.length; j++) {
      const next = parsedRows[j];
      if (
        next.layerType === "CHAPTER" ||
        next.layerType === "SUBCHAPTER"
      ) break;
      sum += next.totalPrice;
    }
    row.computedTotal = sum;
  }

  // P0 plan 2026-10-03 (bug): el Excel del PRESUPUESTO OFICIAL INFRADEPORTIVO
  // tiene una seccion final de "Tramites" al pie (CERTIFICACIONES RETIE,
  // IMPUESTOS EPSA, PLAN DE MANEJO AMBIENTAL, etc.). Esos items comparten
  // clasificacion con uno de los frentes principales (mismo proyecto) pero
  // son tramites administrativos, NO items de construccion. El "VALOR TOTAL
  // PRESUPUESTO" del Excel ($5.556.464.503) NO los incluye — son un cargo
  // separado del presupuesto de obra.
  //
  // El parser detectaba esos items como ITEM y los sumaba al totalValue,
  // lo que daba $11.234B (main + tramites * 2) en vez de $5.434B (solo
  // main) o $5.556B (todo). El fix: excluir del totalValue cualquier
  // item con code === "Tramites" (case-insensitive). El desglose por
  // frente (groupByFrente + computeFrenteSummary) ya los excluia
  // implicitamente porque estos items no estan agrupados bajo la misma
  // clasificacion que el frente principal en el mismo sentido que el
  // user espera.
  //
  // NOTA: los tramites SIGUEN apareciendo en parsedRows (visibles en
  // el step "preview" tabla si el usuario la abre). El modal de resumen
  // los OMITE por diseno: solo muestra items de obra.
  const isTramite = (code: string) => /^tramites?$/i.test(code.trim());
  const totalValue = parsedRows
    .filter((r) => !isTramite(r.code))
    .reduce((s, r) => s + r.totalPrice, 0);
  const chapterCount = parsedRows.filter(
    (r) => r.layerType === "CHAPTER" || r.layerType === "SUBCHAPTER",
  ).length;
  const itemCount = parsedRows.filter(
    (r) => r.layerType === "ITEM" && !isTramite(r.code),
  ).length;

  // SPEC AC-4: agrupar por frente y calcular resumen por frente.
  const grouped = groupByFrente(parsedRows);
  const frentes: FrenteSummary[] = [];
  for (const [name, rows] of grouped) {
    frentes.push(computeFrenteSummary(name, rows));
  }

  return {
    title: "",
    rows: parsedRows,
    frentes,
    totalValue,
    chapterCount,
    itemCount,
    warnings,
  };
}

// Convierte filas parseadas en estructura jerárquica BudgetLayer[]
export function buildBudgetLayers(parsed: ParsedExcelRow[]): BudgetLayer[] {
  const layers: BudgetLayer[] = [];
  let currentChapter: BudgetLayer | null = null;
  let chapterCounter = 0;
  let subchapterCounter = 0;
  let itemCounter = 0;

  parsed.forEach((row) => {
    if (row.layerType === "CHAPTER") {
      chapterCounter++;
      subchapterCounter = 0;
      currentChapter = {
        id: `l_ch_${chapterCounter}_${Date.now()}`,
        budgetId: "",
        code: String(chapterCounter),
        name: row.layerName || row.description || `Capítulo ${chapterCounter}`,
        layerType: "CHAPTER",
        items: [],
      };
      layers.push(currentChapter);
    } else if (row.layerType === "SUBCHAPTER") {
      subchapterCounter++;
      if (!currentChapter) {
        // Crear capítulo default si no existe
        chapterCounter++;
        currentChapter = {
          id: `l_ch_${chapterCounter}_${Date.now()}`,
          budgetId: "",
          code: String(chapterCounter),
          name: "GENERAL",
          layerType: "CHAPTER",
          items: [],
        };
        layers.push(currentChapter);
      }
      // Aplanamos: el subcapítulo se trata como un item-grouping dentro del chapter
      // Para simplificar, el SUBCHAPTER se representa como un item con unit=GL en el chapter
      const subItem: BudgetItem = {
        id: `bi_sub_${chapterCounter}_${subchapterCounter}_${Date.now()}`,
        layerId: currentChapter.id,
        description: `[${chapterCounter}.${subchapterCounter}] ${row.layerName || row.description || `Subcapítulo ${subchapterCounter}`}`,
        unit: "GL",
        quantity: 0,
        unitPrice: 0,
        totalPrice: 0,
        executedQuantity: 0,
        executedAmount: 0,
      };
      currentChapter.items.push(subItem);
    } else {
      // ITEM
      itemCounter++;
      const target = currentChapter || {
        id: `l_ch_default`,
        budgetId: "",
        code: "1",
        name: "GENERAL",
        layerType: "CHAPTER" as const,
        items: [],
      };
      const item: BudgetItem = {
        id: `bi_${itemCounter}_${Date.now()}`,
        layerId: target.id,
        description: row.description || `Ítem ${itemCounter}`,
        unit: row.unit || "GL",
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        totalPrice: row.totalPrice,
        executedQuantity: 0,
        executedAmount: 0,
      };
      if (!layers.find((l) => l.id === target.id)) {
        layers.push(target);
      }
      target.items.push(item);
    }
  });

  return layers;
}

/**
 * Lee un archivo Excel real (.xlsx, .xls, .csv) desde el browser y devuelve
 * el resultado de `parseExcelContent` ya mapeado. Usa SheetJS (xlsx).
 *
 * - Soporta archivos con encabezados mezclados (mayúsculas, tildes, etc.)
 *   porque `detectColumns` es case-insensitive y busca por palabra clave.
 * - Si la primera hoja tiene headers en la fila 1, los toma tal cual; si no,
 *   intenta con la fila 2 (algunos presupuestos tienen título arriba).
 */
export async function parseExcelFile(
  file: File,
  customMapping?: Partial<ExcelColumnMapping>,
): Promise<ParsedExcel> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("El archivo no contiene hojas.");
  }
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) {
    throw new Error(`La hoja "${firstSheetName}" no se pudo leer.`);
  }

  // P0 plan 2026-10-02 (bugfix): muchos presupuestos oficiales (ej:
  // Parques del Valle) tienen una fila de titulo arriba de los headers
  // reales. sheet_to_json por defecto usa la primera fila como header,
  // asi que termina leyendo "PRESUPUESTO GENERAL PARQUES DEL VALLE" como
  // un nombre de columna y todas las detecciones de keywords fallan.
  //
  // Estrategia: leer primero con la fila 1 como header. Si
  // detectColumns no reconoce al menos 3 campos (description +
  // quantity + unitPrice son los criticos), reintentar saltando 1 fila
  // (header en fila 2). El umbral bajo evita falsos positivos cuando el
  // usuario SI tiene headers en fila 1.
  const REQUIRED_KEYWORDS = ["description", "quantity", "unitPrice"] as const;
  let normalized: Record<string, string>[] = [];
  let headerRowUsed = 1;

  for (const skipRows of [0, 1, 2]) {
    const rows = XLSX.utils.sheet_to_json<
      Record<string, string | number>
    >(sheet, {
      defval: "",
      raw: false,
      ...(skipRows > 0 ? { range: skipRows } : {}),
    });
    const candidate = rows.map((r) => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(r)) {
        out[String(k)] = v === null || v === undefined ? "" : String(v);
      }
      return out;
    });
    if (candidate.length === 0) continue;
    const detected = detectColumns(Object.keys(candidate[0]));
    const hits = REQUIRED_KEYWORDS.filter((k) => detected[k]).length;
    if (hits >= 3) {
      normalized = candidate;
      headerRowUsed = skipRows + 1;
      break;
    }
    // guarda el primer intento por si nada matchea, asi devolvemos
    // warnings utiles en vez de un array vacio.
    if (skipRows === 0) normalized = candidate;
  }

  // SPEC AC-1: extraer el titulo del proyecto de la fila 1 del Excel.
  // Lo hacemos leyendo el sheet como array-of-arrays (header:1) y
  // pasando la primera fila por `extractTitle`, que ignora celdas vacias
  // iniciales. Asi capturamos tanto el caso comun (titulo en fila 1,
  // headers en fila 2) como el raro (titulo en fila 2/3 por hojas
  // exportadas con filas vacias).
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });
  const title = extractTitle(aoa[0] ?? []);

  const result = parseExcelContent(normalized, customMapping);
  result.title = title;
  if (headerRowUsed > 1) {
    result.warnings.unshift(
      `Encabezados detectados en la fila ${headerRowUsed} (la fila 1 contiene un titulo).`,
    );
  }
  return result;
}

// Datos de ejemplo para "Probar con archivo de muestra"
export const SAMPLE_EXCEL_DATA: Array<Record<string, string>> = [
  {
    Código: "1",
    Descripción: "PRELIMINARES",
    Unidad: "",
    Cantidad: "",
    "P. Unitario": "",
    Total: "",
  },
  {
    Código: "1.1",
    Descripción: "Replanteo y localización",
    Unidad: "M2",
    Cantidad: "1.200",
    "P. Unitario": "8.500",
    Total: "10.200.000",
  },
  {
    Código: "1.2",
    Descripción: "Campamento de obra",
    Unidad: "GL",
    Cantidad: "1",
    "P. Unitario": "35.000.000",
    Total: "35.000.000",
  },
  {
    Código: "1.3",
    Descripción: "Cerramiento perimetral provisional",
    Unidad: "ML",
    Cantidad: "240",
    "P. Unitario": "45.000",
    Total: "10.800.000",
  },
  {
    Código: "2",
    Descripción: "CIMENTACIÓN",
    Unidad: "",
    Cantidad: "",
    "P. Unitario": "",
    Total: "",
  },
  {
    Código: "2.1",
    Descripción: "Excavación estructural",
    Unidad: "M3",
    Cantidad: "1.800",
    "P. Unitario": "85.000",
    Total: "153.000.000",
  },
  {
    Código: "2.2",
    Descripción: "Concreto ciclópeo",
    Unidad: "M3",
    Cantidad: "420",
    "P. Unitario": "720.000",
    Total: "302.400.000",
  },
  {
    Código: "2.3",
    Descripción: "Acero de refuerzo 60.000 PSI",
    Unidad: "KG",
    Cantidad: "45.000",
    "P. Unitario": "8.500",
    Total: "382.500.000",
  },
  {
    Código: "3",
    Descripción: "ESTRUCTURA",
    Unidad: "",
    Cantidad: "",
    "P. Unitario": "",
    Total: "",
  },
  {
    Código: "3.1",
    Descripción: "Concreto columnas 4000 PSI",
    Unidad: "M3",
    Cantidad: "320",
    "P. Unitario": "850.000",
    Total: "272.000.000",
  },
  {
    Código: "3.2",
    Descripción: "Acero figurado",
    Unidad: "KG",
    Cantidad: "78.000",
    "P. Unitario": "8.800",
    Total: "686.400.000",
  },
];
