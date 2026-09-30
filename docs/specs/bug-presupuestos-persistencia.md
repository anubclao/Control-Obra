# Bug: el módulo Presupuestos no guarda ni lee capítulos, ítems ni versiones

> **Estado:** ✅ Aprobada el 2026-09-30 ("arregla ambos"). Verifier:
> `nextjs_space/tests/verifiers/budgets-persistence.spec.ts`.

## 1. User Story

**As a** Director / Residente,
**I want to** cargar el PT desde Excel, verlo por capítulos, crear nuevas
versiones y registrar ítems no previstos, y que todo quede en la base de datos,
**So that** el presupuesto sea la base real para PSC, cortes y control de cambios.

## 2. Causa raíz

El commit `bee35f0` ("conectar a MySQL + remover legacy stores") borró
`lib/budgets-store.ts` (localStorage), pero no llevó su lógica a la API:

| Síntoma | Causa |
| --- | --- |
| "Cargar presupuesto desde Excel" falla al confirmar | `useBudgetsStore()` ya no tiene `createPT` ni `hasBudget` (el `as any` lo oculta a `tsc`) |
| "Nueva versión" y "Nuevo ítem no previsto" fallan | Faltan `createNewVersion`, `addUnforeseenItem` y `removeUnforeseenItem` |
| La página de detalle, la lista, los PSC y el reporte financiero se rompen con un PT real | `GET /api/budgets` no devuelve `layers`, `clientLayers`, `versions` ni `unforeseenItems` |
| Las listas de presupuestos salen vacías | Las páginas de presupuestos nunca llaman a `budgets.load()` |
| "Nueva versión" ignora el archivo del usuario | El diálogo carga `SAMPLE_EXCEL_DATA` en vez de pedir un archivo |

El esquema SQL (`budget_layers` con `is_client`, `budget_items`,
`budget_versions`, `budget_unforeseen_items`) ya existía: **no hace falta migración**.

## 3. Acceptance Criteria

Se conserva la semántica del store legacy (`git show bee35f0^:nextjs_space/src/lib/budgets-store.ts`).

- [x] AC-1: `GET /api/budgets` devuelve el `Budget` completo: `versions` (ordenadas),
      `layers` del Tope con sus `items`, `clientLayers` (snapshot del cliente),
      `unforeseenItems`.
- [x] AC-2: `POST /api/budgets { projectId, layers, notes }` crea el PT: versión 1
      activa, capítulos e ítems del Tope, **snapshot idéntico como Presupuesto
      Cliente**, `total_value = client_value = Σ ítems` (calculado en el servidor,
      `totalPrice = cantidad × vr unitario`). Si el proyecto ya tiene PT → **409**
      con el mensaje "usa Nueva versión".
- [x] AC-3: `PATCH /api/budgets { id, action: "NEW_VERSION", layers, notes }`
      reemplaza el Tope, desactiva las versiones anteriores y crea la n+1 activa.
      `total_value = Σ capas nuevas + no previstos vigentes`. El Presupuesto
      Cliente **no cambia**.
- [x] AC-4: `PATCH { action: "ADD_UNFORESEEN", item }` agrega el ítem y suma su
      valor a `unforeseen_value` y a `total_value` (PDF p.5: "aparece automático
      en el tope"). `REMOVE_UNFORESEEN { itemId }` lo quita y resta.
- [x] AC-5: Todo se escribe en una transacción, con bloqueo de fila del budget;
      los roles son los mismos de `POST/PUT` y el total nunca viene del cliente.
- [x] AC-6: `useBudgetsStore()` expone `hasBudget`, `createPT`, `createNewVersion`,
      `addUnforeseenItem` y `removeUnforeseenItem` (async, `{ ok, error }`), que
      llaman a la API y recargan los presupuestos.
- [x] AC-7: Las páginas de presupuestos cargan proyectos, presupuestos y AIU al
      montar; el diálogo "Nueva versión" pide el archivo Excel del usuario.

### Hallazgos de la misma migración incompleta (store)

- [x] AC-8: `col()` guardaba cada colección bajo el nombre del endpoint
      (`"aiu-configs"`, `"work-logs"`) en vez de la propiedad del store
      (`aius`, `workLogs`) → el AIU y la Bitácora nunca mostraban datos. Ahora
      `col(endpoint, stateKey)` recibe la clave explícita.
- [x] AC-9: `useAiuStore()` no tenía `getConfig`, `hasConfig` ni `upsertConfig`
      (los usan `/tecnico/aiu`, `AiuForm` y el detalle del PT) → no se podía
      guardar un AIU. `upsertConfig` crea o actualiza según exista config del
      proyecto y devuelve `{ ok, error }`.

## 4. Decisiones

- **Nueva versión y controles de cambios aprobados:** la nueva versión es la
  nueva línea base del Tope (se asume que el Excel nuevo ya incluye los cambios
  aprobados). El valor Cliente no se toca.
- **Ejecutado:** al reemplazar el Tope, los ítems nuevos arrancan con ejecutado
  0, igual que en el store legacy. Conservar el ejecutado entre versiones
  queda como spec aparte.

## 5. Out of Scope

- Edición manual de ítems del Tope (`updateItem`) y `setClientBudget`
  (el legacy los tenía, pero ninguna pantalla actual los usa).
- Exportar a Excel/PDF (hoy es un `alert` de mock).
