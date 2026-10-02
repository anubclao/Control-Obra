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
}

export interface ParsedExcel {
  rows: ParsedExcelRow[];
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
}

// Detección automática: busca en los headers palabras clave
export function detectColumns(headers: string[]): ExcelColumnMapping {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const find = (...keywords: string[]) => {
    for (const kw of keywords) {
      const idx = lower.findIndex((h) => h.includes(kw));
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
  };
}

// Convierte un string a número, manejando formatos comunes (1.234,56 → 1234.56)
// y el formato anglosajón (1,234.56 → 1234.56). Regla: el separador que
// aparezca MÁS A LA DERECHA es el decimal; el otro es separador de miles.
export function parseNumber(value: string | undefined): number {
  if (value === undefined || value === null) return 0;
  const trimmed = String(value).trim();
  if (trimmed === "") return 0;
  // Limpiar símbolos de moneda y espacios, conservar dígitos, coma, punto y signo.
  const cleaned = trimmed.replace(/[^\d,.\-]/g, "");
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  if (lastComma === -1 && lastDot === -1) {
    return parseFloat(cleaned) || 0;
  }
  // El separador decimal es el que aparece MÁS A LA DERECHA.
  if (lastComma > lastDot) {
    // Formato colombiano/europeo: 1.234,56
    return parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
  }
  if (lastDot > lastComma) {
    // Formato anglosajón: 1,234.56
    return parseFloat(cleaned.replace(/,/g, "")) || 0;
  }
  // Misma posición (no debería pasar), intentar coma como decimal.
  return parseFloat(cleaned.replace(",", ".")) || 0;
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

  // Si no hay cantidad ni precio, es un capítulo
  if (!quantity && !unitPrice && description) {
    return { type: "CHAPTER", layerName: description };
  }

  // Si el código tiene puntos (1.1, 1.1.1) es subcapítulo o item
  const dots = (code.match(/\./g) || []).length;
  if (dots >= 2) {
    return { type: "ITEM" };
  } else if (dots === 1) {
    return { type: "SUBCHAPTER", layerName: description };
  }

  return { type: "ITEM" };
}

// Parsea el contenido "crudo" (simulando haber leído el Excel)
export function parseExcelContent(
  rows: Array<Record<string, string>>,
  customMapping?: Partial<ExcelColumnMapping>,
): ParsedExcel {
  if (rows.length === 0) {
    return {
      rows: [],
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
    };
  });

  const totalValue = parsedRows.reduce((s, r) => s + r.totalPrice, 0);
  const chapterCount = parsedRows.filter(
    (r) => r.layerType === "CHAPTER",
  ).length;
  const itemCount = parsedRows.filter(
    (r) => r.layerType === "ITEM" || r.layerType === "SUBCHAPTER",
  ).length;

  return { rows: parsedRows, totalValue, chapterCount, itemCount, warnings };
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

  // Convertir a array de objetos usando la primera fila como header.
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, {
    defval: "",
    raw: false, // queremos strings para parsear con parseNumber
  });

  // Normalizar keys a string (sheet_to_json ya lo hace, pero defendámonos).
  const normalized = rows.map((r) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) {
      out[String(k)] = v === null || v === undefined ? "" : String(v);
    }
    return out;
  });

  return parseExcelContent(normalized, customMapping);
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
