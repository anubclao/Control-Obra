# Skill: Seed Datos

Genera datos de prueba realistas para módulos del ERP ControlObra.

## Contexto del proyecto

- **País**: Colombia, moneda COP (sin decimales)
- **Seed principal**: `nextjs_space/prisma/seed.ts` y `nextjs_space/scripts/safe-seed.ts`
- **Cuentas de prueba existentes**: admin@controlobra.com, gerente@, director@, residente@, usuario@ (todas / admin123)
- **Script**: `cd nextjs_space && npx prisma db seed`

## Lo que puedes hacer

### Agregar datos para un módulo específico
Lee el modelo Prisma del módulo y genera datos colombianos realistas:
- Nombres de empresas colombianas reales (sector construcción)
- NITs con formato colombiano (NIT-XXXXXXXXX-X)
- Ciudades colombianas (Bogotá, Medellín, Cali, Barranquilla, etc.)
- Montos en COP realistas para obras de construcción
- Fechas coherentes con el año actual

### Patrones de datos realistas

**Proyectos de construcción** (nombres como):
- "Torre Empresarial Chicó Norte"
- "Conjunto Residencial Los Pinos - Etapa II"
- "Centro Comercial La Colina"
- "Ampliación Planta Industrial Zona Franca"

**Subcontratistas** (categorías típicas):
- Estructurales, Acabados, Eléctricos, Hidrosanitarios, Impermeabilización

**Valores típicos COP**:
- Contrato pequeño: $50M - $500M
- Contrato mediano: $500M - $5.000M
- Contrato grande: $5.000M - $50.000M

**Cortes de obra**: 10-30% del valor del contrato por corte

## Estructura del seed

```typescript
// En safe-seed.ts - siempre usar upsert, nunca create directo
await prisma.modelo.upsert({
  where: { uniqueField: value },
  update: {},
  create: {
    // datos
  },
});
```

## Ejemplo

```
/seed-datos modulo="proyectos" cantidad=5
```

Genera 5 proyectos con datos colombianos realistas y los agrega al archivo safe-seed.ts.

## Notas importantes

- **Siempre usar `upsert`** para que el seed sea idempotente
- **No hardcodear IDs**: usar el resultado de queries para relacionar entidades
- **Fechas coherentes**: startDate < estimatedEndDate, ambas en el año actual
- **Estado progresivo**: algunos proyectos IN_PLANNING, otros IN_EXECUTION, algunos COMPLETED
