# Feature: One-Level Payment Approval

## 1. User Story

**As a** usuario que crea una solicitud de pago con `requiredApprovalLevel: 1`
**I want to** que la solicitud pase a estado `APPROVED` después de la primera aprobación L1, sin necesidad de una segunda aprobación que no existe
**So that** el flujo de aprobación de un solo nivel funcione correctamente y Tesorería pueda ejecutar el pago.

---

## 2. Acceptance Criteria

### AC-1: Solicitud con 1 nivel pasa de PENDING → APPROVED en una sola aprobación

- Crear solicitud con `requiredApprovalLevel: 1`
- Usuario con rol `DIRECTOR` ejecuta `APPROVE_L1`
- Estado resultante: `APPROVED` (no `APPROVED_LEVEL_1` que es terminal)
- `currentApprovalLevel` queda en `1`
- `approvals[]` contiene un único registro con `action: "APPROVE_L1"`

### AC-2: Solicitud con 2 niveles mantiene comportamiento actual

- Crear solicitud con `requiredApprovalLevel: 2`
- `APPROVE_L1` → `APPROVED_LEVEL_1` (no terminal)
- `APPROVE_L2` → `APPROVED` (terminal)
- Esto es el comportamiento actual y NO debe cambiar

### AC-3: getAvailablePaymentActions muestra "Pagar" para status APPROVED de 1 nivel

- Para `status === "APPROVED"` con cualquier `requiredApprovalLevel` (1 o 2)
- Usuario con rol `TESORERIA` debe ver el botón "Marcar como pagado"
- Verificación: `getAvailablePaymentActions(payment, "TESORERIA")` debe incluir `{ action: "PAY", ... }`

### AC-4: Botón "Aprobar nivel 2" NO debe aparecer en solicitudes de 1 nivel

- Para `status === "APPROVED_LEVEL_1"` pero `requiredApprovalLevel === 1` (estado inválido en runtime)
- Aunque el bug actual no debería permitir llegar a `APPROVED_LEVEL_1` con 1 nivel, el sistema defensivo debe estar cubierto

---

## 3. Edge Cases

### Error States

- Crear solicitud con `requiredApprovalLevel: 0` o `4` → `addPayment` debe rechazar
- `APPROVE_L1` en solicitud con `currentApprovalLevel !== 0` → error (ya validado)

### Empty States

- No aplica (el estado APPROVED siempre debe llevar a PAY)

### Loading States

- No aplica (síncrono)

---

## 4. Technical Contract

### Cambios en `payments-store.ts`

```typescript
// En performAction, dentro del bloque APPROVE_L1:
if (action === "APPROVE_L1") {
  // Si solo requiere 1 nivel, va directamente a APPROVED
  if (payment.requiredApprovalLevel === 1) {
    updates.status = "APPROVED";
    updates.currentApprovalLevel = 1;
  } else {
    updates.status = "APPROVED_LEVEL_1";
    updates.currentApprovalLevel = 1;
  }
}
```

### Type Contract

- `PaymentStatus` ya incluye `APPROVED` y `APPROVED_LEVEL_1` — no se necesitan cambios
- `requiredApprovalLevel: 1 | 2` (3 fue removido de la UI pero el tipo lo permite; restringir a 1 o 2 en el form)

---

## 5. Dependencies

### Files to Modify

- `/nextjs_space/src/lib/payments-store.ts` — Lógica de `performAction`
- (opcional) `/nextjs_space/src/components/payments/payment-form.tsx` — Remover opción de 3 niveles

### Files to Create

- `/tests/verifiers/one-level-payment-approval.spec.ts` — Verifier

---

## 6. Out of Scope

- Implementar 3 niveles de aprobación (futuro)
- Notificaciones automáticas al aprobar (futuro)
- Reasignación de solicitudes entre aprobadores (futuro)

---

## 7. Approval

**Status:** ⏳ Pending Review
