# Feature: Unique NIT Validation in Provider Creation

## 1. User Story

**As a** administrador que registra un nuevo proveedor
**I want to** que el sistema rechace la creación si el NIT/Cédula ya existe en la base de datos
**So that** no haya duplicados de proveedores que compliquen los reportes, los pagos y la trazabilidad documental.

---

## 2. Acceptance Criteria

### AC-1: Validar NIT único al crear proveedor

- Crear proveedor con un NIT ya existente → `addProvider` debe retornar resultado con `ok: false` y mensaje claro
- El NIT debe compararse **case-insensitive** y normalizando espacios/guiones/puntos
- Proveedor existente con NIT `900.111.222-3` → intentar crear otro con `900-111-222-3` o `9001112223` debe fallar

### AC-2: Permitir editar sin chocar consigo mismo

- Editar un proveedor existente (mismo `id`) con su mismo NIT no debe chocar consigo mismo
- Solo se valida contra OTROS proveedores, no el que se está editando
- `updateProvider` no debe validar NIT (porque solo se permite cambiar otros campos; si se cambia NIT debe validarse)

### AC-3: Proveedor con NIT idéntico en mayúsculas/minúsculas es el mismo

- `900.111.222-3` y `900.111.222-3` son idénticos → no se permite duplicado
- `900.111.222-3` y `900.111.222-3` con trim → también
- `900.111.222-3` y `9001112223` (sin puntos ni guión) → deben considerarse iguales

### AC-4: Mensaje de error claro

- El error retornado por `addProvider` debe incluir el nombre del proveedor que ya tiene ese NIT
- Formato: `Ya existe un proveedor con NIT "900.111.222-3": Estructuras del Norte S.A.S`

---

## 3. Edge Cases

### Error States

- NIT vacío o solo whitespace → debe rechazarse antes de la validación de unicidad
- NIT con caracteres especiales → se normaliza antes de comparar

### Empty States

- Lista de proveedores vacía → el primer `addProvider` siempre pasa

### Loading States

- No aplica

---

## 4. Technical Contract

### Función helper de normalización

```typescript
// /nextjs_space/src/lib/providers-store.ts (privada)
function normalizeNit(nit: string): string {
  return nit.replace(/[\s.\-]/g, "").toUpperCase();
}
```

### Cambio en addProvider

```typescript
addProvider: (data) => {
  const normalized = normalizeNit(data.nit);
  const existing = get().providers.find(
    (p) => normalizeNit(p.nit) === normalized,
  );
  if (existing) {
    return {
      ok: false,
      error: `Ya existe un proveedor con NIT "${data.nit}": ${existing.name}`,
    };
  }
  // ...resto de la lógica
};
```

### Type Contract

- El retorno actual de `addProvider` es `Provider` (no envuelto en `{ ok, error }`)
- Cambio: pasar a retornar `{ ok: true, provider: Provider } | { ok: false, error: string }` para consistencia con `createPSC` y `createPT`
- Actualizar todos los call sites (3: provider-form.tsx, posiblemente otros)

---

## 5. Dependencies

### Files to Modify

- `/nextjs_space/src/lib/providers-store.ts` — `addProvider` con validación
- `/nextjs_space/src/components/providers/provider-form.tsx` — Manejar nuevo tipo de retorno
- (buscar otros call sites) — posiblemente algunos

### Files to Create

- `/tests/verifiers/unique-provider-nit.spec.ts` — Verifier

---

## 6. Out of Scope

- Validación de NIT contra bases de datos externas (DIAN) — futuro
- Normalización de otros campos (email, teléfono) — futuro

---

## 7. Approval

**Status:** ⏳ Pending Review
