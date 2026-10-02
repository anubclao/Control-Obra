# Bug: El formulario de Proyecto "no crea" proyectos

## 1. User Story

**As a** usuario con rol ADMIN/GERENTE/DIRECTOR/RESIDENTE,
**I want to** llenar el formulario de "Nuevo proyecto", hacer clic en
"Crear proyecto" y ver el proyecto aparecer en la lista (o un mensaje
claro de error si algo falló),
**So that** pueda operar el módulo de proyectos sin tener que recargar
la página o pensar que el sistema "no sirve".

## 2. Acceptance Criteria

### Comportamiento esperado

- [ ] AC-1: Al hacer submit del formulario, el botón se deshabilita y
      muestra "Creando…" hasta que termina la llamada al backend.
- [ ] AC-2: Si la creación es exitosa, el dialog se cierra y el nuevo
      proyecto aparece en la lista sin necesidad de recargar.
- [ ] AC-3: Si la creación falla (ej. código duplicado → 409, error de
      red → 500, validación de Zod → 400), el dialog **NO** se cierra y
      se muestra un mensaje legible con el motivo del error.
- [ ] AC-4: El botón "Cancelar" del formulario cierra el dialog sin
      enviar nada.

### Causa raíz

- [ ] AC-5: La función `onSubmit` debe ser `async`, hacer `await` sobre
      `addProject` / `updateProject`, y solo invocar `onSuccess()` cuando
      la promesa resuelve con un resultado truthy.
- [ ] AC-6: El store debe exponer un flag de error (`useProjectsStore().error`)
      y la UI debe mostrarlo en el formulario.

## 3. Edge Cases

- Doble-click rápido en "Crear proyecto" → solo se crea uno.
- Cerrar el browser antes de que termine la llamada → el backend de todas
  formas crea el proyecto (es una acción de upsert), pero la UI no debe
  mostrar "exitoso" si el response nunca llegó.
- Proyecto nuevo sin descripción → debe guardarse (description es
  opcional en el schema).

## 4. Technical Contract

### Forma del `onSubmit`

```typescript
async function onSubmit(data: ProjectFormData) {
  if (project) {
    const ok = await updateProject(project.id, data);
    if (ok) onSuccess();
  } else {
    const created = await addProject({ ...data });
    if (created) onSuccess();
  }
}
```

### Estado de error en el store

```typescript
// useDataStore ya expone collection.error, pero la UI debe leerlo.
const { addProject, error } = useProjectsStore();
```

## 5. Dependencias modificadas

- [src/components/projects/project-form.tsx](nextjs_space/src/components/projects/project-form.tsx)
  — hacer `onSubmit` async + mostrar `error` del store.
