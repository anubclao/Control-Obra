# Spec: Cards de ayuda en `proyectos/[id]`

## User Story

Como usuario de cualquier rol que abre un proyecto, quiero ver en cada tab (Resumen, Presupuesto, Cortes, Contratistas, Bitácora) una guía rápida de qué puedo/debo hacer ahí, qué permisos se necesitan y cómo se conecta con el resto del flujo, para no perder tiempo explorando y para entender el ciclo de vida de cada módulo.

## Contexto

- La `ModuleExplanationCard` ya está implementada en `src/components/ui/module-explanation-card.tsx` (P0 plan 2026-10-02). Soporta variantes `info | guide | warning`, pasos numerados, tips y advertencias.
- `/tecnico/proyectos/page.tsx` (lista) y `/tecnico/presupuestos/cargar/page.tsx` (upload) YA tienen la card.
- `/tecnico/proyectos/[id]/page.tsx` (detalle con 5 tabs: resumen / presupuesto / cortes / contratistas / bitácora) NO la tiene. Cada tab muestra solo un empty state frio.
- Bug colateral: en el tab "Contratistas", la línea 87 hace `slice(0, 3)` sobre los providers globales — eso muestra los 3 primeros proveedores del sistema SIN filtrar por proyecto. El TODO en línea 86-87 lo reconoce: `// TODO: cuando exista tabla project_providers, filtrar por project.id`.

## Reglas duras

1. Cada uno de los 5 tabs recibe una `ModuleExplanationCard` arriba del contenido existente. No se elimina ningún contenido actual; la card se suma.
2. **Bug contratistas**: NO usar `slice(0, 3)`. Reemplazar con empty state explicativo ("Aún no hay proveedores vinculados") + call-to-action "Vincular proveedor" (deshabilitado con tooltip hasta que exista la tabla `project_providers`).
3. La card es colapsable (default abierto) — usa `storageKey` por tab para que el usuario pueda cerrarla y la preferencia persista entre visitas.
4. Variante recomendada: `guide` para tabs informativos, `info` para info factual, `warning` si hay riesgo de preregistrar datos.
5. Los textos están en espanol, tono directo, segunda persona ("Carga el presupuesto", "Valida el corte").

## Acceptance Criteria

### AC-1 — Tab Resumen tiene card de guia
- Titulo: "Vista general del proyecto"
- Descripcion: "Resumen ejecutivo con KPIs y avance financiero. Punto de entrada para entender el estado actual."
- Pasos:
  1. **Presupuesto** — total autorizado del proyecto (manual o del Excel importado).
  2. **Ejecutado** — suma de cortes en estado APPROVED o PAID.
  3. **Cortes totales / pendientes** — cuantos cortes se han registrado y cuantos esperan aprobacion.
  4. **Avance financiero** — ratio ejecutado/presupuesto; considerase terminado cuando >=90%.
- Tips: "Los valores se actualizan al aprobar o pagar un corte."

### AC-2 — Tab Presupuesto tiene card de guia
- Titulo: "Presupuesto Tope (PT)"
- Descripcion: "Estructura presupuestal importada desde Excel o digitada manualmente. Define el tope maximo que se puede ejecutar en el proyecto."
- Pasos:
  1. Carga el presupuesto desde el modulo **Presupuestos** del menu lateral.
  2. Selecciona este proyecto y sube el Excel oficial colombiano.
  3. Revisa el modal de resumen: capitulos, subcapitulos, items y valor total.
  4. Si todo coincide con el archivo, confirma para guardar en BD.
- Tips: "El VALOR TOTAL del modal debe coincidir al centavo con la celda VALOR TOTAL PRESUPUESTO del Excel."
- Variante: `guide`. storageKey: `project-detail:presupuesto`.

### AC-3 — Tab Cortes tiene card de guia
- Titulo: "Cortes de obra"
- Descripcion: "Registro de avances parciales contra el presupuesto. Cada corte representa el trabajo ejecutado en un periodo y debe ser validado antes de pagarse."
- Pasos:
  1. **Crear (DRAFT)** — el residente registra las cantidades ejecutadas por item.
  2. **Enviar (SUBMITTED)** — una vez completo en campo, envia el corte para revision.
  3. **Validar (VALIDATED)** — el interventor revisa cantidades contra lo ejecutado en obra.
  4. **Aprobar (APPROVED)** — el administrador aprueba el corte para pago.
  5. **Pagar (PAID)** — tesoreria registra el pago al contratista.
