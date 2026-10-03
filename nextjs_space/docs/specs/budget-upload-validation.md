# Spec: Validación de carga de Presupuesto Tope

**Status**: Draft
**Owner**: anubclao
**Date**: 2026-10-03
**Source of truth**: bug case real del 2026-10-02/03 (PRESUPUESTO OFICIAL INFRADEPORTIVO.xlsx)

## Contexto

Hoy el flujo de upload de Presupuesto Tope (PT) en `/tecnico/presupuestos/cargar`
acepta cualquier Excel que el parser pueda leer y guarda el primer item en
silencio. Ya tuvimos un caso donde:

1. El usuario subió un Excel de un mega-proyecto municipal (6 frentes, 459
   items, $11.234.939.521 de items).
3. El reporte mostró $18.574.122.824 (datos corruptos por un parser viejo).
4. El usuario no podía eliminar el PT malo porque no existe endpoint DELETE.
5. El usuario renombró el proyecto a `PARQUES DEL VALLE` para coincidir con
   el Excel, pero no hay validación automática de que coincida.

## User Stories

- **US-A01**: Como ADMIN, quiero que el sistema valide que el título del
  Excel coincide con el nombre del proyecto en BD antes de aceptar la carga,
  para evitar subir el archivo equivocado al proyecto equivocado.
- **US-A02**: Como usuario autorizado a cargar PT, quiero ver un modal con
  resumen (cantidad de ítems, valor total, desglose por frente) antes de
  confirmar, para detectar errores de totalización antes de que queden en BD.
- **US-A03**: Como usuario NO-admin, si intento reemplazar un PT que ya está
  AFECTADO (con cortes o pagos PAID), quiero ver un mensaje claro que me
  pida contactar al admin, para preservar la trazabilidad contable.

## Acceptance Criteria

### AC-1: Validación de título

- **Given**: el usuario está en `/tecnico/presupuestos/cargar?projectId=X`
  donde `X.name = "PARQUES DEL VALLE"`
- **When**: sube un Excel cuya fila 1 = "PRESUPUESTO GENERAL PARQUES DEL
  VALLE"
- **Then**: el parser extrae el título "PRESUPUESTO GENERAL PARQUES DEL
  VALLE" y la validación acepta (match por contención, case-insensitive).
- **And**: si la contención falla, la carga se rechaza con error claro antes
  del step preview.

### AC-2: Modal de preview con totales

- **Given**: Excel cargado y validación de título OK
- **When**: el parser termina
- **Then**: se muestra un modal con:
  - Título del Excel
  - Cantidad de ítems
  - Valor total sumado
  - Desglose por frente (tabla: frente | #ítems | subtotal)
  - Botón "Confirmar" + "Cancelar"
- **And**: el botón "Confirmar" del modal es el único path al POST.

### AC-3: Permisos de reemplazo

- **Given**: el proyecto ya tiene un PT cargado
- **When**: el usuario NO-admin intenta subir otro Excel al mismo proyecto
- **Then**: si el PT existente tiene cortes en estado APPROVED/PAID, o pagos
  PAID, el sistema rechaza con 403 + mensaje "Contacta al administrador para
  reemplazar este PT".
- **And**: si el PT NO está afectado (sin cortes APPROVED/PAID, sin pagos
  PAID), el sistema permite crear una nueva versión normalmente.

### AC-4: Modelo multi-frente

- **Given**: un Excel con N clasificaciones distintas (frentes)
- **When**: el parser agrupa por frente
- **Then**: cada frente tiene su propio resumen (items, subtotal) y todos
  van al mismo PT (mismo `budget_id`).
- **And**: el modelo `budget_layers` no cambia — los frentes son una vista
  derivada del agrupamiento, no una tabla nueva.

## Modelo de datos

### ParsedExcel (extendido)

```ts
interface ParsedExcel {
  title: string;           // contenido de fila 1 (texto plano)
  rows: ParsedExcelRow[];
  frentes: FrenteSummary[];
  totalValue: number;
  chapterCount: number;
  itemCount: number;
  warnings: string[];
}

interface FrenteSummary {
  name: string;            // valor de columna "Clasificación"
  itemCount: number;
  subtotal: number;        // suma de totalPrice de los items de este frente
  chapterCount: number;    // capítulos distintos dentro del frente
}
```

### Permisos (nuevo)

```ts
// src/lib/permissions.ts
export type BudgetAffectedState = {
  hasApprovedCuts: boolean;
  hasPaidPayments: boolean;
};

export async function getBudgetAffectedState(
  budgetId: string,
): Promise<BudgetAffectedState>;

export function canReplaceBudget(
  userRole: Role,
  affected: BudgetAffectedState,
): boolean;
// true si role === 'ADMIN' OR (no cuts approved AND no payments paid)
```

## Decisiones de diseño

### D-1: Match por contención, no exacto

El Excel title suele ser `"PRESUPUESTO GENERAL <NOMBRE>"` mientras que el
project.name es `<NOMBRE>`. Match exacto sería frágil. Usamos:

```ts
const norm = (s: string) =>
  s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const excelTitleNorm = norm(parsed.title);
const projectNameNorm = norm(project.name);
const matches = excelTitleNorm.includes(projectNameNorm) ||
                projectNameNorm.includes(excelTitleNorm);
```

Si ninguna contención matchea, error: `"El titulo del Excel ('...') no
coincide con el nombre del proyecto ('...'). Verifica que sea el archivo
correcto."`

### D-2: Modal reemplaza el step "preview"

Hoy el step "preview" muestra una tabla larga de filas. Lo reemplazamos
por un modal con resumen + botón "Confirmar". La tabla detallada sigue
disponible si el usuario la pide, pero el flow happy-path es solo el modal.

### D-3: Estado "afectado" se calcula fresh cada vez

Para evitar inconsistencias entre el rol del usuario en sesión y el estado
real del PT, hacemos la query en cada upload attempt. Sin cache por ahora.

### D-4: No agregamos tabla `frentes`

Los frentes son una vista derivada del agrupamiento de items por
`classification`. Guardarlos en su propia tabla agregaría complejidad sin
beneficio (los frentes no son editables individualmente en el flujo
actual). El parser calcula el resumen en cada upload.

## Quality gates

- `npx tsc --noEmit` → 0 errores
- `npm test` → ≥5 nuevos tests verdes
- Sin `any` introducido
- Coverage del módulo `excel-parser` ≥80%

## Out of scope

- UI para editar frentes individualmente
- Multi-proyecto desde un solo Excel (esto fue interpretado mal inicialmente;
  ver memoria del proyecto)
- Endpoint DELETE para budgets (sigue siendo SQL manual)