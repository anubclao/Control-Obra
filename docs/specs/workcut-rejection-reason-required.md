# Feature: WorkCut REJECT Requires Non-Empty Rejection Reason

## 1. User Story

**As a** director de obra o administrador que rechaza un corte
**I want to** que el sistema exija un `rejectionReason` no vacío
**So that** el residente siempre tenga contexto claro de qué corregir y la trazabilidad de auditoría incluya el motivo real del rechazo.

## 2. Acceptance Criteria

- AC-1: REJECT sin `rejectionReason` → `{ ok: false, error: "Motivo de rechazo obligatorio" }`
- AC-2: REJECT con `rejectionReason` solo whitespace → mismo error
- AC-3: REJECT con `rejectionReason` válido → `{ ok: true }` y se guarda en el corte

## 3. Edge Cases

- `rejectionReason` con 1+ carácter después de trim → válido

## 4. Technical Contract

```typescript
// En performAction, antes de mutar:
if (action === "REJECT" && !rejectionReason?.trim()) {
  return { ok: false, error: "El motivo del rechazo es obligatorio" };
}
```

## 5. Dependencies

- `nextjs_space/src/lib/cuts-store.ts`
- `nextjs_space/tests/verifiers/workcut-rejection-reason.spec.ts` (nuevo)

---

## Estado de implementacion (2026-09-18)

El Technical Contract de arriba apunta a `src/lib/cuts-store.ts`, que **ya no
existe**. La regla vive hoy en `src/lib/cuts-workflow.ts`
(`evaluateCutAction`, codigo `REJECTION_REASON_REQUIRED`), la aplica
`src/app/api/cuts/route.ts` en el PATCH, y la verifica
`tests/verifiers/workcut-rejection-reason.spec.ts`.

La misma regla se aplica a REJECT de pagos, en `src/lib/payments-workflow.ts`.
