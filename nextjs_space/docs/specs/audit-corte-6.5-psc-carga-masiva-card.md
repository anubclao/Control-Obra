# Corte 6.5 — Carga masiva de PSC por Excel (Card inline, refactor de Corte 6)

> Spec generado 2026-10-14 por mavis. **Refactor** de `docs/specs/audit-corte-6-psc-carga-masiva.md` (ahora marcado como SUPERSEDED).
>
> Este spec **NO** rehace el trabajo de `src/lib/psc-excel.ts` (commit `3ebe4d8`).
> Esa lib es agnóstica al UI y se reusa tal cual. El refactor es solo a nivel de
> la UI: dialog modal → card inline. Los 3 commits del Corte 6
> (`3ebe4d8`, `7a7add7`, `1c359b8`) son la línea base sobre la que se
> itera. Se mantienen en `main`/`prod` durante la transición.
>
> Cortes relacionados:
> - **Corte 6** (superado por este): dialog modal, 2 steps, sin filtro de
>   ya-asignados. Spec: `audit-corte-6-psc-carga-masiva.md`.
> - **Corte 9** (P0 bugfix, ya cerrado): middleware redirect.
>   Spec: `audit-corte-9-middleware-redirect.md`.

## Contexto

### Punto de partida (Corte 6 ya desplegado)
- `src/lib/psc-excel.ts` (commit `3ebe4d8`): 5 funciones puras
  (`parsePscExcelFile`, `generatePscTemplate`, `normalizeForMatching`,
  `matchItemsByDescription`, `detectIncluyeColumn`). **Reusado sin cambios.**
- `src/components/pscs/psc-bulk-load-dialog.tsx` (commit `7a7add7`):
  dialog modal 2-step (actions → preview). **Reemplazado por card.**
- `src/components/pscs/psc-form.tsx` (commit `1c359b8`): botón "Carga
  masiva" + `PscBulkLoadDialog`. **Integración actualizada para usar
  `PscBulkLoadCard` en lugar del dialog.**
- Tests del spec 6.0 (32 tests, 12 ACs): V2/V3/V4 (15 tests de funciones
  puras) **siguen válidos sin cambios**. V1 (existencia + exports + imports
  del dialog) y V1 AC-1+8 (integración form) **se renuevan para apuntar a
  la card**.

### Por qué refactor (no re-spec)
- El usuario probó el dialog en prod y reportó que "no funciona como se
  espera". No es un bug funcional, es un issue de UX.
- Cambiar a card inline (no modal) elimina la fricción de abrir/cerrar un
  dialog y mantiene al usuario en el contexto del form PSC.
- Agregar la categoría "ya asignados" resuelve el riesgo de que el
  usuario agregue items duplicados a dos PSCs distintos.

### Decisiones de UX (cerradas con el usuario 2026-10-14)

**Q1 — Card inline simple, sin expand/collapse global:**
- Estructura visual: header + instrucciones + botones (Descargar plantilla /
  Subir Excel) + 3 secciones de resultados + botones finales
  (Confirmar N items / Cancelar).
- Después de subir el archivo: mostrar las 3 secciones con badges de
  conteo, cada una expandible (acordeón) para ver el detalle.
- Estilo: la card aparece ENTRE el bloque "Ítem / Carga masiva" y el
  primer item del form, en línea con el resto del form. No es modal
  flotante.

