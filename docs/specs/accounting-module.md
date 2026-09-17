# Feature: Módulo de Contabilidad

Adapta el flujo del artefacto "Contabilidad visual MT CORE" (Panel / Ingresos /
Gastos / Cuentas / Impuestos / Metas) a la arquitectura de ControlObra
(Next.js 14 + MySQL + Zustand + shadcn/ui).

## 1. User Story
**As a** usuario de Contabilidad/Tesorería del área administrativa,
**I want to** registrar ingresos, gastos, cuentas bancarias, movimientos de
impuestos y metas mensuales con un flujo de estados controlado,
**So that** pueda ver en un panel el balance real de la empresa y de cada
proyecto (centro de costo) sin salir de ControlObra.

---

## 2. Acceptance Criteria

### Alcance / entidad
- [ ] AC-1: Todo registro contable puede asociarse a un **proyecto** (centro de
      costo de obra) o quedar a nivel **General** (`projectId = null`).
      El panel permite filtrar por proyecto o ver el consolidado.
- [ ] AC-2: El centro de costo (`costCenter`) es texto libre con sugerencias
      tomadas de los valores ya usados y de los nombres de proyecto.

### Ingresos
- [ ] AC-3: Un ingreso tiene fecha, creador, centro de costo, cliente, factura,
      valor, impuestos y estado (`POR_PAGAR` | `PAGADO`).
- [ ] AC-4: `valorFinal = valor − impuestos` y nunca es negativo (los impuestos
      no pueden superar el valor).
- [ ] AC-5: Para pasar a `PAGADO` se exige `accountId` y `paidAmount > 0`;
      `paidAmount` no puede superar el valor final. Si no se envía
      `paidAmount`, se asume el valor final.

### Gastos
- [ ] AC-6: Un gasto tiene fecha, responsable, centro de costo, proveedor,
      concepto, detalle, valor y estado
      (`POR_PAGAR` | `APROBADO` | `URGENTE` | `NO_PAGAR` | `RETEGARANTIA` | `PAGADO`).
- [ ] AC-7: Workflow de estados (server-side, no solo UI):
      - `POR_PAGAR` → `APROBADO`, `URGENTE`, `NO_PAGAR`, `RETEGARANTIA`
      - `URGENTE`  → `APROBADO`, `NO_PAGAR`, `RETEGARANTIA`
      - `APROBADO` → `PAGADO`, `URGENTE`, `NO_PAGAR`, `RETEGARANTIA`
      - `RETEGARANTIA` → `APROBADO`, `PAGADO`, `NO_PAGAR` (liberación de garantía)
      - `NO_PAGAR` → `POR_PAGAR` (reapertura)
      - `PAGADO` es **terminal**: no admite ninguna transición.
- [ ] AC-8: Un gasto solo llega a `PAGADO` con `accountId` definido.
- [ ] AC-9: Solo se pueden eliminar gastos que no estén `PAGADO`.

### Cuentas
- [ ] AC-10: Una cuenta tiene nombre, tipo (Corriente, Ahorros, Tarjeta de
      Crédito, Efectivo, PayPal, Otra), **saldo inicial** y notas.
- [ ] AC-11: El saldo actual **no se almacena**: se calcula como
      `saldoInicial + Σ ingresos PAGADOS − Σ gastos PAGADOS − Σ impuestos PAGADOS`
      imputados a esa cuenta. Así nunca se desincroniza con los movimientos.
- [ ] AC-12: No se puede eliminar una cuenta con movimientos asociados.

### Impuestos (movimientos, no tarifas)
- [ ] AC-13: Un movimiento de impuesto tiene fecha, entidad (DIAN, alcaldía…),
      descripción, valor y estado (`DECLARADO` | `PAGADO`).
      Es distinto de `/administrativo/impuestos` (catálogo de tasas).
- [ ] AC-14: `DECLARADO` → `PAGADO` exige `accountId`. `PAGADO` es terminal.

### Panel
- [ ] AC-15: KPIs = ingresos totales, gastos operativos, impuestos del **año en
      curso**, gastos totales (operativos + impuestos), balance
      (`ingresos − gastos − impuestos`) y margen (`balance / ingresos * 100`,
      `0` si no hay ingresos).
