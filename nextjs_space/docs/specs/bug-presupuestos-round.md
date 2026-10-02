# Bug: Carga de presupuesto redondea valores y nunca lee un Excel real

## 1. User Story

**As a** residente o director de obra que necesita cargar el Presupuesto Tope
desde un Excel real,
**I want to** subir un archivo `.xlsx` y ver los valores exactos que escribí
en cada celda (incluyendo centavos, valores con `,` o `.` como separador y
números grandes sin redondeo),
**So that** el PT cargado refleje fielmente el APU de la obra y no tenga
que "arreglar a mano" los precios que el sistema cambió.

## 2. Acceptance Criteria

### Carga de archivo

- [ ] AC-1: La página `/tecnico/presupuestos/cargar` lee archivos `.xlsx` y
      `.xls` reales (no solo la "muestra" hardcodeada).
- [ ] AC-2: El `Accept` del input incluye `.xlsx`, `.xls` y `.csv` y al
      seleccionar un archivo se procesa sin mostrar un mensaje de "Mock".
- [ ] AC-3: Si el archivo no se puede parsear, se muestra un error legible
      en el `<Alert>` de la página, no un mensaje genérico "Mock".

### Valores numéricos

- [ ] AC-4: Los inputs de **Cantidad** y **Vr Unit** del formulario de
      "ítem no previsto" aceptan valores con hasta 2 decimales, sin
      redondear al alza.
- [ ] AC-5: Los inputs no fuerzan un `step` que obligue a redondear a
      múltiplos de 1.000 para `Vr Unit` ni a 1 para `Cantidad` cuando
      el usuario teclea decimales.
- [ ] AC-6: El parser reconoce números con separador colombiano (`1.234,56`)
      **y** anglosajón (`1,234.56`) y los convierte a `number` sin perder
      precisión.

### Persistencia

- [ ] AC-7: Cuando el usuario crea un ítem no previsto, la cantidad y el
      precio unitario que se persisten en `budget_items` coinciden con lo
      que escribió (con la precisión decimal que tipeó).

## 3. Edge Cases

- Archivo Excel con una sola hoja, primera fila con encabezados mezclados
  (mayúsculas, minúsculas, con tildes) → debe detectarse.
- Archivo con valores en formato texto ("$ 1.234.567,89") → debe limpiarse
  antes de convertir.
- Celda vacía en Cantidad o Vr Unit → tratarla como 0, no como NaN.
- Archivo CSV separado por `;` (locale colombiano de Excel) → soportarlo.

## 4. Technical Contract

### Hook / util

```typescript
// src/lib/excel-parser.ts
export async function parseExcelFile(
  file: File,
  customMapping?: Partial<ExcelColumnMapping>,
): Promise<ParsedExcel>;
```

### Inputs sin redondeo

```tsx
<Input
  type="number"
  inputMode="decimal"
  step="any" // <-- clave: NO forzar step numérico
  min="0"
  value={quantity}
  onChange={(e) => setQuantity(Number(e.target.value))}
/>
```

### Dependencias nuevas

- `xlsx` (SheetJS) — parser de .xlsx/.xls/.csv. Es la lib más liviana y
  funciona en browser sin backend.

## 5. Dependencias modificadas

- [src/lib/excel-parser.ts](nextjs_space/src/lib/excel-parser.ts) —
  añadir `parseExcelFile()` que use `xlsx`.
- [src/app/tecnico/presupuestos/cargar/page.tsx](nextjs_space/src/app/tecnico/presupuestos/cargar/page.tsx)
  — reemplazar el handler de "Mock" por llamada real.
- [src/app/tecnico/presupuestos/[id]/page.tsx](nextjs_space/src/app/tecnico/presupuestos/[id]/page.tsx#L746-L758)
  — quitar `step="0.01"` y `step="1000"` en inputs de cantidad y vr unit.
