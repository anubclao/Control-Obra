# Feature: Gap Analysis — Documentos del Cliente (PDF de prueba)

> **Estado:** ✅ Aprobada el 2026-09-29. §3.1 y §3.3 ya implementadas con sus
> verifiers verdes. §3.2 ya tiene spec propia pendiente de aprobación:
> [`budget-change-control.md`](budget-change-control.md), que corrige el diseño
> de esta sección (el CC trae ítems propios, no es un diff entre versiones).
> §3.4 sigue como audit pendiente.
>
> **Origen del análisis:** el cliente envió un PDF titulado "INFORMACIÓN PARA
> RUEBA DE APP" (7 páginas) con ejemplos reales de su operación:
>
> 1. Cotización inicial (Marzo Triangular → Producomex, $120.273.386)
> 2. Cotización Control de Cambios 001 (incrementos/reducciones respecto a v0, motivo Solicitud Verbal)
> 3. Orden de compra inicial + Control de Cambios (formato Oracle-EBS, Carvajal)
> 4. Captura del flujo "Cargar presupuesto desde Excel" (3 pasos)
> 5. Contrato de obra civil a todo costo (contrato 000002025-0703)
> 6. Captura del dashboard PSC + "Crear PSC"
> 7. Captura de "Crear corte de obra" (período, retención 10%, anticipo)
>
> Los textos extraídos viven en [docs/specs/\_pdf_cliente_para_prueba.md](_pdf_cliente_para_prueba.md)
> y las imágenes escaneadas en `docs/specs/_pdf_cliente_imgs/`.

---

## 1. Contexto

El cliente está mostrando dos cosas mezcladas en el PDF:

- **(a) Documentos reales** de su operación (cotizaciones Marzo Triangular,
  contratos, OCs de Carvajal). Sirven como **referencia de campos y formato**,
  no como spec funcional.
- **(b) Mockups propios** (modales "Crear nuevo proyecto", "Crear proveedor",
  "Cargar presupuesto desde Excel", "Crear PSC", "Crear corte de obra") que
  son **capturas del estado deseado de la app** y mapean casi 1-a-1 a los
  formularios ya existentes en ControlObra.

El objetivo de este gap analysis es identificar **qué del PDF (a)+(b) ya está
cubierto**, **qué hay que ajustar sin romper** los workflows definidos, y
**qué conceptos nuevos merecen una spec aparte**.

---

## 2. Lo que **ya está alineado** (no requiere cambios)

| Concepto del PDF                                                                                                  | Módulo en ControlObra                                                                          | Spec/archivo                                                                      |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Crear nuevo proyecto (modal)                                                                                      | `project-form.tsx` (2 cols, \* obligatorios, estado Planificación)                             | `bug-proyectos-no-crea.md` (fix) + arquitectura                                   |
| Crear proveedor (Natural/Jurídica, NIT, contacto, email, tel, web)                                                | `provider-form.tsx`                                                                            | `unique-provider-nit.md`                                                          |
| Cargar presupuesto desde Excel (3 pasos)                                                                          | `/tecnico/presupuestos/cargar`                                                                 | `bug-presupuestos-round.md` (fix)                                                 |
| Versión de presupuesto (Tope) sin perder anterior                                                                 | `budgets` API + versionado interno                                                             | tabla `budgets` + columna `version`                                               |
| Vincular PT con PSC (espejo)                                                                                      | `pscs/` + `psc-form.tsx`                                                                       | arquitectura                                                                      |
| Crear PSC (Proyecto + Contratista + Estado + Fecha + Notas + Ítems del PT)                                        | `psc-form.tsx`                                                                                 | arquitectura                                                                      |
| Crear corte de obra (Período, descripción, proveedor, retención %, anticipo, ítems con unidad/cant/vr unit/total) | `cut-form.tsx` (retentionPercent + advanceDeduction + items + total ejecutado / valor a pagar) | `cuts-workflow.ts`                                                                |
| Workflow de corte DRAFT→SUBMITTED→VALIDATED→APPROVED→PAID con REJECT                                              | `cuts-workflow.ts` (`CUT_TRANSITIONS`)                                                         | `workcut-reject-transition-validation.md`, `workcut-rejection-reason-required.md` |
| Pagos con 1 o 2 niveles de aprobación                                                                             | `payments-workflow.ts` (`resolvePaymentTarget` + `isValidApprovalLevel`)                       | `one-level-payment-approval.md`                                                   |
| AIU: Administración + Imprevistos + Utilidad (suma 100%) + IVA 19%                                                | `aiu-constants.ts` (`validateAiu`)                                                             | arquitectura                                                                      |
| Dashboard de PSC con Total / Activos / Total contratado / % Ejecutado                                             | `pscs/` page (KPIs)                                                                            | `dashboard-stats-from-stores.md` (hook)                                           |

