const XLSX = require('xlsx');

const filePath = process.argv[2];
if (!filePath) {
  console.error('Uso: node scripts/budget-parse-tester.js <ruta_excel>');
  process.exit(1);
}

const SUMMARY_KEYWORDS = [
  'subtotal', 'sub-total', 'sub total',
  'administracion', 'administracion',
  'imprevistos', 'imprevisto',
  'utilidad',
  'total antes', 'total general', 'total obra',
  'iva sobre', 'iva utilidad', 'iva s/',
  'costo directo total',
  'total a.i.u', 'total aiu',
  'costo directo',
  'condiciones comerciales', 'forma de pago',
  'tiempo de entrega', 'validez',
  'cordialmente',
  'gerente de proyecto', 'gerente de obra',
  'opcional',
  'segun administracion', 'segun administracion', 'segun administracion',
];

const isChapterNumber = (value) => {
  if (value === null || value === undefined) return false;
  const str = String(value).trim();
  return /^\d+$/.test(str) && parseInt(str, 10) > 0;
};

const isItemNumber = (value) => {
  if (value === null || value === undefined) return false;
  const str = String(value).trim();
  return /^\d+[\.,]\d+([\.,]\d+)?$/.test(str);
};

const isSummaryRow = (description) => {
  const descLower = String(description || '').toLowerCase().trim();
  return SUMMARY_KEYWORDS.some((kw) => descLower.includes(kw));
};

const extractPercentageFromRow = (row, qtyCol, unitPriceCol) => {
  for (const col of [qtyCol, unitPriceCol]) {
    if (col >= 0) {
      const val = row[col];
      if (typeof val === 'number' && val > 0 && val < 100) return val;
      const str = String(val || '');
      const match = str.match(/(\d+(?:\.\d+)?)\s*%/);
      if (match) return parseFloat(match[1]);
      if (typeof val === 'number' && val > 0 && val < 1) return val * 100;
    }
  }
  for (const cell of row) {
    const str = String(cell || '');
    const match = str.match(/(\d+(?:\.\d+)?)\s*%/);
    if (match) return parseFloat(match[1]);
  }
  return 0;
};

const wb = XLSX.readFile(filePath);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

let headerRowIndex = -1;
for (let i = 0; i < Math.min(15, rows.length); i++) {
  const row = rows[i] || [];
  if (row.some((cell) => {
    const s = String(cell || '').toLowerCase().trim();
    return s === 'item' || s === 'ítem' || s.includes('descripcion') || s.includes('descripción');
  })) {
    headerRowIndex = i;
    break;
  }
}

if (headerRowIndex === -1) {
  console.error('No se encontró encabezado');
  process.exit(1);
}

const headerRow = rows[headerRowIndex] || [];
const headers = headerRow.map((h) => String(h || '').toLowerCase().trim());

const findColumnIndex = (keywords) => headers.findIndex((h) => h && keywords.some((k) => h.includes(k) || h === k));

const itemCol = findColumnIndex(['item', 'ítem', 'no.', 'numero', 'número', 'item de pago']);
const descCol = findColumnIndex(['descripcion', 'descripción', 'detalle', 'actividad']);
const unitCol = findColumnIndex(['unidad', 'und', 'un']);
const qtyCol = findColumnIndex(['cantidad', 'cant', 'qty']);
const unitPriceCol = findColumnIndex(['vr unitario', 'unitario', 'precio', 'vr unit', 'p. unitario', 'precio unitario', 'valor unitario']);
const totalPriceCol = findColumnIndex(['vr total', 'total', 'valor total', 'p. total', 'precio total']);
const classCol = findColumnIndex(['clasificacion', 'clasificación', 'frente', 'frente de trabajo']);
const useClassificationAsFront = classCol !== -1;

const chapters = [];
let currentChapter = null;
const chapterByFront = new Map();

const stats = {
  rowsTotal: rows.length,
  rowsProcessed: 0,
  itemsParsed: 0,
  chaptersParsed: 0,
  skippedEmptyDescription: 0,
  skippedSummary: 0,
  skippedAiuRows: 0,
  skippedNoTotal: 0,
  skippedTextItem: 0,
  skippedNoContext: 0,
  fallbackRowsAdded: 0,
};

const samples = [];
const pushSample = (rowNum, reason, row) => {
  if (samples.length >= 40) return;
  samples.push({
    row: rowNum,
    reason,
    classif: row[classCol],
    item: row[itemCol],
    desc: row[descCol],
    unit: row[unitCol],
    qty: row[qtyCol],
    unitPrice: row[unitPriceCol],
    total: row[totalPriceCol],
  });
};

const getOrCreateFrontChapter = (frontRaw) => {
  const frontName = frontRaw || 'Sin Frente';
  const frontKey = String(frontName).toUpperCase();
  const existing = chapterByFront.get(frontKey);
  if (existing) return existing;

  const chapter = {
    code: `FRT-${String(chapters.length + 1).padStart(2, '0')}`,
    name: frontName,
    items: [],
  };
  chapterByFront.set(frontKey, chapter);
  chapters.push(chapter);
  return chapter;
};

