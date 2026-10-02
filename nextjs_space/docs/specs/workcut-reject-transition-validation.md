# Feature: WorkCut REJECT Transition Validation

## 1. User Story

**As a** residente o director de obra
**I want to** que la regla de transición `REJECT` se aplique correctamente: solo se puede rechazar un corte que ya fue enviado (SUBMITTED) o validado (VALIDATED)
**So that** no se rechacen cortes en DRAFT (que no han salido del residente) ni en estados terminales (APPROVED, PAID).

---

## 2. Acceptance Criteria

### AC-1: REJECT no debe funcionar desde DRAFT

- Corte en `DRAFT` → intentar `REJECT` → debe retornar `{ ok: false, error: ... }`
- Solo el residente debe poder "editar/borrar" un DRAFT (no rechazarlo)

### AC-2: REJECT debe funcionar desde SUBMITTED

- Corte en `SUBMITTED` → `REJECT` → estado `REJECTED`
- Si viene con `rejectionReason`, se guarda en el corte
- `approvals[]` contiene el registro con `action: "REJECT"`

### AC-3: REJECT debe funcionar desde VALIDATED

- Corte en `VALIDATED` → `REJECT` → estado `REJECTED`

### AC-4: REJECT no debe funcionar desde APPROVED / PAID

- Corte en `APPROVED` o `PAID` → `REJECT` → error (estado terminal)
- Estos cortes ya están pagados/aprobados, no se pueden rechazar

---

## 3. Edge Cases

- `REJECT` con `rejectionReason` vacío (solo whitespace) → debe ser **obligatorio** (cubierto en spec separada #5)
- El actor debe tener rol válido (`ADMIN` o `DIRECTOR`/`GERENTE`)

---

## 4. Technical Contract

### Cambio en `cuts-store.ts` performAction

```typescript
// ANTES:
if (action !== "REJECT" && !TRANSITIONS[cut.status].includes(targetStatus)) {
  return { ok: false, error: `...` };
}

// DESPUÉS:
if (!TRANSITIONS[cut.status].includes(targetStatus)) {
  return {
    ok: false,
    error: `No se puede pasar de ${cut.status} a ${targetStatus}`,
  };
}
```

### Actualización de `TRANSITIONS`

Mantener:

```typescript
const TRANSITIONS: Record<WorkCutStatus, WorkCutStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["VALIDATED", "REJECTED", "DRAFT"],
  VALIDATED: ["APPROVED", "REJECTED"],
  APPROVED: ["PAID"],
  REJECTED: ["DRAFT"],
  PAID: [],
};
```

Con la validación correcta, `REJECTED` ya NO está en `DRAFT` ni en `APPROVED` ni en `PAID`.

---

## 5. Dependencies

- `nextjs_space/src/lib/cuts-store.ts` — performAction
- `nextjs_space/tests/verifiers/workcut-reject-transition.spec.ts` — nuevo

## 6. Out of Scope

- Validación de `rejectionReason` obligatorio (es spec separada #5)
- Cambios en UI

## 7. Approval

**Status:** ⏳ Pending Review

---

## Estado de implementacion (2026-09-18)

El Technical Contract de arriba apunta a `src/lib/cuts-store.ts`, que **ya no
existe**. La maquina de estados vive hoy en:

- `src/lib/cuts-workflow.ts` — `CUT_TRANSITIONS`, `CUT_ACTION_ROLES`,
  `CUT_ACTION_TARGET`, `isCutTransitionAllowed`, `evaluateCutAction`.
- `src/app/api/cuts/route.ts` — el PATCH delega en `evaluateCutAction`.
- `tests/verifiers/workcut-reject-transition.spec.ts`.

La matriz quedo como la pide el spec: `REJECTED` no es alcanzable desde `DRAFT`,
`APPROVED` ni `PAID`. Los errores traen `code` estable
(`INVALID_TRANSITION`, `FORBIDDEN_ROLE`, ...) para no asertar sobre texto.