> **Conclusión del bloque:** el grueso del PDF (mockups + flujo) **ya tiene
> equivalente** en la app. No se rompe nada.

---

## 3. Lo que **hay que ajustar** (sin romper specs/workflows)

### 3.1 Cotización: capturar "Condiciones comerciales" (no romper `budgets`)

**Origen:** PDF pág. 1 (Cotización Marzo Triangular → Producomex).

La cotización inicial trae un bloque de **condiciones comerciales** que hoy
**no se persisten** en el PT (`budgets`):

- **Forma de Pago:** `50% anticipo / 40% cortes / 10% contra entrega`
  (o cualquier otra distribución porcentual).
- **Tiempo de Entrega:** `45 días calendario` desde la orden de compra.
- **Validez de la Oferta:** `30 días calendario`.
- **Asesor / responsable comercial:** `Julia Naranjo — Gerente de Proyectos — tel 3203001000`.

**Acción propuesta — extender `Budget` (tabla `budgets` ya existente):**

- **NO crear** `quotations` como entidad nueva (sería duplicar el PT).
- **SÍ** añadir columnas a `budgets`:
  - `payment_terms_json` (JSON con `anticipo_pct`, `cortes_pct`, `contra_entrega_pct`)
  - `delivery_days` (int, default 0)
  - `offer_validity_days` (int, default 30)
  - `commercial_advisor_name`, `commercial_advisor_role`, `commercial_advisor_phone`, `commercial_advisor_email`
- Migración: `database/mysql/migrations/004_budget_commercial_terms.sql`
- Type: extender `Budget` en `src/types/index.ts` (campos opcionales).
- `CutForm` y `PaymentForm` ya leen del PT — no se tocan.
- `aiu-configs` ya valida suma 100% — no se toca.

**Por qué no rompe nada:** los nuevos campos son **opcionales** y hacia atrás.
Los budgets existentes quedan con `payment_terms_json = NULL` y siguen
funcionando. Los cortes/pagos no dependen de estos campos.

### 3.2 "Control de Cambios" con incrementos/reducciones y motivo (nueva entidad)

**Origen:** PDF pág. 2 (Cotización Control de Cambios 001).

El cliente muestra un **addendum a la cotización** donde:

- Aparece un campo **"Marque con una X el medio por el cual se realizó la
  solicitud"** con 4 opciones:
  - Acta Comité
  - Mail
  - **Solicitud Verbal** ← marcado
  - Otros (cuál?)
- Las **incrementos/reducciones** se muestran en **rojo con paréntesis**
  y en una columna de **% de variación** respecto a la versión anterior.
- Al final: `TOTAL COSTOS DIRECTOS → ADMINISTRACIÓN 8% → IMPREVISTOS 5% → UTILIDAD 5% → IVA 19% → TOTAL OBRA`.

Hoy el sistema solo versiona el PT (v0, v1, v2...) pero **no guarda la
diferencia** ni el **motivo** del cambio. Esto es lo más importante que
falta capturar, y se justifica con una **spec nueva aparte** (no entra en
esta gap-analysis para no mezclar alcance):

- Spec candidata: `docs/specs/budget-change-control.md`
- Entidad: `budget_revisions` (FK a `budgets`, `version`, `motivo`,
  `motivo_otro_detalle`, `diff_json`, `created_by`, `created_at`).