for (let i = headerRowIndex + 1; i < rows.length; i++) {
  const row = rows[i] || [];
  stats.rowsProcessed++;

  const itemValue = row[itemCol];
  const description = String(row[descCol] || '').trim();
  const frontRaw = classCol >= 0 ? String(row[classCol] || '').trim() : '';

  if (!description) {
    stats.skippedEmptyDescription++;
    continue;
  }

  const descLower = description.toLowerCase().trim();
  if (
    descLower.includes('administracion') ||
    descLower.includes('administración') ||
    descLower.includes('imprevisto') ||
    descLower === 'utilidad' ||
    (descLower.includes('utilidad') && !descLower.includes('iva')) ||
    descLower.includes('iva sobre') ||
    descLower.includes('iva utilidad') ||
    descLower.includes('iva s/')
  ) {
    extractPercentageFromRow(row, qtyCol, unitPriceCol);
    stats.skippedAiuRows++;
    pushSample(i + 1, 'AIU/Resumen porcentaje', row);
    continue;
  }

  if (isSummaryRow(description)) {
    stats.skippedSummary++;
    pushSample(i + 1, 'Resumen/total', row);
    continue;
  }

  if (!useClassificationAsFront && isChapterNumber(itemValue)) {
    currentChapter = {
      code: `CAP${String(itemValue).trim()}`,
      name: description,
      items: [],
    };
    chapters.push(currentChapter);
    continue;
  }

  const targetChapter = useClassificationAsFront
    ? (frontRaw ? getOrCreateFrontChapter(frontRaw) : null)
    : currentChapter;

  if (isItemNumber(itemValue) && targetChapter) {
    const quantity = parseFloat(row[qtyCol]) || 0;
    let unitPrice = 0;
    let totalPrice = 0;

    const rawTotalPrice = totalPriceCol >= 0 ? row[totalPriceCol] : null;

    if (unitPriceCol >= 0) {
      const upVal = row[unitPriceCol];
      unitPrice = typeof upVal === 'number' ? upVal : (parseFloat(upVal) || 0);
    }

    if (totalPriceCol >= 0) {
      const tpVal = row[totalPriceCol];
      totalPrice = typeof tpVal === 'number' ? tpVal : (parseFloat(tpVal) || 0);
    }

    if (totalPrice === 0 && unitPrice > 0 && quantity > 0) {
      totalPrice = unitPrice * quantity;
    }

    if (unitPrice === 0 && totalPrice > 0 && quantity > 0) {
      unitPrice = totalPrice / quantity;
    }

    const normalizedItem = String(itemValue).trim().replace(/,/g, '.');
    const isStructuralItem =
      totalPrice <= 0 &&
      quantity === 0 &&
      unitPrice === 0 &&
      /^\d+\.\d+(\.\d+)?$/.test(normalizedItem);

    if (totalPrice <= 0 && !isStructuralItem) {
      stats.skippedNoTotal++;
      pushSample(i + 1, 'Item sin total > 0', row);
      continue;
    }

    targetChapter.items.push({
      itemNumber: normalizedItem,
      description,
      unit: row[unitCol] ? String(row[unitCol]).toUpperCase().trim() : 'UN',
      quantity,
      unitPrice,
      totalPrice,
    });
    stats.itemsParsed++;
    continue;
  }

  if (targetChapter && description) {
    const itemStr = String(itemValue || '').toLowerCase().trim();
    if (itemStr && !/^\d/.test(itemStr)) {
      stats.skippedTextItem++;
      pushSample(i + 1, 'Item textual no numérico', row);
      continue;
    }

    const unit = row[unitCol] ? String(row[unitCol]).toUpperCase().trim() : '';
    const quantity = parseFloat(row[qtyCol]) || 0;

    if ((unit || quantity > 0) && quantity > 0) {
      let unitPrice = 0;
      let totalPrice = 0;
      const rawTotalPrice = totalPriceCol >= 0 ? row[totalPriceCol] : null;

      if (unitPriceCol >= 0) {
        const upVal = row[unitPriceCol];
        unitPrice = typeof upVal === 'number' ? upVal : (parseFloat(upVal) || 0);
      }

      if (totalPriceCol >= 0) {
        const tpVal = row[totalPriceCol];
        totalPrice = typeof tpVal === 'number' ? tpVal : (parseFloat(tpVal) || 0);
      }

      if (totalPrice === 0 && unitPrice > 0 && quantity > 0) {
        totalPrice = unitPrice * quantity;
      }

      if (unitPrice === 0 && totalPrice > 0 && quantity > 0) {
        unitPrice = totalPrice / quantity;
      }

      if (totalPrice > 0) {
        targetChapter.items.push({
          itemNumber: itemValue ? String(itemValue).trim().replace(/,/g, '.') : `${targetChapter.items.length + 1}`,
          description,
          unit: unit || 'UN',
          quantity,
          unitPrice,
          totalPrice,
        });
        stats.itemsParsed++;
        stats.fallbackRowsAdded++;
      } else {
        stats.skippedNoTotal++;
        pushSample(i + 1, 'Fallback sin total > 0', row);
      }
      continue;
    }
  }

  if (!targetChapter) {
    stats.skippedNoContext++;
    pushSample(i + 1, 'Sin contexto de capítulo/frente', row);
  }
}

stats.chaptersParsed = chapters.filter((c) => c.items.length > 0).length;

console.log('=== RESULTADO TESTER PARSE PRESUPUESTO ===');
console.log(JSON.stringify({
  filePath,
  sheet: wb.SheetNames[0],
  headerRowIndex: headerRowIndex + 1,
  columns: { itemCol, descCol, unitCol, qtyCol, unitPriceCol, totalPriceCol, classCol, useClassificationAsFront },
  stats,
}, null, 2));

console.log('\n=== MUESTRA DE FILAS DESCARTADAS / SENSIBLES ===');
console.log(JSON.stringify(samples, null, 2));

console.log('\n=== FRENTES DETECTADOS (primeros 15) ===');
console.log(chapters.slice(0, 15).map((c) => ({ code: c.code, name: c.name, items: c.items.length })));
