# Corte 6 — Carga masiva de PSC por Excel

> ## ⚠️ SUPERSEDED — 2026-10-14
>
> **Este spec describe el approach INICIAL (dialog modal 2-step, sin
> filtro de ya-asignados). Fue implementado y desplegado en commits
> `3ebe4d8`, `7a7add7`, `1c359b8`. Después del feedback del usuario en
> prod, el UX fue rediseñado a card inline con 3 categorías
> (encontrados / ya-asignados / no-encontrados). El nuevo spec es
> [`audit-corte-6.5-psc-carga-masiva-card.md`](./audit-corte-6.5-psc-carga-masiva-card.md).
>
> **NO implementar desde este spec.** Si necesitas entender el
> approach inicial (lo que está deployed y a punto de ser refactorizado),
> este doc es el record histórico. Si vas a implementar algo, usa el
> spec 6.5.
>
> Spec sucesor: `docs/specs/audit-corte-6.5-psc-carga-masiva-card.md`
> Commits del refactor: pendientes (Corte 6.5).

---

> Spec generado 2026-10-14 por mavis. Cubre **únicamente** el Corte 6.
> Los Cortes 1 (tailwindcss-animate), 2 (next/eslint-config-next),
> 2.5 (wiring sync snapshots), 3 (xlsx upgrade), 4 (provider-references),
> 5 (msal-node) tienen specs propias y NO se abordan aquí.
> Corte 7 (deuda técnica del reset() en provider-form) está documentado
> en AGENTS.md §06df89f. **Corte 8** (preservar `code` en `BudgetItem`)
> es la única deuda diferida que se referencia desde este spec.

## Contexto

Hoy en el form de PSC (`src/components/pscs/psc-form.tsx`), el residente
debe agregar items uno a uno mediante el botón "+ Ítem" + dropdown +
completar cantidad/precio. Para PSCs con muchos items (típico 20-100, en
proyectos grandes hasta 200+), esto es fricción significativa y fuente de
errores de transcripción.

Los contratistas reales envían su propio Excel con los items que van a
ejecutar. Forzar al residente a copiar 1×1 al sistema es fricción real.

**Requisito del usuario (verbatim):** "el archivo se carga como el
presupuesto inicial de la misma forma".

**Investigación previa:** `docs/specs/audit-corte-6-fase-1-investigacion.md`
(este spec la referencia; se commitea en commit administrativo
separado tras OK del usuario).

**Decisiones de diseño (cerradas en Fase 1):**
- Q1 (formato Excel) → template 5 columnas: `Descripción, Unidad, Precio Unitario, Incluye (S/N), Cantidad` (sin `Código` tras revisión 2026-10-14). Acepta Excel propio con subset mínimo `Descripción + Cantidad`.
- Q2 (matching) → **Opción B**: por descripción normalizada (NFD + lowercase + trim). NO se agrega `code` a `BudgetItem` (queda como Corte 8).
- Q3 (conflictos) → **Opción C**: preview muestra "Items encontrados (N)" y "No encontrados en el PT (M)". Usuario decide qué incluir.

## Decisión arquitectónica

**Recomendado:** reutilizar el parser PT (`parseExcelFile`, `parseExcelContent`, `detectColumns`, `parseNumber`) sin modificaciones. Crear un nuevo módulo `src/lib/psc-excel.ts` que envuelve el parser PT y agrega:
1. Detección de la columna "Incluye (S/N)" (específica del PSC, no soportada por el parser PT).
2. Matching por descripción normalizada.
3. Generación de plantilla descargable con `XLSX.write` (inverso del parser).

**Por qué NO extraer el modal resumen del PT:** la modal del PT es `step === "modal"` en `cargar/page.tsx` (inline, no componente). Extraerla a un componente compartido agregaría 50-100 LOC de refactor que NO son necesarios para este corte. El modal del PSC es más simple (no muestra frentes, no valida `titlesMatch` contra `project.name` — el `projectId` ya viene seleccionado del form). **Reutilizar a nivel de pattern** (mismo UX: drag-and-drop + tabla preview + 3 cards stat), no a nivel de componente.

**Trade-off aceptado:** si en el futuro se quiere compartir el modal entre PT y PSC, hay que refactorizar `cargar/page.tsx`. Por ahora, mantener el del PT intacto (regla "NO tocar el flujo del PT").

---

## 1. User Story

**As a** residente de obra que crea un PSC,
**I want to** descargar una plantilla Excel con los items del PT, enviársela al contratista para que marque cuáles items va a ejecutar y sus cantidades, y luego subir el Excel resultante,
**So that** el PSC se prellene con todos los items del contratista en un solo paso, sin tener que agregarlos uno a uno en el dropdown.

---

## 2. Acceptance Criteria

