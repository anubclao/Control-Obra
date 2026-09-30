# Bug: cortes y pagos confían en el cliente (rol, totales y estado)

> **Estado:** ✅ Implementada el 2026-09-30. Verifier:
> `nextjs_space/tests/verifiers/cuts-payments-integrity.spec.ts`.

## 1. User Story

**As a** Gerente / Tesorería,
**I want to** que el valor a pagar de un corte y quién lo aprobó salgan del
servidor y no de lo que mande el navegador,
**So that** nadie pueda aprobar/pagar sin permiso ni inflar el neto de un corte.

## 2. Causa raíz

| Ruta | Problema |
| --- | --- |
| `PATCH /api/cuts` y `PATCH /api/payments` (acciones de workflow) | Sin `requireAuth`. El rol salía de `body.user.role`: cualquiera, sin sesión, podía enviar `{ action: "PAY", user: { role: "ADMIN" } }`. |
| `POST/PUT /api/cuts` | `grossValue`, `retentionValue`, `netValue` y `totalPrice` se guardaban tal cual venían del navegador. |
| `PUT /api/cuts` | Aceptaba `status` y `rejectionReason` → se saltaba el workflow (`DRAFT → APPROVED` directo). |
| `PUT /api/cuts` / `PUT /api/payments` | Permitían editar cortes aprobados/pagados y pagos ya aprobados, aunque la UI solo muestra "Editar" en DRAFT/REJECTED (cortes) y PENDING (pagos). |
| `GET /api/projects` | Sin `requireAuth` (el resto de GETs sí lo exigen). |

## 3. Acceptance Criteria

- [x] AC-1: `PATCH /api/cuts` y `PATCH /api/payments` sin sesión → **401**.
- [x] AC-2: En las acciones de workflow el rol, id y nombre salen de la
      sesión; `body.user` se ignora (un RESIDENTE que manda `role: "ADMIN"`
      recibe 403).
- [x] AC-3: `computeCutTotals` (en `lib/cuts-workflow.ts`) es la única
      fórmula: `totalPrice = cantidad × vr unitario`, `bruto = Σ totalPrice`,
      `retención = round(bruto × % / 100)`, `neto = bruto − retención − anticipo`.
      La usan el formulario y la API.
- [x] AC-4: `POST /api/cuts` guarda los totales calculados en el servidor,
      ignorando `grossValue`/`retentionValue`/`netValue`/`totalPrice` del body.
- [x] AC-5: `PUT /api/cuts` recalcula los totales si cambian ítems, % de
      retención o anticipo; nunca acepta `status`, `rejectionReason` ni totales
      del body.
- [x] AC-6: `PUT /api/cuts` sobre un corte que no está en DRAFT/REJECTED → **409**.
      `PUT /api/payments` sobre un pago que no está en PENDING → **409**.
- [x] AC-7: `created_by` de cortes y pagos se toma de la sesión.
- [x] AC-8: `GET /api/projects` sin sesión → **401**.

## 4. Out of Scope

- Validar que el anticipo descontado no supere el anticipo pendiente del contrato.
- Rehacer el cálculo de los cortes ya guardados (ver nota de despliegue abajo).

## 5. Nota de despliegue

Los cortes existentes conservan los valores que tienen. Para detectar si
alguno no cuadra:

```sql
SELECT c.id, c.cut_number, c.gross_value, SUM(i.quantity * i.unit_price) AS gross_calc
  FROM work_cuts c JOIN work_cut_items i ON i.work_cut_id = c.id
 GROUP BY c.id HAVING ABS(c.gross_value - gross_calc) > 1;
```
