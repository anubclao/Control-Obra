# Bug: ProjectForm rechaza valores reales de presupuesto y deja label huérfana

## 1. User Story

**As a** residente de obra que crea un proyecto nuevo desde `/tecnico/proyectos`,
**I want to** escribir el valor real del presupuesto total en COP (76.336.339,
1.500.000, 80.000, etc.) y que el navegador lo acepte sin mensajes de "valores
válidos más aproximados", **y** ver el campo "Estado" con su `<label>`
correctamente asociado para lectores de pantalla,
**So that** el alta del proyecto funcione como en producción y no rompa a la
primera entrada de dinero.

## 2. Acceptance Criteria

### Campo Presupuesto total (COP)

- [ ] **AC-1**: El `<Input id="totalBudget" type="number" />` **NO** usa
      `step="1000000"` (ni `10000000`, `5000000`, ni ningún múltiplo de COP
      que supere `1000`). El navegador no debe rechazar valores arbitrarios
      como `76336339`, `999`, `12345` por "valor no múltiplo de step".
- [ ] **AC-2**: El `step` aceptado por la validación HTML5 es `1000` (miles
      de COP, granularidad útil para presupuestos colombianos), `any` o
      ausente — pero nunca un múltiplo que fuerce redondeos al millón.
- [ ] **AC-3**: El schema Zod sigue aceptando `z.coerce.number().min(0)` —
      la corrección del navegador no debe cambiar la regla de negocio:
      cualquier entero ≥ 0 es válido.

### Campo Estado y su label

- [ ] **AC-4**: El `<Label htmlFor="status">` apunta a un elemento del DOM
      con `id="status"`. Hoy apunta al `<Select>` de shadcn/ui, cuyo
      `<SelectTrigger>` no recibe ese id → warning en DevTools:
      `The label's "for" attribute doesn't match any element "id"`.
- [ ] **AC-5**: La solución más limpia es pasar `id="status"` al
      `<SelectTrigger>` (no quitar el htmlFor, porque se quiere accesibilidad).

### No-regresión

- [ ] **AC-6**: Si en el futuro alguien vuelve a poner `step="1000000"` o un
      múltiplo ≥ `10000` en cualquier `<Input>` de monto (no solo
      `totalBudget`), el verifier debe fallar. Esto evita re-incurrir.

## 3. Edge Cases

- Usuario pega `76.336.339` en el campo → debe aceptarlo sin warning.
- Usuario teclea `999` (tres dígitos) → debe aceptarlo.
- Usuario borra y deja el campo vacío → Zod debe tratarlo como 0 o
  mostrar "Debe ser mayor o igual a 0" (sin warning HTML5).
- Usuario hace clic en el label "Estado" → foco debe ir al `<SelectTrigger>`
  (no a otro elemento o a nada).

## 4. Technical Contract

### Props del Input de presupuesto

```tsx
<Input
  id="totalBudget"
  type="number"
  inputMode="numeric"
  min="0"
  step="1000"          // ← antes era "1000000"
  {...register("totalBudget")}
/>
```

### SelectTrigger con id accesible

```tsx
<Label htmlFor="status">Estado *</Label>
<Select value={status} onValueChange={(v) => setValue("status", v as ProjectStatus)} disabled>
  <SelectTrigger id="status" disabled className="opacity-70">
    <SelectValue />
  </SelectTrigger>
  ...
</Select>
```

## 5. Dependencies

### Files to Modify
- `src/components/projects/project-form.tsx` — cambiar `step="1000000"` por
  `step="1000"` en el Input de presupuesto y añadir `id="status"` al
  `<SelectTrigger>`.

### Files to Create
- `tests/verifiers/bug-project-form-currency-step.spec.ts` — verifier que
  cubre AC-1, AC-2, AC-4, AC-5, AC-6.

## 6. Out of Scope

- Cambiar la regla Zod `z.coerce.number().min(0)` — sigue aceptando cualquier
  número ≥ 0 (es la regla de negocio correcta).
- Cambiar la máscara visual de miles (eso es un feature aparte, no un bug).
- Refactorizar el Select a otro componente UI.

## 7. Approval

**Status:** ⏳ Pending Review (auto-aprobado por el usuario al pedir el fix)