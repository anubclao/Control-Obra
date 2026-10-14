// src/lib/psc-excel.ts
//
// Lógica para Carga masiva de PSC por Excel (Corte 6).
// Reutiliza el parser PT (parseExcelFile, detectColumns) sin modificarlo.
// Decisiones de diseño: docs/specs/audit-corte-6-psc-carga-masiva.md §11.

import * as XLSX from "xlsx";
import {
  parseExcelFile,
  detectColumns,
} from "@/lib/excel-parser";

// ----------------------------------------------------------------------------
// Tipos
// ----------------------------------------------------------------------------

/** PT item shape (subset de BudgetItem, lo que necesitamos para matching) */
export interface PscImportPtItem {
  id: string;
  description: string;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

/** Item del Excel parseado, post-match */
export interface PscImportItem {
  /** 1-indexed row number en el Excel original */
  excelRow: number;
  /** Matched PT item (null si no se encontró) */
  ptItem: PscImportPtItem | null;
  /** Descripción del Excel (canonical, pre-normalization) */
  description: string;
  /** Unit (del Excel o del PT) */
  unit: string;
  /** Precio unitario (del Excel o fallback del PT) */
  unitPrice: number;
  /** Cantidad (del Excel) */
  quantity: number;
  /** totalPrice = quantity * unitPrice */
  totalPrice: number;
  /** Si el usuario lo marcó para incluir */
  included: boolean;
  /** Warnings específicos de esta fila */
  warnings: string[];
}

export interface PscImportResult {
  items: PscImportItem[];
  matchedCount: number;
  unmatchedCount: number;
  warnings: string[];
  totalValue: number;
}

// ----------------------------------------------------------------------------
// Funciones puras (testeables directamente, sin DOM ni side-effects)
// ----------------------------------------------------------------------------

/**
 * Normaliza un string para matching: NFD + strip combining + lowercase + trim.
 *
 * Ejemplos:
 *   "  Excavación MANUAL  " → "excavacion manual"
 *   "SEÑALIZACIÓN"           → "senalizacion" (ñ preservada, no es combining mark)
 *   ""                       → ""
 *   "   "                    → ""
 */
export function normalizeForMatching(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Detecta la columna "Incluye (S/N)" en headers NFD-normalized.
 * Retorna el header ORIGINAL (no normalizado) si matchea.
 *
 * Acepta variantes: "Incluye (S/N)", "Incluye", "INCLUYE", "Incluye ó", etc.
 * Retorna "" si no encuentra.
 */
export function detectIncluyeColumn(headers: string[]): string {
  const normalized = headers.map((h) => normalizeForMatching(h));
  const idx = normalized.findIndex((h) => h.includes("incluye"));
  return idx >= 0 ? headers[idx] : "";
}

/**
 * Match por descripción normalizada. Para cada descripción del Excel, busca
 * el primer PT item con descripción normalizada idéntica.
 *
 * - matched: Map<excelRowIndex, PscImportPtItem>
 * - unmatched: array de índices no matcheados (en orden)
 *
 * Si 2+ items del PT tienen la misma descripción normalizada, se toma el
 * primero (AC-11 del spec).
 */
export function matchItemsByDescription(
  excelDescriptions: string[],
  ptItems: PscImportPtItem[],
): { matched: Map<number, PscImportPtItem>; unmatched: number[] } {
  const matched = new Map<number, PscImportPtItem>();
  const unmatched: number[] = [];

  // Pre-normalize PT descriptions (cache)
  const normalizedPt = ptItems.map((it) => ({
    item: it,
    normalized: normalizeForMatching(it.description),
  }));

  excelDescriptions.forEach((desc, idx) => {
    const normalized = normalizeForMatching(desc);
    const found = normalizedPt.find((p) => p.normalized === normalized);
    if (found) {
      matched.set(idx, found.item);
    } else {
      unmatched.push(idx);
    }
  });

  return { matched, unmatched };
}

// ----------------------------------------------------------------------------
// Parser principal (async, depende de parseExcelFile del parser PT)
// ----------------------------------------------------------------------------

/**
 * Parsea un Excel del PSC y lo cruza con los items del PT.
 *
 * Flujo:
 *  1. Lee el archivo via parseExcelFile (reutiliza el parser PT).
 *  2. Detecta la columna "Incluye (S/N)" via detectIncluyeColumn.
 *     Si no existe, procesa todas las filas (asume "Incluye=S" implícito).
 *  3. Filtra filas con Incluye = "S" (case-insensitive, NFD, acepta
 *     variantes: "S", "SI", "YES", "1", "X", "Y").
 *  4. Match por descripción normalizada.
 *  5. Construye PscImportItem[] con totales y warnings.
 *
 * Si matchedCount === 0 (con items > 0), agrega warning "Ningún item
 * del Excel matchea con el PT" para que la UI muestre warning prominente.
 */
export async function parsePscExcelFile(
  file: File,
  ptItems: PscImportPtItem[],
): Promise<PscImportResult> {
  // 1. Parsear el archivo (reusa el parser PT)
  const parsed = await parseExcelFile(file);
  const { rows, warnings: parserWarnings } = parsed;

  const warnings: string[] = [...parserWarnings];

  if (rows.length === 0) {
    return {
      items: [],
      matchedCount: 0,
      unmatchedCount: 0,
      warnings: [...warnings, "Archivo vacío"],
      totalValue: 0,
    };
  }

  // 2. Detectar columnas
  const headers = Object.keys(rows[0].raw);
  const incluyeCol = detectIncluyeColumn(headers);
  const mapping = detectColumns(headers);

  if (!mapping.description) {
    warnings.push("No se detectó columna de descripción");
  }

  // 3. Filtrar filas por Incluye
  const filteredRows = rows.filter((row) => {
    if (!incluyeCol) return true; // sin columna Incluye → todas
    const incluyeVal = String(row.raw[incluyeCol] || "").trim();
    const norm = normalizeForMatching(incluyeVal);
    return (
      norm === "s" ||
      norm === "si" ||
      norm === "yes" ||
      norm === "1" ||
      norm === "x" ||
      norm === "y"
    );
  });

  // 4. Match por descripción
  const excelDescriptions = filteredRows.map((row) => row.description);
  const { matched, unmatched } = matchItemsByDescription(
    excelDescriptions,
    ptItems,
  );

  // 5. Construir PscImportItem[]
  const items: PscImportItem[] = filteredRows.map((row, idx) => {
    const ptItem = matched.get(idx) || null;
    const unitPriceExcel = row.unitPrice;
    const quantityExcel = row.quantity;

    const unit = row.unit || ptItem?.unit || "GL";
    // Precio del Excel > 0; si no, fallback al unitPrice del PT matcheado
    const unitPrice =
      unitPriceExcel > 0 ? unitPriceExcel : ptItem?.unitPrice || 0;
    const quantity = quantityExcel;
    const totalPrice = quantity * unitPrice;

    const itemWarnings: string[] = [];
    if (quantity <= 0) {
      itemWarnings.push("Cantidad 0 o inválida");
    }

    return {
      excelRow: row.rowNumber,
      ptItem,
      description: row.description,
      unit,
      unitPrice,
      quantity,
      totalPrice,
      included: ptItem !== null && quantity > 0,
      warnings: itemWarnings,
    };
  });

  const matchedCount = matched.size;
  const unmatchedCount = unmatched.length;
  const totalValue = items
    .filter((it) => it.included)
    .reduce((sum, it) => sum + it.totalPrice, 0);

  // Warning prominente si 100% unmatched
  if (matchedCount === 0 && items.length > 0) {
    warnings.push(
      "Ningún item del Excel matchea con el PT de este proyecto",
    );
  }

  return {
    items,
    matchedCount,
    unmatchedCount,
    warnings,
    totalValue,
  };
}

// ----------------------------------------------------------------------------
// Generador de plantilla
// ----------------------------------------------------------------------------

/**
 * Genera un Blob (.xlsx) con la plantilla para el contratista.
 *
 * Columnas (5, sin Código — decisión 2026-10-14):
 *   Descripción, Unidad, Precio Unitario, Incluye (S/N), Cantidad
 *
 * Filas: 1 por cada PT item, con Incluye y Cantidad vacías para que
 * el contratista las llene. Descripción/Unidad/Precio Unitario se
 * pre-rellenan con los valores del PT.
 */
export function generatePscTemplate(
  ptItems: PscImportPtItem[],
  _projectName: string,
): Blob {
  const headers = [
    "Descripción",
    "Unidad",
    "Precio Unitario",
    "Incluye (S/N)",
    "Cantidad",
  ];
  const rows = ptItems.map((it) => [
    it.description,
    it.unit,
    it.unitPrice,
    "", // Incluye vacío para que el contratista marque
    "", // Cantidad vacía para que el contratista llene
  ]);

  const aoa = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "PSC");

  const wbout = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([wbout], { type: "application/octet-stream" });
}
