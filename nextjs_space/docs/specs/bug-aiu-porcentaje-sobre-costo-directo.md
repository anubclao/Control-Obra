# Bug: el AIU exigía "A + I + U = 100 %" en vez de % sobre costo directo

> **Estado:** ✅ Aprobada el 2026-09-30 (pregunta 4 de `budget-change-control.md`).
> Verifier: `nextjs_space/tests/verifiers/aiu-direct-cost.spec.ts`.

## 1. User Story

**As a** Director de obra,
**I want to** configurar el AIU como lo hace el cliente (ej. A 8 %, I 5 %, U 5 %
sobre el costo directo, con IVA 19 % sobre la utilidad),
**So that** la liquidación de la app coincida con las cotizaciones reales.

## 2. Causa raíz

- `validateAiu`, `POST /api/aiu-configs` y el CHECK `chk_aiu_sum` de la BD
  exigían que A + I + U sumara 100 %.
- Sin embargo, la app ya calculaba cada componente como `% × costo directo`.
  Resultado: el AIU real del cliente (18 %) no se podía guardar, y un AIU que sí
  pasaba la validación (ej. 10/45/45) sumaba el 100 % del costo directo.
- No existía el IVA sobre la utilidad.

## 3. Acceptance Criteria

- [x] AC-1: `validateAiu(a, i, u)` acepta cada componente entre 0 y 100
      (inclusive). Rechaza negativos, valores no numéricos, más de 100 por
      componente y un AIU total mayor de 100 %.
- [x] AC-2: `computeAiu(costoDirecto, aiu)` devuelve `administration`,
      `imprevistos`, `utilidad`, `iva` (= 19 % × utilidad) y `total`
      (= CD + A + I + U + IVA). Cada componente se redondea a 2 decimales y el
      total se calcula sin redondear y se redondea al final. Con CD =
      30.732.844,34 y 8/5/5 → 2.458.627,55 / 1.536.642,22 / 1.536.642,22 /
      291.962,02 / **36.556.718,34** (PDF del cliente, pág. 3).
- [x] AC-3: `POST` y `PUT /api/aiu-configs` validan con `validateAiu` (en `PUT`,
      con los valores guardados + los del body). `updated_by` sale de la sesión.
- [x] AC-4: La migración `008_aiu_percent_over_direct_cost.sql` elimina
      `chk_aiu_sum` y agrega `chk_aiu_range` (0–100 por componente).
- [x] AC-5: La UI (formulario AIU, pestaña AIU del presupuesto, resumen
      `/tecnico/aiu`) deja de hablar de "suma 100 %" y muestra IVA y total obra.

## 4. ⚠️ Nota de despliegue

Los proyectos que se configuraron con la regla vieja (ej. 10/45/45, 33/33/33)
ahora calcularían un AIU de ~100 %. Revisar y reconfigurar:

```sql
SELECT project_id, administration, imprevistos, utilidad
  FROM aiu_configs WHERE administration + imprevistos + utilidad > 40;
```