### 2.1 AC funcionales (UI/UX)

- [ ] **AC-1** Existe un botón "Carga masiva" en el form PSC, al lado del botón "+ Ítem" existente (línea 242 de `src/components/pscs/psc-form.tsx`).
- [ ] **AC-2** Al hacer click en "Carga masiva", se abre un dialog (`src/components/pscs/psc-bulk-load-dialog.tsx`) con 2 acciones: "Descargar plantilla" y "Subir Excel". El botón "Carga masiva" está deshabilitado si no hay `projectId` seleccionado o si el PT del proyecto tiene 0 items.
- [ ] **AC-3** "Descargar plantilla" genera un archivo `.xlsx` con 1 fila por cada item del PT del proyecto seleccionado, y **5 columnas**: `Descripción`, `Unidad`, `Precio Unitario`, `Incluye (S/N)` (vacía), `Cantidad` (vacía). Las columnas `Incluye` y `Cantidad` se inicializan vacías para que el contratista las llene. El nombre del archivo incluye el `project.code` para identificación (ej: `PSC-2026-PV-plantilla.xlsx`).
- [ ] **AC-4** "Subir Excel" acepta el template generado O un Excel del contratista con **headers alternativos** (ej: `[Item, Concepto, Cant, Precio]`, `[Item name, Unit, Price, Include, Qty]`). Mínimo aceptable: columnas `Descripción` + `Cantidad`. El parser usa `detectColumns` de `excel-parser.ts` con NFD normalization para mapear. **Tolerance documentada:** si una columna esperada falta, el parser omite con warning en vez de abortar (excepto `Descripción`, que es requerida — ver R1).
- [ ] **AC-5** Lógica del parser consolidada (cubre las 5 reglas del matching + edge cases):
  - Filtra filas con `Incluye (S/N) = "S"` (case-insensitive, NFD-normalized, exact match "s" o "si"). Si la columna no existe, asume todas las filas como incluidas.
  - Match por descripción normalizada (NFD + lowercase + trim) contra `BudgetItem.description` del PT.
  - Cantidad ≤ 0 o vacía → omitir con warning `"Fila N: cantidad 0 o inválida, omitida"`.
  - Mismo item 2+ veces en el Excel (misma descripción normalizada) → consolidar cantidades + warning `"'<desc>' aparece N veces en el Excel, se consolidó a cantidad total X"`.
  - Descripción ambigua en PT (2+ items con misma descripción normalizada) → tomar el primero + warning `"Descripción ambigua en el PT para '<desc>', se tomó la primera coincidencia"`.
  - Precio unitario del Excel vacío o 0 → fallback a `unitPrice` del PT item matcheado.
  - 100% de items no encontrados → warning prominente en el preview, botón "Confirmar" deshabilitado.
- [ ] **AC-6** El preview muestra 2 secciones: "Items encontrados (N)" (verde, editables en cantidad) y "No encontrados en el PT (M)" (amarillo, con botón "Excluir" por item). Header con 3 stat cards: matched, unmatched, totalValue. Si 100% unmatched, botón "Confirmar N items" deshabilitado.
- [ ] **AC-7** Al confirmar el dialog, los items encontrados se AGREGAN al state `items` del PSC form, después de los items existentes. No se sobrescriben. NO se persiste al backend (eso ocurre en el submit del form).
- [ ] **AC-8** El flujo existente de "+ Ítem" (manual) sigue funcionando intacto. Ambos flujos coexisten: bulk load + manual en el mismo PSC. La fila default inicial (`{id: "new1", ...}`) sigue apareciendo si el form está vacío.

### 2.2 AC de verificación (regression)

- [ ] **AC-9** `npx tsc --noEmit` retorna 1 error preexistente en `tests/verifiers/advances-suggestion.spec.ts:21` (TS2741 'contractId' missing). 0 nuevos.
- [ ] **AC-10** `npx vitest run` retorna 719 passed | 0 failed | 8 skipped (727). 0 nuevos rojos. (Si baseline cambia por otros cortes, ajustar el número esperado; el invariante es que este corte no introduce regresiones.)
- [ ] **AC-11** `npx vitest run tests/verifiers/audit-corte-6-psc-carga-masiva.spec.ts` → 21+ tests verde.
- [ ] **AC-12** `next build` → exit 0. 29 páginas estáticas. Sin warnings nuevos atribuibles al Corte 6.

---

## 3. Edge Cases / Riesgos

