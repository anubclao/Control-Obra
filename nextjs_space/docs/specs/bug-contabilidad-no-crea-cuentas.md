# Bug: Contabilidad no permite crear empresa ni subir bases en cada pestaña

## 1. User Story

**As a** usuario de Contabilidad / Tesorería que abre por primera vez el
módulo `/administrativo/contabilidad`,
**I want to** ver un botón claro de "Crear primera cuenta" (o equivalente)
en cada pestaña vacía y poder registrar la primera cuenta bancaria sin
tener que entender el modelo de alcance (proyecto/General/consolidado),
**So that** el módulo sea operable desde el primer ingreso y no parezca
"muerto" hasta que alguien descubra el flujo manualmente.

## 2. Acceptance Criteria

### Estado inicial

- [ ] AC-1: La pestaña **Cuentas** muestra un CTA principal "Crear
      primera cuenta" cuando `accounts.length === 0` (no solo el botón
      pequeño en la esquina).
- [ ] AC-2: La pestaña **Ingresos** muestra un CTA "Registrar primer
      ingreso" cuando `incomes.length === 0` para el alcance activo.
- [ ] AC-3: La pestaña **Gastos** muestra un CTA "Registrar primer gasto"
      análogo.
- [ ] AC-4: La pestaña **Impuestos** muestra un CTA "Registrar primer
      movimiento".
- [ ] AC-5: La pestaña **Metas** muestra un CTA "Configurar primera meta".

### Alcance (proyecto / General / Consolidado)

- [ ] AC-6: El selector de alcance aparece **visible por defecto** con
      las 3 opciones (Consolidado, General, [proyectos]) aunque la lista
      de proyectos aún no haya cargado. Si no hay proyectos, el select
      debe seguir mostrando "Consolidado" y "General".
- [ ] AC-7: Cuando el usuario crea un ingreso/gasto desde la pestaña
      Cuentas (o viceversa), el nuevo registro aparece en la pestaña
      correspondiente tras refrescar la página, sin tener que cambiar
      manualmente de pestaña.

### Manejo de errores

- [ ] AC-8: Si la API responde con error (ej. cuenta con movimientos),
      el `<Alert>` superior muestra el mensaje del backend.
- [ ] AC-9: El botón "Guardar" del modal de cuenta se deshabilita
      mientras la llamada está en curso y vuelve a habilitarse al
      terminar (éxito o error).

## 3. Edge Cases

- Usuario sin proyectos creados (cuenta nueva en el sistema) → debe
  poder crear una cuenta General sin necesidad de seleccionar proyecto.
- Sesión expirada durante la creación → mostrar "Sesión expirada, vuelve
  a iniciar sesión" en el Alert, no un error genérico 500.

## 4. Technical Contract

```tsx
// EmptyState de cuentas
{accounts.length === 0 ? (
  <EmptyState
    icon={Landmark}
    title="Aún no tienes cuentas"
    description="Crea una cuenta para empezar a registrar ingresos, gastos y pagos."
    actionLabel="Crear primera cuenta"
    onAction={() => setCreateOpen(true)}
  />
) : (
  // grid actual
)}
```

## 5. Dependencias modificadas

- [src/components/accounting/accounting-accounts.tsx](nextjs_space/src/components/accounting/accounting-accounts.tsx)
  — reemplazar el `EmptyState` simple por uno con `actionLabel` + `onAction`.
- [src/components/accounting/accounting-incomes.tsx](nextjs_space/src/components/accounting/accounting-incomes.tsx)
  — mismo patrón.
- [src/components/accounting/accounting-expenses.tsx](nextjs_space/src/components/accounting/accounting-expenses.tsx)
  — mismo patrón.
- [src/components/accounting/accounting-taxes.tsx](nextjs_space/src/components/accounting/accounting-taxes.tsx)
  — mismo patrón.
- [src/components/accounting/accounting-goals.tsx](nextjs_space/src/components/accounting/accounting-goals.tsx)
  — mismo patrón.
- [src/components/accounting/accounting-shared.tsx](nextjs_space/src/components/accounting/accounting-shared.tsx)
  — extender `EmptyState` con `actionLabel` y `onAction`.