- [ ] AC-16: Agrupaciones ordenadas de mayor a menor: ingresos por cliente,
      ingresos por centro de costo, gastos por proveedor, gastos por centro de
      costo; y serie mensual `YYYY-MM` de ingresos vs gastos ascendente.
- [ ] AC-17: Exportación del reporte completo a CSV (Excel-compatible, UTF-8
      con BOM) con secciones Resumen / Ingresos / Gastos / Cuentas / Impuestos.

### Metas
- [ ] AC-18: Por alcance (proyecto o General) se define meta de ingreso
      mensual, tope de gasto y ahorro mensual; el panel muestra el avance del
      mes en curso en % (tope de gasto: % consumido, alerta si supera 100%).

### Seguridad
- [ ] AC-19: Lectura: cualquier usuario autenticado. Escritura: `ADMIN`,
      `GERENTE`, `DIRECTOR`, `CONTABILIDAD`, `TESORERIA`. Borrado: `ADMIN`.

---

## 3. Edge Cases
### Error States
- API caída → el store guarda `error` y la página muestra el mensaje; no se
  pierde el cache previo.
- Transición inválida (ej. `PAGADO` → `POR_PAGAR`) → HTTP 400 con motivo.
- `PAGADO` sin cuenta → HTTP 400 "Debe indicar la cuenta de pago".

### Empty States
- Sin registros → tarjeta punteada "No hay …" con CTA de creación.
- Sin cuentas → los formularios de pago avisan que primero debe crearse una cuenta.

### Loading States
- `loading` del store → skeleton/spinner; los KPIs muestran `0` hasta `loaded`.

---

## 4. Technical Contract

```typescript
export type AccountingIncomeStatus = "POR_PAGAR" | "PAGADO";
export type AccountingExpenseStatus =
  | "POR_PAGAR" | "APROBADO" | "URGENTE" | "NO_PAGAR" | "RETEGARANTIA" | "PAGADO";
export type AccountingTaxStatus = "DECLARADO" | "PAGADO";
export type AccountingAccountType =
  | "CORRIENTE" | "AHORROS" | "TARJETA_CREDITO" | "EFECTIVO" | "PAYPAL" | "OTRA";

export interface AccountingAccount {
  id: string; name: string; type: AccountingAccountType;
  openingBalance: number; notes?: string; isActive: boolean; createdAt: string;
}
export interface AccountingIncome {
  id: string; date: string; projectId?: string | null; costCenter: string;
  creator: string; clientName: string; invoice: string;
  amount: number; taxes: number; status: AccountingIncomeStatus;
  accountId?: string | null; paidAmount?: number | null; createdAt: string;
}
export interface AccountingExpense {
  id: string; date: string; projectId?: string | null; costCenter: string;
  responsible: string; providerName: string; concept: string; detail?: string;
  amount: number; status: AccountingExpenseStatus;
  accountId?: string | null; createdAt: string;
}
export interface AccountingTaxMovement {
  id: string; date: string; projectId?: string | null; authority: string;
  description: string; amount: number; status: AccountingTaxStatus;
  accountId?: string | null; createdAt: string;
}
export interface AccountingGoal {
  id: string; projectId?: string | null;
  monthlyIncome: number; maxExpense: number; monthlySavings: number;
}
```

### API Contract
| Método | Ruta | Descripción |
|---|---|---|
| GET/POST/PUT/DELETE | `/api/accounting/accounts` | Cuentas |
| GET/POST/PUT/DELETE | `/api/accounting/incomes` | Ingresos |
| GET/POST/PUT/DELETE | `/api/accounting/expenses` | Gastos |
| GET/POST/PUT/DELETE | `/api/accounting/tax-movements` | Movimientos de impuestos |
| GET/PUT | `/api/accounting/goals` | Metas por alcance |

`GET` acepta `?projectId=` (`general` = solo registros sin proyecto).

### Dependencias modificadas
- `src/types/index.ts` (tipos nuevos)
- `src/lib/data-store.ts` (colecciones + hooks `useAccounting*Store`)
- `src/lib/navigation.ts` (item "Contabilidad" en el área administrativa)
- `database/mysql/migrations/003_accounting.sql` (5 tablas nuevas)