- **R1:** Excel sin columna "Descripción" → error claro `"No se detectó columna de descripción. Verifica el formato del archivo."`. No se abre el preview, se queda en step "actions" con el mensaje visible.
- **R2:** Excel con 0 filas después de filtrar Incluye=N → mensaje `"No hay items a importar. Marca al menos un item con 'S' en la columna Incluye."`. Botón "Confirmar" deshabilitado.
- **R3:** Mismo item del PT aparece 2+ veces en el Excel (misma descripción normalizada) → consolidar cantidades + warning (AC-14).
- **R4:** Cantidad 0 o vacía en una fila → omitir con warning (AC-12).
- **R5:** El PT del proyecto tiene 0 items → el botón "Carga masiva" está deshabilitado con tooltip `"Este proyecto no tiene items en el PT"`.
- **R6:** ProjectId cambia mientras el dialog está abierto → al cerrar, los items agregados quedan en el state. El form ya valida que los `budgetItemId` correspondan al `projectId` actual (`psc-form.tsx:56-60` useEffect).
- **R7:** Descripción ambigua en el PT (2+ items con misma descripción normalizada) → warning, tomar el primero (AC-11).
- **R8:** Performance con 453+ filas en el preview → parsing es O(n), render es nativo de React. No esperado problema.
- **R9:** El usuario selecciona un proyecto sin PT cargado → el botón "Carga masiva" está deshabilitado.
- **R10:** El Excel tiene 100% de items no encontrados → warning prominente `"Ningún item del Excel matchea con el PT de este proyecto. Verifica que sea el Excel correcto."`. Botón "Confirmar" deshabilitado.
- **R11:** El usuario sube un Excel con el botón "+" del file input tradicional (no drag-and-drop) → mismo flujo, misma validación.
- **R12:** El Excel tiene celdas con formato `#,##0` colombiano en precios → `parseNumber` ya maneja esta heurística (líneas 240-289 de `excel-parser.ts`).
- **R13:** El template se descarga pero el usuario no lo llena (sube el template vacío) → preview muestra 0 matched, mensaje R10.
- **R14:** El archivo subido no es .xlsx/.xls/.csv → error del parser PT (`parseExcelFile`): "No se pudo leer el archivo. Verifica que sea .xlsx, .xls o .csv."

---

## 4. Technical Contract

### 4.1 Nuevos tipos (`src/lib/psc-excel.ts`)

```ts
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
  /** Si el usuario lo marcó para incluir (default: true si ptItem != null) */
  included: boolean;
  /** Warnings específicos de esta fila (ej: "cantidad 0 omitida") */
  warnings: string[];
}

export interface PscImportResult {
  items: PscImportItem[];
  matchedCount: number;
  unmatchedCount: number;
  warnings: string[];
  totalValue: number; // Suma de los items matched con included=true
}
```

### 4.2 Funciones exportadas (`src/lib/psc-excel.ts`)

```ts
/** Parsea un Excel del PSC y lo cruza con los items del PT. */
export async function parsePscExcelFile(
  file: File,
  ptItems: PscImportPtItem[],
): Promise<PscImportResult>;

/** Genera un Blob (.xlsx) con la plantilla para el contratista. */
export function generatePscTemplate(
  ptItems: PscImportPtItem[],
  projectName: string,
): Blob;

/** Normaliza un string para matching: NFD + strip combining + lowercase + trim. */
export function normalizeForMatching(s: string): string;

/** Match por descripción normalizada. Retorna Map<excelRowIndex, PscImportPtItem>. */
export function matchItemsByDescription(
  excelDescriptions: string[],
  ptItems: PscImportPtItem[],
): {
  matched: Map<number, PscImportPtItem>;
  unmatched: number[];
};

/** Detecta la columna "Incluye (S/N)" en headers NFD-normalized. */
export function detectIncluyeColumn(headers: string[]): string;
```

### 4.3 Componente del dialog (`src/components/pscs/psc-bulk-load-dialog.tsx`)

```tsx
interface PscBulkLoadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ptItems: PscImportPtItem[];
  projectName: string;
  onConfirm: (items: PscImportItem[]) => void;
}

export function PscBulkLoadDialog(props: PscBulkLoadDialogProps): JSX.Element;
```

Estados internos del dialog:
- `step: "actions" | "preview"` (default: `"actions"`)
- `parsed: PscImportResult | null`
- `error: string | null`
- `loading: boolean`

UI:
- **Step "actions"**: 2 cards grandes ("Descargar plantilla" / "Subir Excel"), drag-and-drop zone, botón "Cancelar".
- **Step "preview"**: 3 cards stat (matched, unmatched, totalValue), tabla de items matched editables (cantidad), tabla colapsable de unmatched, botones "Confirmar N items" y "Cancelar".

### 4.4 Modificación al PSC form (`src/components/pscs/psc-form.tsx`)