- Tips: "El ciclo de vida es DRAFT -> SUBMITTED -> VALIDATED -> APPROVED -> PAID. Un corte solo se paga cuando esta APPROVED."
- Variante: `guide`. storageKey: `project-detail:cortes`.

### AC-4 — Tab Contratistas tiene card de guia
- Titulo: "Contratistas y proveedores"
- Descripcion: "Personas y empresas vinculadas al proyecto. Cada proveedor debe tener su documentacion al dia (RUT, camara de comercio, certificaciones)."
- Pasos:
  1. Da de alta al proveedor en el modulo **Proveedores** del menu lateral.
  2. Vincúlalo a este proyecto desde el boton **Vincular**.
  3. Verifica que los documentos esten al dia antes de asignarle trabajo.
  4. El proveedor aparece con badge **Habilitado**, **Incompleto** o **Docs vencidos**.
- Tips: "El badge 'Docs vencidos' bloquea la asignacion de nuevos cortes."
- Variante: `guide`. storageKey: `project-detail:contratistas`.

### AC-5 — Tab Bitacora tiene card de guia
- Titulo: "Bitacora del proyecto"
- Descripcion: "Registro diario de actividades en obra: clima, personal, equipos, avances fisicos, novedades. Es la fuente de verdad para auditorias."
- Pasos:
  1. El residente abre la bitacora del dia al iniciar la jornada.
  2. Registra: clima, personal presente, equipos en obra, avance fisico, novedades.
  3. Adjunta fotos del avance (adjuntar fotos proximamente).
  4. Cierra la entrada al final del dia.
- Tips: "La bitacora es evidencia legal ante auditorias. No la dejes para el lunes."
- Variante: `guide`. storageKey: `project-detail:bitacora`.

### AC-6 — Fix bug contratistas
- Reemplazar `slice(0, 3)` con empty state consistente al estilo de los otros tabs.
- Empty state: icono `Users`, titulo "Aun no hay proveedores vinculados", subtitulo "Da de alta un proveedor en el menu lateral y luego vincúlalo a este proyecto desde el boton Vincular".
- Boton "Vincular" sigue disabled (no existe tabla project_providers) pero con tooltip explicativo al hacer hover.

### AC-7 — No regresion
- Los 5 tabs siguen funcionando identico: contenido, modales de edicion y eliminacion, KPIs del resumen.
- TypeScript no introduce errores nuevos.
- Vitest no rompe suites relacionadas (budget-upload-validation, bug-presupuestos-round, dev-auth-bypass).

## Technical Contract

- `src/app/tecnico/proyectos/[id]/page.tsx`:
  - Importar `ModuleExplanationCard` desde `@/components/ui/module-explanation-card`.
  - Agregar una card arriba de cada `<TabsContent>` (resumen / presupuesto / cortes / contratistas / bitacora).
  - Reemplazar la logica de `projectProviders` (linea 87) por empty state.
- Sin cambios en API ni en BD (la tabla `project_providers` queda pendiente para otro sprint).

## Dependencies

- `src/components/ui/module-explanation-card.tsx` — componente existente.
- `src/components/ui/card.tsx` — para los empty states consistentes.
- Sin cambios en `data-store` ni en API.

## Out of scope

- Crear tabla `project_providers` (sprint futuro).
- Activar el boton "Vincular" / "Nuevo corte" / etc. (quedan disabled hasta tener las tablas/API necesarias).
- Hacer los cards traducibles a otros idiomas (solo espanol por ahora).

## Riesgos

- R1: si el usuario ya cerro la card en su ultima visita, la proxima visita la mantiene cerrada (storageKey). Aceptable: el card es informativo, no critico.
- R2: si el texto de un card esta mal (ej: "Pagar" no es el siguiente paso correcto), confiar en QA del usuario para detectarlo. Es copy, no logica.

## Cambios necesarios

1. `src/app/tecnico/proyectos/[id]/page.tsx` — agregar 5 cards + fix contratistas.
2. (opcional) test en `tests/verifiers/project-detail-help-cards.spec.ts` con static source analysis.