**Q2 — 3 secciones apiladas siempre visibles (no pestañas):**
- ✓ **Encontrados** (verde): matched Y disponibles para agregar.
- ⚠ **Ya asignados a otro PSC** (amarillo): matched pero ya en otro PSC
  del mismo proyecto. **NO se agregan** (bloqueados por la regla de
  negocio "un item no puede estar en dos PSCs activos del mismo
  proyecto").
- ✗ **No encontrados** (rojo): descripción del Excel no matchea con
  ningún item del PT. **NO se agregan.**
- Badges con conteo en cada header. Acordeón (chevron + collapse) por
  sección.

**Q3 — Preview editable parcialmente:**
- ✏️ **Editable**: cantidad (input numérico).
- 🔒 **Read-only**: descripción, unidad, precio unitario.
- 🗑️ **Botón eliminar** por fila.
- Al confirmar: mensaje de éxito `"N items agregados al PSC"`.

### Regla de negocio nueva (AC nuevo)
**"Un item no puede estar en dos PSCs activos del mismo proyecto."**
El bulk upload respeta esa regla. Items ya asignados a otro PSC del
mismo proyecto van a la categoría "ya asignados" y NO se agregan
(visualización informativa, no es error).

---

## Decisión arquitectónica

**Recomendado:** Corte 6.5 (refactor). Razones documentadas en el
reporte final de Corte 9: la lib `psc-excel.ts` es agnóstica al UI, los
15 tests de funciones puras siguen válidos, refactor es más rápido
(~2h) y menos riesgoso que revertir 3 commits deployados.

**Reusar:**
- `src/lib/psc-excel.ts` (sin cambios).
- `useAuthStore`, `useProjectsStore`, `useProvidersStore`, `useBudgetsStore`,
  `usePscsStore` (ya consumidos por el form).
- `getItemsAvailable(projectId, excludePscId)` (ya en `data-store.ts`).

**Reemplazar:**
- `src/components/pscs/psc-bulk-load-dialog.tsx` → eliminar
  (reemplazado por card).
- `src/components/pscs/psc-bulk-load-card.tsx` (nuevo, ~300 LOC).

**Modificar:**
- `src/components/pscs/psc-form.tsx` (~30 LOC de cambio: importar
  card, remover dialog).

**NO tocar:**
- `src/lib/excel-parser.ts` (regla del spec 6.0, se mantiene).
- `src/lib/data-store.ts` (no necesita cambios — `getItemsAvailable` ya
  existe y funciona como necesitamos).
- `src/app/api/pscs/route.ts`, `src/app/api/budgets/route.ts` (no
  relacionado).

---

## 1. User Story

**As a** residente de obra que crea un PSC,
**I want to** hacer click en "Carga masiva" y ver una card inline con
instrucciones + upload + 3 secciones de resultados (encontrados /
ya-asignados / no-encontrados), editando cantidad y descartando items
antes de confirmar,
**So that** pueda precargar el PSC con los items del contratista en un
solo paso visual (sin modal que tape el resto del form), con
prevención de duplicados contra otros PSCs del mismo proyecto, y con
un mensaje de confirmación claro de lo que se acaba de agregar.

---

## 2. Acceptance Criteria

### 2.1 AC funcionales (UI/UX + lógica de categorización)

- [ ] **AC-1** Existe `src/components/pscs/psc-bulk-load-card.tsx` y exporta
      `PscBulkLoadCard`. Verificación: archivo existe + `grep -E "export\s+function\s+PscBulkLoadCard"` retorna 1 match.
- [ ] **AC-2** La card NO usa `Dialog` de `@/components/ui/dialog` (debe ser
      inline, no modal). Verificación: `grep -c "from.*@/components/ui/dialog" src/components/pscs/psc-bulk-load-card.tsx` retorna 0.
- [ ] **AC-3** `src/components/pscs/psc-form.tsx` importa `PscBulkLoadCard` (no
      `PscBulkLoadDialog`). Verificación: `grep -c "PscBulkLoadDialog" src/components/pscs/psc-form.tsx` retorna 0, y `grep -c "PscBulkLoadCard" src/components/pscs/psc-form.tsx` retorna ≥1.
- [ ] **AC-4** La card muestra instrucciones visibles ANTES de subir el archivo
      (3 pasos: descargar plantilla, llenar, subir). Verificación:
      keywords "Descargar plantilla", "Subir Excel", "Cantidad" presentes
      en la card antes del upload.
- [ ] **AC-5** La card renderiza 3 secciones después de subir: encontrados
      (verde), ya-asignados (amarillo), no-encontrados (rojo). Cada
      sección tiene badge de conteo y es expandible (acordeón).
      Verificación: presencia de keywords "Encontrados", "Ya asignados",
      "No encontrados" en el JSX de la card.
- [ ] **AC-6** La card filtra contra `getItemsAvailable(projectId, pscId)`
      antes de agregar items. Los items matched pero ya asignados a otro
      PSC van a la categoría "ya asignados" y NO se agregan al
      confirmar. Verificación: presencia de la llamada
      `getItemsAvailable(projectId, psc?.id)` en la card, y un map/match
      que categoriza los items en 3 grupos.
- [ ] **AC-7** En la sección "encontrados", la cantidad es editable (input
      numérico). La descripción, unidad y precio unitario son read-only.
      Hay un botón "Eliminar" por fila. Verificación: presencia de
      `<Input ... value={it.quantity}` y `<Button ... onClick={...}>...Eliminar...` en el JSX.
- [ ] **AC-8** Al confirmar, los items de "encontrados" se AGREGAN al state
      `items` del PSC form (después de los existentes, sin sobrescribir).
      NO se persiste al backend hasta el submit del form. Verificación:
      el onConfirm del padre hace `setItems(prev => [...prev, ...newItems])`
      y NO llama a `createPSC`/`updatePSC`.

### 2.2 AC de UX adicional (del feedback del usuario)

- [ ] **AC-X1** (también cubre AC-2) La card NO usa `Dialog` (reformulado).
      Verificación: `grep -c "from.*@/components/ui/dialog" psc-bulk-load-card.tsx` retorna 0.
- [ ] **AC-X2** Filtra contra `getItemsAvailable(projectId, pscId)` — items
      ya asignados a otro PSC no se agregan. Verificación: el array
      `encontrados` que se pasa a `onConfirm` excluye los items cuyo
      `ptItem.id` está en el set de `usedIds` calculado por
      `getItemsAvailable`.
- [ ] **AC-X3** Muestra mensaje de confirmación de la transacción
      post-confirm: toast o alert "N items agregados al PSC".
      Verificación: en el padre (`psc-form.tsx`), después de
      `setItems(...)`, hay una llamada a `toast(...)` o equivalente
      con el texto "items agregados".
- [ ] **AC-X4** Instrucciones visibles antes de subir el archivo
      (reformulado de AC-4 para énfasis). Verificación: el bloque de
      instrucciones está renderizado cuando `parsed === null`.

### 2.3 AC de verificación (regression)

- [ ] **AC-Y1** `npx tsc --noEmit` retorna solo el error preexistente en
      `tests/verifiers/advances-suggestion.spec.ts:21` (TS2741
      'contractId' missing). 0 nuevos.
- [ ] **AC-Y2** `npx vitest run` retorna 751 passed | 0 failed | 8 skipped
      (759 total). 0 regresiones. (V2/V3/V4 del spec 6.0 siguen válidos
      sin cambios — `parsePscExcelFile` / `normalizeForMatching` /
      `matchItemsByDescription` / `detectIncluyeColumn` no cambian.)
- [ ] **AC-Y3** `next build` exit 0. 29+ páginas estáticas. Sin warnings
      nuevos atribuibles al Corte 6.5.
- [ ] **AC-Z** (proceso de migración del verifier) El verifier 6.0
      (`tests/verifiers/audit-corte-6-psc-carga-masiva.spec.ts`) se
      elimina SOLO después de que el verifier 6.5 tenga los 15 tests
      V2/V3/V4 migrados literalmente. Si el verifier 6.5 no cubre los
      15 tests puros, NO se borra el 6.0 (se prefiere duplicación
      temporal a perder cobertura). Esto se valida en el orden
      obligatorio del Commit 2: (a) crear el verifier 6.5 con los 15
      tests migrados + 12+ tests V1, (b) correr `npx vitest run
      tests/verifiers/audit-corte-6.5-psc-carga-masiva-card.spec.ts`
      y confirmar que los 15 tests puros pasan (o fallan con
      "module not found", que es aceptable porque la lib no se tocó
      en este commit, pero el módulo sí existe en `3ebe4d8`), (c)
      entonces eliminar el verifier 6.0, (d) commit.

---

## 3. Edge Cases / Riesgos

- **R1 (PSC sin `id` aún):** el usuario está CREANDO un PSC nuevo, no
  tiene `pscId`. `getItemsAvailable(projectId, undefined)` retorna todos
  los items del PT no asignados a OTROS PSCs del mismo proyecto. Esto
  es correcto: cuando se crea un PSC, ningún item está "ya asignado a
  este PSC" (porque no existe), así que el filtro funciona.
- **R2 (Excel con 100% items ya asignados):** todos los matched items
  caen en "ya asignados". La card muestra warning prominente y
  deshabilita el botón "Confirmar". Verificación: el botón tiene
  `disabled={encontrados.length === 0}`.
- **R3 (Excel con descripciones duplicadas en el Excel):** consolidar
  cantidades (mismo item 2+ veces → sumar). Esto se hace en la lib
  `psc-excel.ts` con `matchItemsByDescription` (mapa keyed por index de
  Excel). Si la misma descripción aparece 2+ veces, el match se hace
  para ambas entradas (mismo `ptItem`). Después, en la card, las
  entradas duplicadas se agrupan visualmente con la cantidad sumada.
  (Nota: la dedupe en `parsePscExcelFile` es un TODO del spec 6.0 que
  sigue abierto. Si la dedupe no se implementa en `psc-excel.ts`, la
  card muestra 2 filas para el mismo item PT. Aceptable para este
  corte; el usuario puede eliminar el duplicado con el botón
  "Eliminar".)
- **R4 (Corte 6.5 corre en paralelo a la lib Corte 6):** el `lib
  psc-excel.ts` no se modifica, así que la card consume la misma lib
  que el dialog. No hay race conditions ni conflictos.
- **R5 (Recarga de la card después de cambio de proyecto):** si el
  usuario cambia `projectId` mientras la card está abierta, los
  `ptItems` cambian. La card debe resetear el state (`parsed`,
  `error`, `step`) para no mostrar resultados del proyecto anterior.
- **R6 (CSP y headers de seguridad):** no se ven afectados. La card no
  hace fetch externo; usa la lib `psc-excel.ts` que es 100% client-side.
- **R7 (Tabla con 453+ filas en "encontrados"):** la card debe ser
  virtualizable o paginada si la lista es muy grande. Aceptable para
  este corte renderizar 50+ items en una tabla con scroll (la mayoría
  de los PSCs tienen 5-30 items, no 453). Documentar como follow-up
  si el usuario reporta performance issues.

---

## 4. Technical Contract

### 4.1 Tipo: `PscImportItem` (reusado de `src/lib/psc-excel.ts`, sin cambios)

```ts
// Reusado tal cual. No se redefine.
export interface PscImportItem {
  excelRow: number;
  ptItem: PscImportPtItem | null;
  description: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  included: boolean;
  warnings: string[];
}
```

### 4.2 Tipo nuevo: `CardCategorized` (estado interno de la card)

```ts
interface CategorizedImport {
  encontrados: PscImportItem[];     // matched AND available
  yaAsignados: PscImportItem[];     // matched AND not in getItemsAvailable
  noEncontrados: PscImportItem[];   // not matched
}
```

### 4.3 Componente: `PscBulkLoadCard`

```tsx
interface PscBulkLoadCardProps {
  open: boolean;                       // (mantenido por compatibilidad con el form; el card es inline, "open" controla visibility)
  onOpenChange: (open: boolean) => void;
  ptItems: PscImportPtItem[];          // (viene del padre via getBudgetByProject)
  projectName: string;
  pscId?: string;                       // undefined si es PSC nuevo
  onConfirm: (items: PscImportItem[]) => void;  // solo "encontrados"
}

export function PscBulkLoadCard(props: PscBulkLoadCardProps): JSX.Element;
```

Estados internos:
- `step: "instructions" | "uploading" | "results"` (default: "instructions")
- `parsed: PscImportResult | null`
- `error: string | null`
- `expanded: { encontrados: boolean; yaAsignados: boolean; noEncontrados: boolean }`

UI principal:
```
┌─────────────────────────────────────────────────────────────┐
│ Carga masiva de PSC                                          │
│ Proyecto: PV — 453 items disponibles en el PT                │
├─────────────────────────────────────────────────────────────┤
│ 1. Descarga la plantilla desde el sistema.                    │
│ 2. Marca con "S" los items que vas a ejecutar y llena         │
│    cantidad.                                                 │
│ 3. Sube el archivo aquí:                                    │
│    [  Arrastra .xlsx  o haz click para seleccionar  ]        │
├─────────────────────────────────────────────────────────────┤
│ (Después de upload)                                          │
│ ✓ Encontrados (N)         [Acordeón colapsable]             │
│ ⚠ Ya asignados a otro PSC (M)  [Acordeón colapsable]         │
│ ✗ No encontrados (K)       [Acordeón colapsable]             │
├─────────────────────────────────────────────────────────────┤
│ [Cancelar]              [Confirmar N items]                   │
└─────────────────────────────────────────────────────────────┘
```

### 4.4 Categorización: 3 pasos

```ts
// Dentro de PscBulkLoadCard, después de parsear:
const availableIds = new Set(
  getItemsAvailable(projectId, pscId).map((i) => i.id)
);
const categorized: CategorizedImport = {
  encontrados: parsed.items.filter(
    (it) => it.ptItem && availableIds.has(it.ptItem.id)
  ),
  yaAsignados: parsed.items.filter(
    (it) => it.ptItem && !availableIds.has(it.ptItem.id)
  ),
  noEncontrados: parsed.items.filter((it) => !it.ptItem),
};
```

### 4.5 Modificación a `psc-form.tsx`

```diff
- import { PscBulkLoadDialog } from "@/components/pscs/psc-bulk-load-dialog";
+ import { PscBulkLoadCard } from "@/components/pscs/psc-bulk-load-card";

- <PscBulkLoadDialog
-   open={bulkDialogOpen}
-   onOpenChange={setBulkDialogOpen}
-   ptItems={ptItems}
-   projectName={project?.name ?? ""}
-   onConfirm={handleBulkConfirm}
- />
+ <PscBulkLoadCard
+   open={bulkDialogOpen}
+   onOpenChange={setBulkDialogOpen}
+   ptItems={ptItems}
+   projectName={project?.name ?? ""}
+   pscId={psc?.id}
+   onConfirm={handleBulkConfirm}
+ />
```

Adicional: en el handler `handleBulkConfirm`, después de `setItems(...)`:
```ts
toast.success(`${newPscItems.length} items agregados al PSC`);
// (usar el toastBus del ToastProvider que ya existe en src/app/layout.tsx)
```

### 4.6 Eliminación: `psc-bulk-load-dialog.tsx`

`git rm src/components/pscs/psc-bulk-load-dialog.tsx`. Reemplazado por la
card. No se usa en ningún otro lugar del codebase.

---

## 5. Dependencies

### Files to Create
- `nextjs_space/nextjs_space/src/components/pscs/psc-bulk-load-card.tsx` (~300 LOC)
- `nextjs_space/nextjs_space/tests/verifiers/audit-corte-6.5-psc-carga-masiva-card.spec.ts` (~150 LOC, en Fase 3)
- `nextjs_space/nextjs_space/docs/specs/audit-corte-6.5-psc-carga-masiva-card.md` (este spec)

### Files to Modify
- `nextjs_space/nextjs_space/src/components/pscs/psc-form.tsx` (~30 LOC: cambio de import + props + toast post-confirm)

### Files to Delete
- `nextjs_space/nextjs_space/src/components/pscs/psc-bulk-load-dialog.tsx` (reemplazado por card)

### Files to Modify (docs, no código)
- `nextjs_space/nextjs_space/docs/specs/audit-corte-6-psc-carga-masiva.md` (agregar nota SUPERSEDED al inicio)
- `nextjs_space/nextjs_space/AGENTS.md` (entrada de log del 6.5)

### Files explicitly NOT touched
- `nextjs_space/nextjs_space/src/lib/psc-excel.ts` (se reusa tal cual)
- `nextjs_space/nextjs_space/src/lib/excel-parser.ts`
- `nextjs_space/nextjs_space/src/lib/data-store.ts` (`getItemsAvailable` ya existe)
- `nextjs_space/nextjs_space/src/lib/auth-store.ts`, `useAuthStore`, `useProjectsStore`, etc.
- `nextjs_space/nextjs_space/src/app/api/pscs/route.ts`
- `nextjs_space/nextjs_space/src/app/api/budgets/route.ts`
- `nextjs_space/nextjs_space/src/components/dashboard-shell.tsx`
- `nextjs_space/nextjs_space/src/components/ui/*` (reusar `Button`, `Card`, `Alert`, `Input` ya existentes)
- `nextjs_space/nextjs_space/package.json`, `nextjs_space/nextjs_space/package-lock.json`

### Existing functions/types reused (read-only)
- `parsePscExcelFile`, `generatePscTemplate` (`src/lib/psc-excel.ts`)
- `PscImportItem`, `PscImportPtItem` (types de `src/lib/psc-excel.ts`)
- `getItemsAvailable` (`src/lib/data-store.ts`)
- `toast` (del `ToastProvider` ya en `src/app/layout.tsx`)
- `Button`, `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `Alert`, `AlertDescription`, `AlertTitle`, `Input`, `Badge` (`src/components/ui/*`)

---

## 6. Verifier Plan

> **Nota:** V2, V3 y V4 son los mismos tests del spec 6.0 (15 tests
> de funciones puras de `psc-excel.ts`). Se copian al spec 6.5 sin
> cambios porque la lib no se modifica.

### V1 — Static source analysis: `psc-bulk-load-card.tsx` y `psc-form.tsx` (~12 tests)

```ts
// tests/verifiers/audit-corte-6.5-psc-carga-masiva-card.spec.ts
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const cardPath = path.join(ROOT, "src/components/pscs/psc-bulk-load-card.tsx");
const formPath = path.join(ROOT, "src/components/pscs/psc-form.tsx");
const dialogPath = path.join(ROOT, "src/components/pscs/psc-bulk-load-dialog.tsx");

describe("AC-1: psc-bulk-load-card.tsx existe y exporta", () => {
  it("existe el archivo", () => {
    expect(existsSync(cardPath)).toBe(true);
  });
  it("exporta PscBulkLoadCard", () => {
    const src = readFileSync(cardPath, "utf8");
    expect(src).toMatch(/export\s+function\s+PscBulkLoadCard/);
  });
});

describe("AC-2 / AC-X1: la card NO usa Dialog (es inline)", () => {
  it("NO importa Dialog de @/components/ui/dialog", () => {
    const src = readFileSync(cardPath, "utf8");
    expect(src).not.toMatch(/from\s+["']@\/components\/ui\/dialog["']/);
  });
});

describe("AC-3: psc-form.tsx usa PscBulkLoadCard (no Dialog)", () => {
  it("importa PscBulkLoadCard", () => {
    const src = readFileSync(formPath, "utf8");
    expect(src).toMatch(
      /import\s+\{[^}]*PscBulkLoadCard[^}]*\}\s+from\s+["']@\/components\/pscs\/psc-bulk-load-card["']/,
    );
  });
  it("NO importa PscBulkLoadDialog (deprecado)", () => {
    const src = readFileSync(formPath, "utf8");
    expect(src).not.toMatch(/PscBulkLoadDialog/);
  });
  it("renderiza <PscBulkLoadCard> en el JSX", () => {
    const src = readFileSync(formPath, "utf8");
    expect(src).toMatch(/<PscBulkLoadCard/);
  });
  it("pasa pscId como prop (para filtro de ya-asignados)", () => {
    const src = readFileSync(formPath, "utf8");
    expect(src).toMatch(/pscId=\{psc\?\.id\}/);
  });
});

describe("AC-4 / AC-X4: instrucciones visibles antes de upload", () => {
  it("contiene keyword 'Descargar plantilla'", () => {
    const src = readFileSync(cardPath, "utf8");
    expect(src).toMatch(/Descargar\s+plantilla/);
  });
  it("contiene keyword 'Subir Excel'", () => {
    const src = readFileSync(cardPath, "utf8");
    expect(src).toMatch(/Subir\s+Excel/);
  });
  it("contiene keyword 'Cantidad' (instrucciones para llenar)", () => {
    const src = readFileSync(cardPath, "utf8");
    expect(src).toMatch(/Cantidad/);
  });
});

describe("AC-5: 3 secciones con badges", () => {
  it("sección 'Encontrados'", () => {
    const src = readFileSync(cardPath, "utf8");
    expect(src).toMatch(/Encontrados/);
  });
  it("sección 'Ya asignados'", () => {
    const src = readFileSync(cardPath, "utf8");
    expect(src).toMatch(/Ya\s+asignados/);
  });
  it("sección 'No encontrados'", () => {
    const src = readFileSync(cardPath, "utf8");
    expect(src).toMatch(/No\s+encontrados/);
  });
});

describe("AC-6 / AC-X2: filtra contra getItemsAvailable", () => {
  it("llama getItemsAvailable con (projectId, pscId)", () => {
    const src = readFileSync(cardPath, "utf8");
    expect(src).toMatch(/getItemsAvailable\s*\(\s*projectId\s*,\s*[^)]+\)/);
  });
});

describe("AC-7: cantidad editable + botón eliminar por fila", () => {
  it("input de cantidad presente en render", () => {
    const src = readFileSync(cardPath, "utf8");
    expect(src).toMatch(/<Input[^>]*quantity|<Input[^>]*cantidad/);
  });
  it("botón eliminar presente", () => {
    const src = readFileSync(cardPath, "utf8");
    expect(src).toMatch(/Eliminar|eliminar/);
  });
});

describe("AC-8: onConfirm agrega al state sin persistir", () => {
  it("psc-form pasa setItems via onConfirm (setItems handler)", () => {
    const src = readFileSync(formPath, "utf8");
    expect(src).toMatch(/setItems\s*\(\s*\(?\s*prev/);
  });
  it("psc-form NO llama a createPSC ni updatePSC dentro de handleBulkConfirm", () => {
    const src = readFileSync(formPath, "utf8");
    // El handleBulkConfirm debe hacer setItems, NO createPSC/updatePSC.
    // createPSC/updatePSC solo se llaman en handleSubmit.
    const handleBulkConfirmMatch = src.match(
      /handleBulkConfirm[\s\S]*?^  \}/m, // desde la función hasta el cierre
    );
    expect(handleBulkConfirmMatch).toBeTruthy();
    const body = handleBulkConfirmMatch?.[0] ?? "";
    expect(body).toContain("setItems");
    expect(body).not.toMatch(/createPSC|updatePSC/);
  });
});

describe("AC-X3: mensaje de confirmación post-confirm", () => {
  it("psc-form llama a toast o alert después de setItems", () => {
    const src = readFileSync(formPath, "utf8");
    expect(src).toMatch(/toast|alert|setInfo/);
  });
});
```

### V2 — V2 (sigue del spec 6.0): `normalizeForMatching` (6 tests)

```ts
import { normalizeForMatching } from "@/lib/psc-excel";

describe("normalizeForMatching (NFD + lowercase + trim)", () => {
  it("lowercase + trim", async () => {
    const m = await tryImportPscExcel();
    expect(m.normalizeForMatching("  EXCAVACION  ")).toBe("excavacion");
  });
  // ... 5 tests más idénticos al spec 6.0 ...
});
```

(Los 6 tests de `normalizeForMatching` se copian del spec 6.0 sin cambios.)

### V3 (sigue del spec 6.0): `matchItemsByDescription` (4 tests)

(4 tests idénticos al spec 6.0.)

### V4 (sigue del spec 6.0): `detectIncluyeColumn` (5 tests)

(5 tests idénticos al spec 6.0.)

### V5 (sigue del spec 6.0): tsc

```bash
cd nextjs_space/nextjs_space
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit
```

**Criterio:** exit 2 (tsc reporta errores), pero el único error es el
preexistente `tests/verifiers/advances-suggestion.spec.ts:21` (TS2741
'contractId' missing). 0 nuevos.

### V6 (sigue del spec 6.0): vitest full

```bash
cd nextjs_space/nextjs_space
NODE_OPTIONS="--max-old-space-size=4096" npx vitest run
```

**Criterio:** 751 passed | 0 failed | 8 skipped (759 total). 0 regresiones.
**Crítico:** los 17 tests del spec 6.0 (`audit-corte-6-psc-carga-masiva.spec.ts`,
archivo viejo) **deben seguir pasando** porque la lib no cambia. El
spec 6.5 tiene su propio verifier (`audit-corte-6.5-*.spec.ts`) que
reemplaza al viejo (mismo nombre de archivo pero nuevo contenido).
Si el spec viejo está en `tests/verifiers/`, hay que **eliminarlo** o
**renombrarlo** para evitar conflicto de nombres de describe blocks.

### V7 (sigue del spec 6.0): build

```bash
cd nextjs_space/nextjs_space
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

**Criterio:** exit 0. 29+ páginas estáticas.

### V8 — Manual: browser test end-to-end (lo ejecuta el usuario)

1. Login con un usuario de `area=tecnico` en un proyecto con PT cargado.
2. Click "Nuevo PSC" → seleccionar proyecto + contratista.
3. Click "Carga masiva" → debe aparecer la CARD INLINE (no modal).
4. Verificar que NO se ve un overlay oscuro ni un dialog flotante.
5. Click "Descargar plantilla" → bajar el .xlsx con 5 columnas (sin
   Código).
6. Llenar 10 filas con Incluye=S y Cantidad variable. Dejar el resto
   vacío.
7. Subir el archivo → la card muestra 3 secciones con conteos.
8. Verificar que las 3 secciones tienen badges de conteo y son
   expandibles.
9. Editar la cantidad de un item en "encontrados" → debe persistir
   el cambio en el preview.
10. Click "Eliminar" en un item → desaparece de la lista.
11. Click "Confirmar N items" → toast "N items agregados al PSC".
12. Verificar que los items aparecen en el form PSC, después de los
    existentes, sin sobrescribir.

### V9 — Manual: test de "ya asignados"

1. Crear un PSC1 con proyecto PV, contratista X, items 1-5 del PT.
2. Guardar PSC1 (estado ACTIVE).
3. Crear un PSC2 con el mismo proyecto PV, mismo contratista X.
4. Click "Carga masiva" → descargar plantilla.
5. Llenar las mismas filas (items 1-5) con Incluye=S.
6. Subir el archivo → debe mostrar:
   - "Ya asignados" (5): los items 1-5 están en amarillo.
   - "Encontrados" (0): porque los matched están en otro PSC.
   - Botón "Confirmar" deshabilitado (encontrados.length === 0).
7. Verificar que ningún item se agregó al PSC2 (regla de negocio
   respetada).

### V10 — Manual: regression (flujo normal sigue OK)

1. Click "+ Ítem" en el mismo form PSC2 (sin bulk load).
2. Verificar que el dropdown muestra solo los items del PT que NO
   están en PSC1 (los items 1-5 NO aparecen, los items 6-453 sí).
3. Seleccionar un item y guardar → PSC2 tiene 1 item nuevo.

---

## 7. Estrategia de commits (4 commits)

| # | Mensaje | Archivos | LOC | Verificación pre-push |
|---|---|---|---|---|
| 1 | `docs(specs): spec Corte 6.5 card inline + mark old as superseded` | `docs/specs/audit-corte-6.5-psc-carga-masiva-card.md` (crear) + `docs/specs/audit-corte-6-psc-carga-masiva.md` (modificar: prepend SUPERSEDED) | ~600 + 5 | AC-Y1 (tsc) + AC-Y2 (vitest) + AC-Y3 (build) |
| 2 | `test(pscs): verifier audit-corte-6.5-psc-carga-masiva-card (TDD Red)` | `tests/verifiers/audit-corte-6.5-psc-carga-masiva-card.spec.ts` (crear) + `tests/verifiers/audit-corte-6-psc-carga-masiva.spec.ts` (eliminar) | ~150 -200 | AC-Y1 + AC-Y2 (verifier en rojo, 18 tests fallan) |
| 3 | `feat(pscs): psc-bulk-load-card (inline, 3 secciones, filtra ya-asignados)` | `src/components/pscs/psc-bulk-load-card.tsx` (crear) | ~300 | AC-1..8 + AC-X1..X4 (verifier en verde, 18+ tests) |
| 4 | `refactor(pscs): psc-form usa PscBulkLoadCard + delete dialog` | `src/components/pscs/psc-form.tsx` (modificar) + `src/components/pscs/psc-bulk-load-dialog.tsx` (eliminar) | ~30 -280 | AC-3 (form usa card, no dialog) + AC-Y1..Y3 |

**Push:** `origin/main`, branch `main`, commits individuales
(`git add` por archivo, NO `git add -A`). Sin `--force`.

**Orden estricto:** 1 → 2 → 3 → 4. Commit 2 es TDD Red (verifier falla).
Commit 3 es TDD Green (verifier pasa). Commit 4 es el refactor final.

**Sobre el verifier viejo (audit-corte-6-psc-carga-masiva.spec.ts):**
se elimina en Commit 2. No es un "verifier superseded" — es un archivo
cuyo contenido está reemplazado por el verifier 6.5. Si el archivo
viejo existe después del Commit 2, hay conflicto de nombres de
describe blocks (los dos specs describen `PscBulkLoadDialog`).

**Sobre los tests V2-V4:** el verifier 6.5 los incluye copiados del
spec 6.0. La lib `psc-excel.ts` no cambia, así que los tests siguen
válidos. Si el usuario quiere ejecutar SOLO el verifier 6.5 sin
correr el viejo, debe asegurarse de que el viejo está eliminado
(Commit 2 lo hace).

---

## 8. Out of Scope

- Migrar a un componente compartido `<ExcelUploadCard>` que pueda
  reusarse en otros módulos (cortes, contratos, etc.). El componente
  es PSC-específico en este corte; la generalización es follow-up.
- Paginación o virtualización de la tabla de "encontrados" si tiene
  >50 items. La mayoría de PSCs tienen 5-30 items; 453 es excepcional.
- Dedupe en `parsePscExcelFile` (sumar cantidades cuando la misma
  descripción aparece 2+ veces en el Excel). El usuario puede usar el
  botón "Eliminar" en la card como workaround. TODO abierto del
  spec 6.0.
- Soporte para editar el precio unitario en la card (solo cantidad
  es editable por ahora).
- Mostrar el precio total de la card en el header ("Total a agregar:
  $X COP"). El total se calcula pero no se muestra prominente. Si el
  usuario lo pide, es 1 línea más.
- Persistir la card state a través de la navegación (si el usuario
  navega a otra tab y vuelve, la card resetea). UX simple, reset on
  close.
- Tests E2E con Playwright. No hay infra; los verifications son
  shell + manual.

---

## 9. Plan de Aborto

**Cancelar el commit y reportar sin push si se cumple CUALQUIERA de:**

- **A1:** AC-Y1 (tsc) introduce errores nuevos. Abortar.
- **A2:** AC-Y2 (vitest) introduce regresiones. En particular, si el
  spec 6.0 viejo (eliminado en Commit 2) tenía tests que no están
  en el spec 6.5 y se rompen, abortar y migrarlos.
- **A3:** AC-Y3 (build) falla con exit != 0 O cambia el conteo de
  páginas estáticas. Abortar.
- **A4:** El verifier (Commit 2) no logra 18+ tests en rojo. Abortar.
- **A5:** Después de Commit 3, los tests del verifier no quedan en
  verde. Re-implementar la card.
- **A6:** Después de Commit 4, el form no compila o rompe el flujo
  existente (+ Ítem, save, etc.). Re-implementar la integración.
- **A7:** Browser test (V8/V9/V10) muestra comportamiento incorrecto
  (e.g., la card no aparece, los items no se categorizan bien, el
  toast no se muestra). Re-diagnóstico.

---

## 10. Approval

**Status:** ⏳ Pending Review (Corte 6 base ya desplegado, refactor
6.5 pendiente de OK del usuario)

---

## 11. Decisiones de diseño (resumen)

| # | Decisión | Elegida | Razón | Trade-off aceptado |
|---|---|---|---|---|
| 1 | Reusar `psc-excel.ts` | Sí, sin cambios | Agnóstico al UI; 15 tests siguen válidos | Ninguno — la lib está probada |
| 2 | UI pattern | Card inline (no dialog) | El usuario probó dialog en prod y pidió cambio | Cambio pequeño de scope (300 LOC) |
| 3 | Categorías de items | 3: encontrados / ya-asignados / no-encontrados | El usuario pidió explícitamente esta triada | Lógica adicional para "ya-asignados" (1 map) |
| 4 | Editable en preview | Solo cantidad | El usuario lo pidió así | Descripción/unidad/precio son read-only (vienen del PT) |
| 5 | Filtro de ya-asignados | `getItemsAvailable` (existe) | Sin nueva lógica en lib, reusa data-store | El filtro se aplica en la card, no en la lib |
| 6 | Toast post-confirm | Sí, mensaje "N items agregados" | El usuario lo pidió | 1 línea de código + import del toast |
| 7 | Acordeón por sección | Sí, cada sección colapsable | Lista limpia con foco en 1 sección a la vez | Más JSX, pero mejor UX |
| 8 | Eliminar el dialog viejo | Sí (`git rm`) | El card lo reemplaza completamente | Ninguno — el dialog no se usa en otro lugar |
| 9 | Eliminar el verifier viejo | Sí (Commit 2) | El verifier 6.5 lo reemplaza | 32 tests → 18 tests (más enfocados, sin UI dialog) |
| 10 | Mantener el spec 6.0 (no eliminar) | Sí, con banner SUPERSEDED al inicio | Trazabilidad histórica del aprendizaje | El spec es read-only y no afecta el build |

---

## 12. Changelog post-implementación

(Se llena después de aplicar los 4 commits.)