```ts
// Nuevos imports
+ import { FileSpreadsheet } from "lucide-react";
+ import { PscBulkLoadDialog } from "@/components/pscs/psc-bulk-load-dialog";
+ import type { PscImportItem, PscImportPtItem } from "@/lib/psc-excel";

// Nuevo state
+ const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

// Calcular ptItems desde el projectId
+ const ptItems: PscImportPtItem[] = useMemo(() => {
+   if (!projectId) return [];
+   const budget = getBudgetByProject(projectId);
+   if (!budget) return [];
+   const items: PscImportPtItem[] = [];
+   for (const layer of budget.layers ?? []) {
+     for (const item of layer.items ?? []) {
+       items.push({
+         id: item.id,
+         description: item.description,
+         unit: item.unit,
+         unitPrice: item.unitPrice,
+         totalPrice: item.totalPrice,
+       });
+     }
+   }
+   return items;
+ }, [projectId, getBudgetByProject]);
```

Reemplazar la línea 242 (botón "+ Ítem"):

```diff
- <Button type="button" variant="outline" size="sm" onClick={addItem}>
-   <Plus className="mr-1 h-3.5 w-3.5" /> Ítem
- </Button>
+ <div className="flex gap-2">
+   <Button type="button" variant="outline" size="sm" onClick={addItem}>
+     <Plus className="mr-1 h-3.5 w-3.5" /> Ítem
+   </Button>
+   <Button
+     type="button"
+     variant="outline"
+     size="sm"
+     onClick={() => setBulkDialogOpen(true)}
+     disabled={!projectId || ptItems.length === 0}
+     title={!projectId ? "Selecciona un proyecto primero" : ptItems.length === 0 ? "Este proyecto no tiene items en el PT" : undefined}
+   >
+     <FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> Carga masiva
+   </Button>
+ </div>
+ <PscBulkLoadDialog
+   open={bulkDialogOpen}
+   onOpenChange={setBulkDialogOpen}
+   ptItems={ptItems}
+   projectName={project?.name ?? ""}
+   onConfirm={(imported) => {
+     setItems((prev) => [
+       ...prev,
+       ...imported
+         .filter((it) => it.included && it.ptItem)
+         .map((it) => ({
+           id: `new_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
+           budgetItemId: it.ptItem!.id,
+           description: it.description,
+           unit: it.unit,
+           unitPrice: it.unitPrice,
+           quantity: it.quantity,
+           totalPrice: it.totalPrice,
+           executedQuantity: 0,
+           executedAmount: 0,
+         })),
+     ]);
+     setBulkDialogOpen(false);
+   }}
+ />
```

---

## 5. Dependencies

### Files to Create
- `nextjs_space/nextjs_space/src/lib/psc-excel.ts` (~150 LOC)
- `nextjs_space/nextjs_space/src/components/pscs/psc-bulk-load-dialog.tsx` (~280 LOC)
- `nextjs_space/nextjs_space/tests/verifiers/audit-corte-6-psc-carga-masiva.spec.ts` (~200 LOC, en Fase 3)
- `nextjs_space/nextjs_space/docs/specs/audit-corte-6-psc-carga-masiva.md` (este spec)

### Files to Modify
- `nextjs_space/nextjs_space/src/components/pscs/psc-form.tsx` (+60 LOC: botón + dialog + state + onConfirm)

### Files explicitly NOT touched
- `nextjs_space/nextjs_space/src/lib/excel-parser.ts` (regla: NO tocar el flujo del PT)
- `nextjs_space/nextjs_space/src/app/tecnico/presupuestos/cargar/page.tsx` (no extraer el modal, fuera de scope)
- `nextjs_space/nextjs_space/src/app/api/pscs/route.ts` (no tocar el API)
- `nextjs_space/nextjs_space/src/lib/data-store.ts` (no agregar `code` a BudgetItem — eso es Corte 8)
- `nextjs_space/nextjs_space/src/types/**` (no extender tipos del dominio)
- `nextjs_space/nextjs_space/src/components/pscs/psc-detail.tsx`
- `nextjs_space/nextjs_space/src/lib/budgets-validation.ts`
- `nextjs_space/nextjs_space/src/lib/budgets-constants.ts`
- `nextjs_space/nextjs_space/package.json`, `nextjs_space/nextjs_space/package-lock.json` (no se cambian deps)

### Existing functions reused (read-only)
- `parseExcelFile` from `src/lib/excel-parser.ts` (lee el archivo xlsx)
- `parseExcelContent` from `src/lib/excel-parser.ts` (parsea las rows a ParsedExcelRow[])
- `detectColumns` from `src/lib/excel-parser.ts` (auto-detecta columnas)
- `parseNumber` from `src/lib/excel-parser.ts` (parsea números con heurística colombiana)
- `getBudgetByProject` from `useBudgetsStore` (ya usado en el form)
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` from `@/components/ui/dialog`
- `XLSX` from `xlsx` (escrito en `excel-parser.ts:4`; reusar el import)

---

## 6. Verifier Plan

### V1 — Static source analysis: nuevos archivos existen y exportan lo esperado

```ts
// tests/verifiers/audit-corte-6-psc-carga-masiva.spec.ts
import { readFileSync, existsSync } from "node:fs";
import { describe, it, expect } from "vitest";

const pscExcelPath = "src/lib/psc-excel.ts";
const dialogPath = "src/components/pscs/psc-bulk-load-dialog.tsx";
const formPath = "src/components/pscs/psc-form.tsx";

describe("AC-1: src/lib/psc-excel.ts existe y exporta las funciones", () => {
  it("existe el archivo", () => {
    expect(existsSync(pscExcelPath)).toBe(true);
  });
  it("exporta parsePscExcelFile (async)", () => {
    const src = readFileSync(pscExcelPath, "utf8");
    expect(src).toMatch(/export\s+async\s+function\s+parsePscExcelFile/);
  });
  it("exporta generatePscTemplate", () => {
    const src = readFileSync(pscExcelPath, "utf8");
    expect(src).toMatch(/export\s+function\s+generatePscTemplate/);
  });
  it("exporta normalizeForMatching", () => {
    const src = readFileSync(pscExcelPath, "utf8");
    expect(src).toMatch(/export\s+function\s+normalizeForMatching/);
  });
  it("exporta matchItemsByDescription", () => {
    const src = readFileSync(pscExcelPath, "utf8");
    expect(src).toMatch(/export\s+function\s+matchItemsByDescription/);
  });
  it("exporta detectIncluyeColumn", () => {
    const src = readFileSync(pscExcelPath, "utf8");
    expect(src).toMatch(/export\s+function\s+detectIncluyeColumn/);
  });
});

describe("AC-2: src/components/pscs/psc-bulk-load-dialog.tsx existe", () => {
  it("existe el archivo", () => {
    expect(existsSync(dialogPath)).toBe(true);
  });
  it("exporta PscBulkLoadDialog", () => {
    const src = readFileSync(dialogPath, "utf8");
    expect(src).toMatch(/export\s+function\s+PscBulkLoadDialog/);
  });
  it("importa Dialog de @/components/ui/dialog", () => {
    const src = readFileSync(dialogPath, "utf8");
    expect(src).toMatch(/from\s+["']@\/components\/ui\/dialog["']/);
  });
  it("importa parsePscExcelFile de @/lib/psc-excel", () => {
    const src = readFileSync(dialogPath, "utf8");
    expect(src).toMatch(/import\s+\{[^}]*parsePscExcelFile[^}]*\}\s+from\s+["']@\/lib\/psc-excel["']/);
  });
});

describe("AC-1, AC-9: psc-form.tsx integra carga masiva sin romper +Item", () => {
  it("importa PscBulkLoadDialog", () => {
    const src = readFileSync(formPath, "utf8");
    expect(src).toMatch(/import\s+\{[^}]*PscBulkLoadDialog[^}]*\}\s+from\s+["']@\/components\/pscs\/psc-bulk-load-dialog["']/);
  });
  it("tiene un botón 'Carga masiva'", () => {
    const src = readFileSync(formPath, "utf8");
    expect(src).toMatch(/Carga\s+masiva/);
  });
  it("renderiza <PscBulkLoadDialog ...> en el JSX", () => {
    const src = readFileSync(formPath, "utf8");
    expect(src).toMatch(/<PscBulkLoadDialog/);
  });
  it("NO eliminó el botón '+ Ítem' (coexistencia)", () => {
    const src = readFileSync(formPath, "utf8");
    expect(src).toMatch(/<Plus[^>]*\/>/);
    expect(src).toMatch(/onClick=\{addItem\}/);
  });
});

describe("AC-4 tolerance: psc-excel.ts usa detectColumns del parser PT", () => {
  it("importa detectColumns de @/lib/excel-parser", () => {
    const src = readFileSync(pscExcelPath, "utf8");
    expect(src).toMatch(/import\s+\{[^}]*detectColumns[^}]*\}\s+from\s+["']@\/lib\/excel-parser["']/);
  });
  it("parsePscExcelFile usa parseExcelFile o parseExcelContent (delega al parser PT)", () => {
    const src = readFileSync(pscExcelPath, "utf8");
    expect(src).toMatch(/parsePscExcelFile/);
    expect(src).toMatch(/parseExcelFile|parseExcelContent/);
  });
  it("generatePscTemplate usa XLSX.write o XLSX.utils (genera el xlsx)", () => {
    const src = readFileSync(pscExcelPath, "utf8");
    expect(src).toMatch(/XLSX\.(write|writeFile|utils)/);
  });
});
```

### V2 — Unit tests para `normalizeForMatching` (AC-10)

```ts
import { normalizeForMatching } from "@/lib/psc-excel";

describe("normalizeForMatching", () => {
  it("lowercase + trim", () => {
    expect(normalizeForMatching("  EXCAVACION  ")).toBe("excavacion");
  });
  it("NFD strip: acentos", () => {
    expect(normalizeForMatching("Excavación")).toBe("excavacion");
    expect(normalizeForMatching("PREPARACIÓN MANUAL")).toBe("preparacion manual");
  });
  it("preserva ñ", () => {
    expect(normalizeForMatching("SEÑALIZACIÓN")).toBe("senalizacion");
  });
  it("preserva dígitos y espacios", () => {
    expect(normalizeForMatching("Item 1.2.3")).toBe("item 1.2.3");
  });
  it("string vacío → string vacío", () => {
    expect(normalizeForMatching("")).toBe("");
  });
  it("solo espacios → string vacío", () => {
    expect(normalizeForMatching("   ")).toBe("");
  });
});
```

### V3 — Unit tests para `matchItemsByDescription` (AC-6, AC-11)

```ts
import { matchItemsByDescription } from "@/lib/psc-excel";

describe("matchItemsByDescription", () => {
  const pt = [
    { id: "1", description: "Excavación manual", unit: "M3", unitPrice: 50000, totalPrice: 0 },
    { id: "2", description: "Concreto 3000 PSI", unit: "M3", unitPrice: 450000, totalPrice: 0 },
    { id: "3", description: "Acero de refuerzo", unit: "KG", unitPrice: 5500, totalPrice: 0 },
  ];

  it("match exacto normalizado", () => {
    const r = matchItemsByDescription(["excavacion manual", "concreto 3000 psi"], pt);
    expect(r.matched.get(0)?.id).toBe("1");
    expect(r.matched.get(1)?.id).toBe("2");
    expect(r.unmatched).toEqual([]);
  });

  it("no match: unmatched array contiene el índice", () => {
    const r = matchItemsByDescription(["xxx no existe"], pt);
    expect(r.matched.size).toBe(0);
    expect(r.unmatched).toEqual([0]);
  });

  it("match mixto", () => {
    const r = matchItemsByDescription(["acero de refuerzo", "yyy"], pt);
    expect(r.matched.get(0)?.id).toBe("3");
    expect(r.unmatched).toEqual([1]);
  });

  it("descripción ambigua en PT: toma el primero (AC-11)", () => {
    const ptDup = [
      { id: "A", description: "EXCAVACION", unit: "M3", unitPrice: 1, totalPrice: 0 },
      { id: "B", description: "excavacion", unit: "M3", unitPrice: 2, totalPrice: 0 },
    ];
    const r = matchItemsByDescription(["excavacion"], ptDup);
    expect(r.matched.get(0)?.id).toBe("A");
  });
});
```

### V4 — Unit tests para `detectIncluyeColumn` (AC-5)

```ts
import { detectIncluyeColumn } from "@/lib/psc-excel";

describe("detectIncluyeColumn", () => {
  it("detecta 'Incluye (S/N)'", () => {
    expect(detectIncluyeColumn(["Código", "Descripción", "Incluye (S/N)", "Cantidad"])).toBe("Incluye (S/N)");
  });
  it("detecta 'Incluye' simple", () => {
    expect(detectIncluyeColumn(["Item", "Cantidad", "Incluye"])).toBe("Incluye");
  });
  it("detecta case-insensitive", () => {
    expect(detectIncluyeColumn(["INCLUYE", "Cantidad"])).toBe("INCLUYE");
  });
  it("no encuentra → string vacío", () => {
    expect(detectIncluyeColumn(["Código", "Cantidad"])).toBe("");
  });
  it("NFD: 'Incluye á' → 'Incluye a'", () => {
    expect(detectIncluyeColumn(["Incluye á"])).toBe("Incluye á");
  });
});
```

### V5 — TypeScript no introduce errores nuevos (AC-15)

```bash
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit
```

**Criterio:** exit code es 2 (tsc reporta errores), pero el único error en el output es el preexistente `tests/verifiers/advances-suggestion.spec.ts:21` (TS2741 'contractId' missing). 0 nuevos.

### V6 — Suite completa intacta (AC-16)

```bash
NODE_OPTIONS="--max-old-space-size=4096" npx vitest run
```

**Criterio:** 719 passed | 0 failed | 8 skipped (727). 0 nuevos rojos. (Si baseline cambia por otros cortes, ajustar el número esperado; el invariante es que este corte no introduce regresiones.)

### V7 — El nuevo spec verde (AC-11)

```bash
NODE_OPTIONS="--max-old-space-size=4096" npx vitest run tests/verifiers/audit-corte-6-psc-carga-masiva.spec.ts
```

**Criterio:** 21+ tests verde. (Los tests son: 17 de V1 static [14 originales + 3 de tolerance AC-4] + 6 de V2 normalize + 4 de V3 match + 5 de V4 detect = 32 tests.)

### V8 — Build exit 0, sin warnings nuevos (AC-18)

```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

**Criterio:** exit 0. 29 páginas estáticas. Sin warnings nuevos atribuibles al Corte 6 (los 3 warnings de DB `[db] ER_ACCESS_DENIED_ERROR` son ruido esperado del host local sin acceso a Hostinger y NO cuentan como nuevos).

### V9 — Manual: flujo end-to-end en navegador (AC-1..9, AC-12..14)

1. Login en `/login` (con bypass dev si `NODE_ENV=development`).
2. Ir a un proyecto con PT cargado (ej: Parques del Valle).
3. Click "Nuevo PSC" → form PSC.
4. Seleccionar proyecto + contratista.
5. Verificar que el botón "Carga masiva" está habilitado.
6. Click "Carga masiva" → se abre el dialog con 2 acciones.
7. Click "Descargar plantilla" → baja un `.xlsx` con 453 filas + 5 columnas.
8. Llenar 5 filas con `Incluye=S` y `Cantidad=10,20,30,40,50`. Las otras quedan vacías.
9. Subir el archivo → preview muestra 5 items matched (verde, editables) y 448 no encontrados (amarillo, con botón Excluir).
10. Confirmar → los 5 items aparecen en el form PSC con su `budgetItemId`, descripción, unit, unitPrice, quantity correctos. Total del form coincide con la suma.
11. Guardar PSC → crear PSC en backend con esos items.
12. Re-abrir el PSC → los 5 items están persistidos.

### V10 — Edge cases manuales (R1..R14)

- Subir un Excel sin columna Descripción → error claro (R1).
- Subir un Excel con 100% unmatched → warning prominente, botón Confirmar deshabilitado (R10).
- Cambiar de proyecto mid-flow → items no se pierden del state, form valida (R6).
- Click "+ Ítem" en el mismo PSC después de bulk load → fila manual aparece junto a las del bulk load (AC-9).
- Subir un Excel con misma descripción 2 veces → consolidar cantidades + warning (AC-14).
- Subir un Excel con 1 fila cantidad=0 → omitir + warning (AC-12).
- Subir un Excel con precios vacíos → usar `unitPrice` del PT (AC-13).

---

## 7. Estrategia de commits (aislamiento)

| # | Mensaje | Archivos | LOC |
|---|---|---|---|
| 1 | `feat(psc-excel): lib psc-excel.ts (parser, matcher, template generator, normalize)` | `src/lib/psc-excel.ts` (crear) | ~150 |
| 2 | `feat(pscs): psc-bulk-load-dialog (2-step flow: actions → preview; matched/unmatched UI)` | `src/components/pscs/psc-bulk-load-dialog.tsx` (crear) | ~280 |
| 3 | `feat(pscs): integración bulk-load en psc-form (botón + dialog state + onConfirm → setItems)` | `src/components/pscs/psc-form.tsx` (modificar, +60 LOC) | +60 |
| 4 | `test(pscs): verifier audit-corte-6-psc-carga-masiva (32 tests)` | `tests/verifiers/audit-corte-6-psc-carga-masiva.spec.ts` (crear) | ~200 |
| 5 | `docs(specs): spec Corte 6 carga masiva PSC + log AGENTS.md` | `docs/specs/audit-corte-6-psc-carga-masiva.md` (crear), `AGENTS.md` (entrada de log) | ~400 + 50 |

**Orden de aplicación:**
- Commit 1 + 2 + 3 juntos (implementación, sin tests aún) — verifier en rojo.
- Commit 4 — verifier en verde.
- Commit 5 — docs.

**Push:** `origin/main`, branch `main`, commits individuales (`git add` por archivo, NO `git add -A`).

---

## 8. Out of Scope

- Agregar `code` a `BudgetItem` (Corte 8 — deuda técnica documentada).
- Extraer el modal de resumen del PT a un componente compartido (refactor que afectaría `cargar/page.tsx`; fuera de este spec).
- Migrar a exceljs (no relacionado; sigue siendo SheetJS).
- Cambiar la validación de `titlesMatch` del PT (no se usa en el flujo PSC).
- Persistir el Excel subido en algún storage (no hay backend para esto; el upload es read-only y los items se persisten via submit del form).
- Cambiar el formato de "Carga masiva" para que use un drag-and-drop multi-archivo (single-file por ahora).
- Agregar tests E2E con Playwright (no hay infra; los tests son source-analysis + unit tests).
- Cambiar el botón "+ Ítem" para que sea un dropdown con opciones (queda como botón standalone).
- Validación de cantidad con decimales ilimitados (Step 0.01 ya está en línea 287 de `psc-form.tsx`; se mantiene).
- Editar `Cantidad` en el preview para que sea un `<input>` controlado (puede ser input libre sin validación adicional).

---

## 9. Plan de Aborto

**Cancelar el commit y reportar sin push si se cumple CUALQUIERA de:**

- **A1:** El parser PT no detecta alguna columna esperada en el Excel del contratista (ej: "Incluye" en una variante ortográfica no anticipada). Workaround: documentar las variantes aceptadas; si hay una variante no soportada, agregar a `detectColumns` (PERO esto tocaría el flujo PT, lo cual está prohibido — en ese caso, abortar y reabrir spec con excepción).
- **A2:** V5 (tsc) introduce errores TS nuevos. Abortar y reportar.
- **A3:** V6 (suite completa) introduce regresiones. Abortar y reportar.
- **A4:** V7 (spec del Corte 6) no llega a 8+ tests verde. Abortar.
- **A5:** V8 (next build) falla con exit != 0 O cambia el conteo de páginas estáticas (29 → ≠29).
- **A6:** V9 (browser test) muestra que el botón "Carga masiva" no se renderiza, o el dialog no abre, o el flujo end-to-end no completa.
- **A7:** V9 muestra que la integración con el PSC form rompe el flujo existente ("+ Ítem" deja de funcionar, o el submit del form falla).
- **A8:** `parseExcelFile` del PT (reutilizado) tiene un bug latente que se manifiesta con los archivos del contratista. Workaround: forkear `parseExcelFile` (no, eso duplica código) — abortar y reportar para re-priorizar el fix del parser PT.

---

## 10. Approval

**Status:** ⏳ Pending Review

---

## 11. Decisiones de diseño (resumen de Fase 1)

| Decisión | Elegida | Razón | Trade-off aceptado |
|---|---|---|---|
| Q1 (formato Excel) | **Template con 5 columnas**: `Descripción, Unidad, Precio Unitario, Incluye (S/N), Cantidad` (sin `Código`, revisión 2026-10-14). Acepta Excel del contratista con headers alternativos y subset mínimo `Descripción + Cantidad`. | El contratista llena poco; UX es "marca y cantidad". Sin `Código` evita confusión sobre qué campo se usa para matching. | Si el contratista quiere identificar items por código, puede agregarlo como columna extra fuera del template (no rompe el parser, simplemente se ignora). |
| Q2 (matching) | **Opción B**: descripción normalizada (NFD + lowercase + trim). | Cubre 95% de casos. No requiere schema change. PTs pre-Corte 8 no tienen `code` preservado. | Frágil si el contratista cambia la descripción (ej: typo, abreviatura). |
| Q3 (conflictos) | **Opción C**: preview lista encontrados + no encontrados. Usuario decide. | No abortar por 1 fila mala. No omitir silenciosamente. | El usuario tiene que revisar la lista de unmatched. |
| "¿Extraer el modal del PT?" | NO extraer. Duplicar el pattern visual en `psc-bulk-load-dialog.tsx`. | El modal del PSC es más simple. Regla: NO tocar `cargar/page.tsx`. | Si en el futuro se quiere compartir, hay que refactorizar (fuera de scope). |
| "¿Tocar `parseExcelFile`/`parseExcelContent`?" | NO. Reutilizar tal cual. Detección de "Incluye" se hace en `psc-excel.ts` post-parse. | Regla explícita: no tocar el flujo del PT. | Si la columna "Incluye" tiene una variante ortográfica no anticipada, abortar (A1). |
| "¿Agregar `code` a `BudgetItem`?" | NO. Diferido a Corte 8. | Q2 = B no lo necesita. Cambio de schema requiere testing extenso. | El código se captura durante el parse (en `ParsedExcelRow.code`) pero se descarta al construir `BudgetItem`. |

---

## 12. Decisión diferida a Corte 8 (deuda técnica)

**Corte 8 — Preservar `code` en `BudgetItem` (futuro).**

Cuando se ejecute:
1. Modificar `src/lib/excel-parser.ts:buildBudgetLayers` (líneas 533-543) para incluir `code: row.code` en cada `BudgetItem` (1 línea).
2. Modificar `src/lib/data-store.ts:1057-1082` `getItemsAvailable` para retornar `code` también en el shape.
3. Migración conceptual: PTs existentes no tendrán `code` (cargados antes del fix). PTs nuevos sí.
4. Matcher en `psc-excel.ts` puede usar `code` como primary match, `description` como fallback. Code-first es más robusto que description-first.
5. Decisión de UX: si un PT item tiene `code`, mostrarlo en el dropdown del PSC form. Hoy solo muestra `description (unit) – totalPrice`.

Documentado en AGENTS.md §06df89f (commit del post-mortem de Corte 4).