- Workflow: `DRAFT → SUBMITTED → APPROVED → MERGED` (mergea al PT vigente).
- Cálculo: `diff_json` con incrementos/reducciones por ítem = `vr_total_v(n) − vr_total_v(n-1)`.
- UI: una pestaña "Revisiones" en `/tecnico/presupuestos/[id]` con
  comparativo lado-a-lado v(n-1) vs v(n) y el motivo seleccionado.

> **Acción inmediata en esta spec:** **NO** implementar todavía. Queda
> como **out-of-scope aquí** y como spec candidata a redactar con su
> propio verifier antes de tocar código.

### 3.3 Contrato: modalidad "Valor Unitario Fijo" / "Todo Costo"

**Origen:** PDF pág. 5 (Contrato 000002025-0703, "Modalidad Valor Unitario
Fijo" / "OBRA CIVIL TODO COSTO").

`ContractForm` ya maneja `type: OBRA | SUMINISTRO | SERVICIOS | CONSULTORIA`,
valor, fechas, retención, anticipo. **Falta** una etiqueta explícita de
**modalidad de contratación** que el cliente quiere ver:

- `PRECIOS_UNITARIOS` (la app cobra por cantidades ejecutadas a precio
  unitario preestablecido — es el caso del PDF).
- `SUMA_ALZADA` (precio global fijo, llave en mano / todo costo).
- `ADMINISTRACION_DELEGADA` (pago por honorarios + reembolso).

**Acción propuesta — extensión de `Contract`:**

- Añadir campo `pricingMode: "UNIT_PRICE" | "LUMP_SUM" | "COST_PLUS"`
  en `src/types/index.ts` (default `UNIT_PRICE`).
- Migración: `004_contract_pricing_mode.sql` (nullable para no romper
  contratos existentes).
- Mostrar la modalidad en `contract-form.tsx` y en la tabla/listado de
  `/tecnico/contratos`.

**Por qué no rompe nada:** campo nuevo, opcional, con default razonable.
No toca `cuts-workflow.ts` ni `payments-workflow.ts`.

### 3.4 Contrato: datos completos del contratista ya visibles

**Origen:** PDF pág. 5 (rep. legal, NIT/CC, dirección, email, tel del
contratista en la cabecera del contrato).

Hoy el `ContractForm` solo guarda `providerId` y el resto de los datos
se leen del `Provider` cuando se renderiza. **Verificar** que el listado
de `/tecnico/contratos/[id]` muestre:

- Razón social o nombre del contratista.
- NIT o Cédula.
- Representante legal (si es Jurídica).
- Email y teléfono principal.

**Acción:** auditar `src/app/tecnico/contratos/[id]/page.tsx` y, si falta,
mostrar esos datos (vienen del `Provider` ya cargado, sin schema nuevo).

> Si la auditoría detecta que **no se renderiza** alguno de esos campos,
> el fix entra como **bug-spec** siguiendo `bug-proyectos-no-crea.md` como
> plantilla, no en esta spec.

### 3.5 Capturas del PDF: no son "specs", son confirmación visual

Las imágenes del PDF que son mockups (`Crear nuevo proyecto`, `Crear
proveedor`, `Cargar presupuesto desde Excel`, `Crear PSC`, `Crear corte
de obra`) **no generan trabajo nuevo**: confirman que los formularios
existentes van por buen camino. Lo único que vale la pena comparar
visualmente es la **disposición a 2 columnas, los asteriscos rojos, los
íconos de calendario y el patrón de modal con overlay** — todo eso ya
está en `src/components/ui/` (shadcn/ui).

---

## 4. Lo que **no aplica** (y por qué)

- **"Orden de Compra" con formato Oracle-EBS de Carvajal** (PDF pág. 3):
  la OC #75287529 / #75288953 es un documento del **ERP del cliente
  (Carvajal)** que le llega al contratista (Marzo Triangular). No es un
  documento que el cliente quiera **emitir** desde ControlObra. ControlObra
  está del lado del **contratista** (Marzo Triangular) gestionando
  proyectos, presupuestos, contratos, cortes y pagos. **No se modela OC
  como entidad.** Si en el futuro se requiere **recibir OCs del cliente**
  (importar PDF/Excel), se haría como una spec aparte de "importación de
  documentos externos" — fuera de este alcance.

- **"ADECUACION OFICINAS ALVARO CASTRO/CLO-153"**: es un código interno
  del cliente (Carvajal/Producomex). No se replica en ControlObra.

- **Los logos y membretes** del PDF (Producomex, Marzo Triangular) son
  identidad corporativa del cliente. El branding de ControlObra es
  propio; no se cambian logos de la app.

- **Campos en MAYÚSCULAS, líneas de color naranja, marca de agua "Página
  2"** del PDF: son del formato de salida de **Excel del cliente**, no
  del UI web. ControlObra usa su propio layout (shadcn/ui + Tailwind).

---

## 5. Resumen ejecutivo

| #   | Concepto del cliente                               | Acción                                      | Spec                                  | Riesgo de romper                                   |
| --- | -------------------------------------------------- | ------------------------------------------- | ------------------------------------- | -------------------------------------------------- |
| 1   | Condiciones comerciales en cotización              | Extender `budgets` con campos opcionales    | Esta spec (§3.1)                      | **Bajo** (campos nuevos opcionales)                |
| 2   | Control de cambios con incrementos/reducciones y motivo              | **Spec aparte**, no se implementa aquí      | Candidata: `budget-change-control.md` | **Alto** si se hace mal — necesita su propio flujo |
| 3   | Modalidad "Valor Unitario Fijo" en contrato        | Añadir `pricingMode` opcional en `Contract` | Esta spec (§3.3)                      | **Bajo**                                           |
| 4   | Datos del contratista visibles en contrato         | Auditar página de detalle; fix si falta     | Bug-spec aparte si aplica             | **Bajo**                                           |
| 5   | Mockups del PDF (Crear proyecto, PSC, corte, etc.) | **Ya existen** los formularios              | —                                     | Ninguno                                            |
| 6   | OC formato Oracle-EBS                              | **No aplica** (es del ERP del cliente)      | —                                     | Ninguno                                            |

---

## 6. Plan de ejecución (después de aprobar esta spec)

1. **Aprobar esta spec** (o pedir cambios) antes de tocar código.
2. Implementar §3.1 (campos comerciales en `budgets`):
   - Crear migración `004_budget_commercial_terms.sql`.
   - Extender `Budget` en `src/types/index.ts`.
   - Actualizar `project-form`-equivalente de presupuestos y la API
     `src/app/api/budgets/route.ts` para aceptar/retornar los nuevos campos.
   - Escribir **verifier** en `tests/verifiers/budget-commercial-terms.spec.ts`
     cubriendo AC de la §3.1 (red → green).
3. Implementar §3.3 (modalidad en `Contract`):
   - Crear migración `004_contract_pricing_mode.sql`.
   - Extender `Contract` y `contract-form.tsx`.
   - Verifier `tests/verifiers/contract-pricing-mode.spec.ts`.
4. **Pausar y revisar** antes de la spec candidata §3.2 (Control de
   Cambios), que merece su propio análisis por el riesgo de romper el
   workflow de presupuestos.

---

## 7. Out of Scope (de esta spec)

- Crear entidad `quotations` (sería duplicar `budgets`).
- Crear entidad `purchase_orders` (la OC del PDF es externa a ControlObra).
- Cambiar el branding o la paleta visual de la app.
- Implementar el "Control de Cambios" con incrementos/reducciones (queda como spec candidata
  con su propio TDD).
- Modificar `cuts-workflow.ts` o `payments-workflow.ts`.

---

## 8. Approval

**Status:** ✅ Aprobada el 2026-09-29 (§3.1 y §3.3 implementadas). §3.2 →
`budget-change-control.md` (pendiente de aprobación). §3.4 → audit pendiente.
