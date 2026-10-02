# Feature: Control de Cambios del presupuesto (CC-001, CC-002…)

> **Estado:** ✅ Aprobada e implementada el 2026-09-30 (decisiones en la §8).
> Verifier: `nextjs_space/tests/verifiers/budget-change-control.spec.ts`.
> Prerrequisitos que hubo que arreglar antes: `bug-aiu-porcentaje-sobre-costo-directo.md`
> y `bug-presupuestos-persistencia.md`.
>
> **Origen:** gap analysis §3.2 (`gap-analysis-cliente-control-cambios.md`),
> PDF del cliente pág. 2–3 ("COTIZACIÓN CONTROL DE CAMBIOS 001", Marzo
> Triangular → Producomex, Remodelación oficinas, 18-jul-2025).

---

## 0. Lo que el PDF muestra de verdad (corrige el gap analysis)

1. **El Control de Cambios NO es un diff entre versiones del PT.** Es un
   documento propio con **sus propios ítems**: actividades que se agregan
   (valor positivo) y que se retiran o descuentan (valor negativo, en rojo y
   entre paréntesis), más un "Descuento general" GLB. Su total se suma o resta
   al presupuesto vigente. El gap analysis proponía `diff_json = v(n) − v(n−1)`,
   pero eso ni siquiera es posible hoy: `budget_versions` solo guarda
   `total_value`, no los ítems de cada versión.
2. **Los medios de solicitud son:** `Acta Comité`, `Mail`, `Solicitud Verbal`,
   `Otros (¿Cuál?)`. El gap analysis los transcribió mal ("Acto Común", "Mal").
3. **Cabecera:** Proyecto, Fecha emisión, Asesor, Obra, Formato "CONTROL DE
   CAMBIO", Código, Versión, Ciudad, Departamento, Área construcción (m²).
4. **Columnas por ítem:** ITEM (código de capítulo/ítem), ACTIVIDADES, UND,
   CANT, VR UNITARIO, VR TOTAL, **% Incidencia × actividad** y **× capítulo**
   (= valor ÷ total costos directos del CC; ej. −636.000 ÷ 30.732.844,34 = −2,1 %).
5. **Liquidación (números reales del PDF):**

   | Concepto | Base | Valor |
   | --- | --- | --- |
   | Total costos directos (CD) | Σ ítems | $ 30.732.844,34 |
   | Administración | 8 % × CD | $ 2.458.627,55 |
   | Imprevistos | 5 % × CD | $ 1.536.642,22 |
   | Utilidad | 5 % × CD | $ 1.536.642,22 |
   | IVA | **19 % × Utilidad** | $ 291.962,02 |
   | **Total obra** | CD + A + I + U + IVA | **$ 36.556.718,34** |

   El total se calcula con los valores sin redondear y se redondea al final
   (sumar los componentes ya redondeados da ,35).

---

## 1. User Story

**As a** Director / Residente de obra,
**I want to** registrar un Control de Cambios con los ítems que se agregan o
retiran, el medio por el que el cliente lo pidió y su liquidación AIU + IVA,
**So that** quede trazado cada cambio de alcance del cliente, quién lo pidió,
quién lo aprobó y cuánto movió el presupuesto.

---

## 2. Acceptance Criteria

### Datos y cálculo (función pura `lib/budget-change-control.ts`)

- [x] AC-1: `computeChangeOrderTotals(items, aiu)` devuelve por ítem
      `totalPrice = cantidad × vr unitario` (puede ser negativo), `directCost`,
      `administration`, `imprevistos`, `utilidad`, `iva = utilidad × 19 %`,
      `total`, y `incidencePct` por ítem y por capítulo. Con los ítems del PDF
      reproduce exactamente la tabla de la §0.5.
- [x] AC-2: Los % de AIU se **congelan** en el CC al crearlo (copia de
      `aiu_configs` del proyecto). Cambiar el AIU del proyecto después no
      altera CCs existentes.
- [x] AC-3: `requestChannel ∈ {ACTA_COMITE, MAIL, SOLICITUD_VERBAL, OTROS}` es
      obligatorio; si es `OTROS`, `requestChannelOther` es obligatorio.
- [x] AC-4: Un CC necesita al menos 1 ítem. Se permiten ítems con valor 0
      (filas de título como "BRANDING") y negativos.
- [x] AC-5: Numeración consecutiva **por presupuesto**: CC-001, CC-002…
      (no se reutiliza un número aunque el CC se rechace o elimine).

### Workflow

- [x] AC-6: Estados `DRAFT → SUBMITTED → APPROVED` o `SUBMITTED → REJECTED`,
      con la misma estructura que `cuts-workflow.ts` (función pura
      `evaluateChangeOrderAction`, reutilizada por la ruta).
- [x] AC-7: Rechazar exige motivo (igual que `workcut-rejection-reason-required`).
- [x] AC-8: Solo se edita o elimina en `DRAFT` o `REJECTED`. `APPROVED` es
      inmutable.
- [x] AC-9: Al **aprobar**, en una sola transacción:
      - se crea una nueva `budget_version` (n+1, activa) con
        `notes = "CC-00X: <descripción>"` y el nuevo total;
      - se suma el **costo directo** del CC al Presupuesto Tope y al Presupuesto
        Cliente (§8, preguntas 1 y 2).
