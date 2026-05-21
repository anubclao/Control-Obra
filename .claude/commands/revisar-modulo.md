# Skill: Revisar Módulo

Hace una revisión completa de calidad de un módulo del ERP ControlObra.

## Qué revisar

Dado el nombre de un módulo, lee todos sus archivos y verifica:

### 1. API Routes (`app/api/<modulo>/`)
- [ ] Valida sesión con `getServerSession` en cada endpoint
- [ ] Verifica permisos por rol (no solo autenticación)
- [ ] Usa el service del módulo, no Prisma directo
- [ ] Maneja errores con `try/catch` y devuelve códigos HTTP correctos
- [ ] No expone datos sensibles (passwords, tokens)
- [ ] Tiene tipado correcto (no `any` innecesario)
- [ ] Método HTTP correcto: GET=consulta, POST=crear, PUT=actualizar, DELETE=eliminar

### 2. Service Layer (`modules/<modulo>/`)
- [ ] `validations.ts` tiene schemas Zod para todas las operaciones
- [ ] `queries.ts` encapsula las queries Prisma (no esparcidas en routes)
- [ ] `service.ts` contiene lógica de negocio (no solo CRUD)
- [ ] `types.ts` tiene los tipos TypeScript del módulo
- [ ] Las funciones están bien nombradas y son de responsabilidad única

### 3. UI Components (`app/dashboard/<modulo>/`)
- [ ] `page.tsx` es Server Component (sin `"use client"`)
- [ ] Los Client Components están en `_components/` con `"use client"`
- [ ] Los formularios usan React Hook Form + Zod
- [ ] Las acciones destructivas tienen `<AlertDialog>` de confirmación
- [ ] Los estados de carga usan `Skeleton`
- [ ] Las tablas tienen estado vacío
- [ ] Responsive: funciona en mobile y desktop
- [ ] Fechas en formato colombiano (dd/MM/yyyy)
- [ ] Montos en COP con `formatCOP()`

### 4. Base de datos MySQL (`database/mysql/`)
- [ ] Existe una vista `v_<modulo>_*` para reportes
- [ ] Los triggers mantienen consistencia de datos calculados
- [ ] Los índices cubren los filtros más usados

### 5. Navegación
- [ ] El módulo está en `dashboard-nav.tsx` en la sección correcta
- [ ] El ícono de lucide-react es apropiado

## Cómo reportar

Genera un reporte estructurado:

```markdown
## Revisión: [Nombre Módulo]

### ✅ Correcto
- Lista de cosas bien implementadas

### ⚠️ Mejorar
- Lista de mejoras no críticas con código sugerido

### 🚨 Crítico (hay que corregir)
- Lista de problemas que deben corregirse con el fix

### 📊 Cobertura MySQL
- Vistas existentes: v_xxx
- Triggers: tr_xxx
- Procedimientos: sp_xxx
- Sugerencias faltantes
```

Después de el reporte, pregunta si desea que corrijas los problemas encontrados.

## Ejemplo

```
/revisar-modulo nombre="pagos"
```
