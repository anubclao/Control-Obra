# Feature: Dashboard Stats from Stores (Single Source of Truth)

## 1. User Story

**As a** usuario del sistema (cualquier rol)
**I want to** que los KPIs de los dashboards reflejen en tiempo real los cambios que realizo en proyectos, cortes, pagos, cotizaciones y clientes
**So that** la información que veo sea siempre coherente con la realidad operativa del sistema, sin importar si los datos fueron creados, editados o eliminados.

---

## 2. Acceptance Criteria

### AC-1: Los KPIs del dashboard técnico reaccionan a cambios

- El conteo de "Proyectos activos" se calcula desde `useProjectsStore.projects` filtrado por `IN_EXECUTION`
- El "Presupuesto total" y "Total ejecutado" se calculan desde los stores
- Crear, editar o eliminar un proyecto actualiza el dashboard sin necesidad de recargar la página

### AC-2: Los KPIs del dashboard administrativo reflejan cambios en pagos

- "Por pagar" se calcula desde `usePaymentsStore.payments` filtrado por status `PENDING | APPROVED_LEVEL_1 | APPROVED_LEVEL_2`
- "Solicitudes activas" cuenta los mismos estados
- Aprobar, rechazar o pagar una solicitud actualiza el dashboard inmediatamente

### AC-3: Los KPIs del dashboard de ventas reaccionan a clientes y cotizaciones

- "Clientes ganados" se calcula desde `useClientsStore.clients` filtrado por `WON`
- "Cotizaciones abiertas" se calcula desde `useQuotationsStore.quotations` filtrado por `DRAFT | SENT | VIEWED`
- "Valor en pipeline" es la suma de `total` de cotizaciones abiertas

### AC-4: El hook es reutilizable y testeable

- Se exporta `useDashboardStats()` desde `@/lib/dashboard-stats`
- Es un hook de React que devuelve un objeto con todos los KPIs consolidados
- Es puro en el sentido que no tiene efectos secundarios
- Funciona con SSR-safe (no rompe en server components)

### AC-5: Los dashboards existentes se refactorizan para usar el hook

- `nextjs_space/src/app/tecnico/page.tsx` reemplaza el uso de `MOCK_*` y `getDashboardStats()` por `useDashboardStats()`
- `nextjs_space/src/app/administrativo/page.tsx` idem
- `nextjs_space/src/app/ventas/page.tsx` idem

---

## 3. Edge Cases

### Error States

- Si algún store lanza error al leer, el hook debe devolver los KPIs parciales sin crashear
- Si `hydrated === false` en el store (antes de rehidratar), devolver valores en 0

### Empty States

- Sin proyectos: `activeProjects: 0, totalBudget: 0, totalExecuted: 0, executionPercent: 0`
- Sin pagos: `pendingAmount: 0, pendingPayments: 0`
- Sin cotizaciones: `openQuotations: 0, totalOpenValue: 0`

### Loading States

- No hay loading state explícito: el hook siempre devuelve datos del store (que puede ser `MOCK_*` o estado persistido)

---

## 4. Technical Contract

### Hook Signature

```typescript
// /nextjs_space/src/lib/dashboard-stats.ts
import { useProjectsStore } from "./projects-store";
import { useCutsStore } from "./cuts-store";
import { usePaymentsStore } from "./payments-store";
import { useClientsStore } from "./clients-store";
import { useQuotationsStore } from "./quotations-store";

export interface DashboardStats {
  // Técnicos
  activeProjects: number;
  totalBudget: number;
  totalExecuted: number;
  executionPercent: number;
  pendingCuts: number;
  // Administrativos
  pendingPayments: number;
  pendingAmount: number;
  totalExecutedAdmin: number;
  // Comerciales
  activeClients: number;
  openQuotations: number;
  totalOpenValue: number;
}

export function useDashboardStats(): DashboardStats;
```

### Type Contract

- El hook NO debe usar `any`
- El hook debe usar selectores de Zustand individuales para evitar re-renders innecesarios:
  ```typescript
  const projects = useProjectsStore((s) => s.projects);
  ```
- NO usar:
  ```typescript
  const projects = useProjectsStore(); // ❌ re-render en cada cambio del store
  ```

---

## 5. Dependencies

### Files to Create

- `/nextjs_space/src/lib/dashboard-stats.ts` — Hook principal
- `/tests/verifiers/dashboard-stats.spec.ts` — Verifier (test)

### Files to Modify

- `/nextjs_space/src/app/tecnico/page.tsx` — usar `useDashboardStats()` en vez de `getDashboardStats()`
- `/nextjs_space/src/app/administrativo/page.tsx` — idem
- `/nextjs_space/src/app/ventas/page.tsx` — idem

### Files to Deprecate (mantener por compat, marcar deprecated)

- `getDashboardStats()` en `/nextjs_space/src/mocks/index.ts` — quedará sin uso

---

## 6. Out of Scope

- Cache de KPIs (futuro)
- Suscripción realtime a cambios (futuro)
- Dashboard global consolidado (futuro)
- Filtros de período (futuro)

---

## 7. Approval

**Status:** ⏳ Pending Review

---

## Estado de implementacion (2026-09-18)

Los AC-1 a AC-3 estan redactados sobre los stores de localStorage
(`useProjectsStore.projects`, etc.). Esa arquitectura cambio: la fuente unica de
verdad es MySQL y los KPIs se agregan en el servidor. El **proposito** del spec
(un solo lugar que define cada KPI, coherente con la operacion) se mantiene; el
mecanismo es otro:

- `src/lib/dashboard-stats-compute.ts` — `computeDashboardStats` y las
  constantes que definen cada filtro (`PENDING_PAYMENT_STATUSES`,
  `OPEN_QUOTATION_STATUSES`, ...). Funcion pura, server-safe.
- `src/app/api/dashboard/stats/route.ts` — lee la BD y delega la agregacion.
- `src/lib/dashboard-stats.ts` — `useDashboardStats()` (hook cliente, AC-4) y
  re-export de la capa pura.
- `tests/verifiers/dashboard-stats.spec.ts` — cubre los filtros de cada KPI, los
  estados vacios y el contrato del hook.

Los filtros siguen siendo los del spec: proyectos `IN_EXECUTION`; pagos
`PENDING | APPROVED_LEVEL_1 | APPROVED_LEVEL_2`; clientes `WON`; cotizaciones
`DRAFT | SENT | VIEWED`.