- [x] AC-10: El rol y el usuario de cada acción salen de la sesión (patrón de
      `bug-cortes-pagos-integridad.md`); los totales los calcula el servidor.

### UI

- [x] AC-11: Nueva pestaña **"Control de cambios"** en
      `/tecnico/presupuestos/[id]`, junto a "Versiones": lista (número, fecha,
      medio, CD, total, estado) y botón "Nuevo control de cambios".
- [x] AC-12: Formulario: cabecera (fecha, medio de solicitud con "¿Cuál?",
      descripción/obra, asesor precargado de las condiciones comerciales del
      PT) + tabla de ítems. Opción "Agregar desde el presupuesto" que copia un
      ítem del Tope (código, descripción, und, vr unitario) para ajustar la
      cantidad.
- [x] AC-13: Los valores negativos se muestran en rojo y entre paréntesis,
      igual que el formato del cliente, con columna de % incidencia y bloque de
      liquidación AIU + IVA al pie.

---

## 3. Edge Cases

- **Proyecto sin configuración de AIU:** no se puede crear el CC y la pantalla
  lleva a configurar el AIU.
- **CD = 0** (solo filas en cero): % incidencia = 0, sin dividir entre cero.
- **CC que deja el presupuesto en negativo:** se permite, con advertencia visible.
- **Dos CC aprobados a la vez:** la creación de la versión n+1 se hace con
  bloqueo de fila sobre `budgets` para no duplicar el número de versión.

---

## 4. Technical Contract

```typescript
export type ChangeRequestChannel = "ACTA_COMITE" | "MAIL" | "SOLICITUD_VERBAL" | "OTROS";
export type ChangeOrderStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

export interface BudgetChangeOrderItem {
  id: string;
  chapterCode?: string;      // "6"
  itemCode?: string;         // "6.2"
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;         // negativo = deducción
  totalPrice: number;        // calculado en servidor
}

export interface BudgetChangeOrder {
  id: string;
  budgetId: string;
  number: string;            // "CC-001"
  issueDate: string;
  requestChannel: ChangeRequestChannel;
  requestChannelOther?: string;
  description: string;
  advisorName?: string;
  items: BudgetChangeOrderItem[];
  aiuSnapshot: { administration: number; imprevistos: number; utilidad: number; ivaOnUtility: number };
  directCost: number;
  total: number;
  status: ChangeOrderStatus;
  rejectionReason?: string;
  resultingVersionId?: string;
  createdBy: string; approvedBy?: string; approvedAt?: string;
  createdAt: string;
}
```

**API:** `/api/budget-change-orders` — `GET ?budgetId=`, `POST`, `PUT`
(solo DRAFT/REJECTED), `DELETE` (solo DRAFT/REJECTED), `PATCH { id, action }`
(SUBMIT | APPROVE | REJECT).

**Migración:** `008_budget_change_orders.sql` → tablas
`budget_change_orders` y `budget_change_order_items`. No toca tablas existentes.

**Verifier:** `tests/verifiers/budget-change-control.spec.ts` — AC-1 con los
números reales del PDF, AC-3 a AC-8 sobre funciones puras y AC-9/AC-10 sobre la
ruta con BD simulada (patrón de `cuts-payments-integrity.spec.ts`).

---

## 5. Dependencias

- Lee: `aiu_configs`, `budgets` (condiciones comerciales / asesor), `budget_layers` + `budget_items` (para "Agregar desde el presupuesto").
- Escribe al aprobar: `budget_versions`, `budgets`.
- **No toca** `cuts-workflow.ts` ni `payments-workflow.ts`.

---

## 6. Out of Scope (v1)

- Generar el Excel/PDF con el formato del cliente. Encaja después como una
  plantilla nueva del módulo `document-generator`.
- Fusionar los ítems del CC dentro de las capas del Tope (ver §8, pregunta 2).
- Firma o aprobación del cliente dentro de la app.

---

## 7. ⚠️ Bloqueante detectado: la validación del AIU no coincide con el cliente

`validateAiu` (`lib/aiu-constants.ts`) y `POST/PUT /api/aiu-configs` exigen que
**A + I + U sumen 100 %**. Sin embargo:

- el documento real del cliente usa **8 % + 5 % + 5 % = 18 %** sobre costo directo;
- la propia app ya calcula el AIU como `% × costo directo`
  (`presupuestos/[id]/page.tsx`, `tecnico/aiu/page.tsx`).

Con la regla actual, el AIU del cliente **no se puede guardar**. Y un AIU que sí
pase la validación (ej. 10 + 45 + 45) duplicaría el valor de la obra. La app
tampoco calcula el IVA sobre la utilidad. Hay que resolverlo antes o junto con
este feature (bug-spec aparte).

---

## 8. Decisiones (2026-09-30)

1. Un CC aprobado mueve **Cliente y Tope**.
2. Se suma el **costo directo** (el AIU se aplica encima, como en la pestaña AIU).
3. **Roles:** crean, editan y envían RESIDENTE, DIRECTOR y ADMIN; aprueban y
   rechazan GERENTE y ADMIN.
4. **AIU:** se adopta el modelo del cliente → `bug-aiu-porcentaje-sobre-costo-directo.md`.
5. Integrar los ítems del CC dentro de los capítulos del Tope queda fuera de
   la v1 (§6).

---

## 9. Approval

**Status:** ✅ Approved 2026-09-30
