# PRD - Control de Obra Pro

**Producto:** Control de Obra Pro
**Versión:** 1.0
**Fecha:** 2026-06-13
**Estado:** Borrador funcional basado en la implementación actual del repositorio
**Repositorio base:** workspace del proyecto

---

## 1. Resumen Ejecutivo

Control de Obra Pro es una plataforma web para la gestión integral de proyectos de construcción, orientada a constructoras, interventorías y equipos administrativos que necesitan centralizar operación, presupuestos, contratos, subcontratistas, cortes de obra, pagos, reportes financieros, RRHH y ventas.

### 1.1 Problema que resuelve

Los equipos de obra suelen trabajar con información fragmentada entre campo, administración y gerencia. Esto genera:

- Retrasos en aprobaciones de pagos.
- Dificultad para saber el avance real de obra.
- Errores en presupuestos y cortes.
- Pérdida de documentos de contratistas y empleados.
- Baja visibilidad financiera por proyecto.
- Duplicidad de información entre áreas.

### 1.2 Propuesta de valor

- Unificar la operación en una sola plataforma.
- Estandarizar el flujo de aprobación y pago.
- Controlar presupuesto, avance y ejecución con datos consistentes.
- Mantener documentalmente habilitados contratistas y empleados.
- Dar trazabilidad completa a cada proyecto.
- Ofrecer una base escalable para crecimiento multiusuario.

## 2. Objetivos del Producto

### 2.1 Objetivos principales

1. Centralizar la información operativa y financiera de los proyectos.
2. Reducir tiempos de aprobación y seguimiento de pagos.
3. Controlar la ejecución presupuestal frente al presupuesto aprobado.
4. Registrar avance diario de obra y bitácora de campo.
5. Administrar contratistas, empleados, clientes y usuarios con permisos.
6. Habilitar reportes gerenciales y financieros por proyecto.

### 2.2 Objetivos medibles

- Disminuir tiempos de búsqueda de documentos y estados de aprobación.
- Lograr trazabilidad total de pagos, cortes y documentos.
- Reducir errores manuales en cálculos de retenciones, AIU e impuestos.
- Incrementar visibilidad de avance de obra y ejecución presupuestal.
- Mantener una arquitectura preparada para múltiples usuarios y procesos concurrentes.

## 3. Alcance del Producto

### 3.1 Incluido en el alcance

- Autenticación y control de acceso por rol.
- Dashboard principal con indicadores.
- Gestión de proyectos.
- Gestión de presupuestos con estructura jerárquica.
- AIU por proyecto.
- Contratos y documentos contractuales.
- Subcontratistas y sus documentos.
- Cortes de obra.
- Bitácora diaria de obra.
- Tesorería y flujo de pagos.
- Reportes financieros e impuestos.
- RRHH y empleados.
- Programación y avance diario.
- Módulo comercial / CRM.
- Administración de usuarios e invitaciones.

### 3.2 Fuera de alcance inicial

- Nómina completa.
- Inventario de materiales.
- Integración contable profunda con terceros.
- Aplicación móvil nativa.
- BI avanzado con data warehouse.
- Multi-moneda operacional completa.
- Firma electrónica especializada de contratos.

## 4. Usuarios y Roles

### 4.1 Roles principales

| Rol | Responsabilidad principal | Acciones clave |
|---|---|---|
| ADMIN | Administración total | Configurar, eliminar, gestionar usuarios y accesos |
| GERENTE | Dirección general | Aprobar pagos, revisar reportes, invitar usuarios |
| DIRECTOR | Dirección de obra | Validar avance, aprobar pagos de nivel 1, gestionar proyectos |
| RESIDENTE | Ejecución en obra | Registrar avance, bitácora y cortes |
| CONTABILIDAD | Control financiero | Revisar impuestos, reportes y registros contables |
| TESORERIA | Gestión de pagos | Ejecutar pagos aprobados |
| HSEQ | Seguridad y salud | Revisar documentos y cumplimiento de empleados/contratistas |
| CLIENTE | Consulta externa | Ver información restringida del proyecto asignado |
| USER | Usuario básico | Operación limitada |

## 5. Principios de Producto

1. **Trazabilidad primero:** cada acción relevante debe poder auditarse.
2. **Control por rol:** la visibilidad y edición dependen del rol y del contexto.
3. **Datos consistentes:** evitar cálculos manuales repetidos.
4. **Documentación asociada:** cada entidad clave debe soportar archivos.
5. **Operación realista para obra:** el flujo debe adaptarse a la rutina del proyecto.
6. **Escalabilidad técnica:** soporte para concurrencia, cache y colas de trabajo.

## 6. Flujo General del Usuario

### 6.1 Flujo de entrada

1. El usuario ingresa por login o invitación.
2. El sistema valida credenciales y rol.
3. Se redirige al dashboard o al módulo permitido.
4. El usuario consulta o registra información según su responsabilidad.
5. El sistema persiste cambios y actualiza reportes relacionados.

### 6.2 Flujo operativo de proyecto

1. Se crea el proyecto.
2. Se asigna presupuesto y presupuesto versionado.
3. Se vinculan contratistas y contratos.
4. Se registran avances diarios y bitácoras.
5. Se generan cortes de obra.
6. Se aprueban solicitudes de pago.
7. Tesorería ejecuta pagos.
8. Gerencia y contabilidad consultan reportes.

## 7. Requerimientos Funcionales

### 7.1 Autenticación y Administración de Usuarios
- Login con credenciales.
- Registro por invitación.
- Invitaciones con código único y fecha de expiración.
- Asignación de rol y proyecto al aceptar invitación.
- Restricción de acceso por módulo y rol.

### 7.2 Dashboard Principal
- Proyectos activos.
- Presupuesto vs ejecutado.
- Alertas de documentos vencidos.
- Cortes pendientes.
- Actividad reciente.
- Indicadores básicos de gestión.

### 7.3 Proyectos
- CRUD de proyectos.
- Código, nombre, cliente, ubicación, fechas y presupuesto.
- Asignación de centros de costo.
- Asociación con cortes, contratos, bitácoras y avances.
- Vinculación con usuarios.

### 7.4 Presupuestos
- Estructura por capítulos, subcapítulos e items.
- Versionamiento (una sola versión activa).
- **Importación desde Excel (detección automática de columnas).**
- Cantidades, precios, totales automáticos.
- Seguimiento de ejecutado por item.
- Cálculo automático de acumulados.

### 7.5 AIU
- Configuración por proyecto: administración, imprevistos, utilidad.
- Visualización porcentual.
- Alertas de desalineación.

### 7.6 Contratos
- CRUD por proyecto y contratista.
- Tipo, valor, fechas, estado y alcance.
- Carga de documentos contractuales.
- Retenciones, anticipos y condiciones.
- Histórico de contrato.

### 7.7 Subcontratistas
- CRUD completo.
- Razón social, NIT único, contacto, dirección, representante legal.
- Información financiera y referencias comerciales.
- Carga de documentos obligatorios.
- Alertas de vencimiento.
- NIT único validado.

### 7.8 Cortes de Obra
- Crear por proyecto y contratista.
- Cálculo automático: bruto, retenciones, anticipos, neto.
- Soportes y documentos.
- Estados: borrador → enviado → validado → aprobado/rechazado → pagado.
- Aprobación según jerarquía.

### 7.9 Bitácora de Obra
- Fecha, clima, temperatura, personal, actividades, incidentes, observaciones.
- Subir fotografías.
- Asociación con usuario creador.
- Histórico por proyecto y fecha.

### 7.10 Tesorería y Flujo de Pagos
- Solicitudes con número único.
- Clasificación por tipo, prioridad, proyecto y beneficiario.
- Flujo multinivel de aprobación.
- Estado actual e histórico de aprobaciones.
- Pago ejecutado con fecha y soporte.
- Filtros por proyecto, estado y prioridad.

### 7.11 Reportes Financieros
- Resumen ejecutivo por proyecto.
- Cards de presupuestado, ejecutado, % ejecución, impuestos retenidos.
- Desglose por categoría.
- Vista de cortes con valores y retenciones.
- Filtro por proyecto.

### 7.12 Impuestos
- Configuración por proyecto: nombre, tipo, tasa, alcance, estado.
- Tipos: IVA, Retención fuente, Retención IVA, Retención ICA, Estampillas, Otros.
- Activar/desactivar.

### 7.13 RRHH - Empleados
- CRUD con número autogenerado.
- Vinculación con usuario del sistema.
- Cargo, departamento, tipo de contrato, salario, banco.
- 11 tipos de documentos.
- Alertas por faltantes y vencimientos.

### 7.14 Programación y Avance Diario
- Avance por fecha y proyecto.
- Avance por item de presupuesto.
- Porcentaje ponderado.
- Fotos y observaciones.
- Histórico y gráficos.

### 7.15 Ventas / CRM
- CRUD de clientes.
- Clasificación por fuente y estado.
- Cotizaciones con items, subtotal, IVA, descuentos, total.
- Pipeline: prospecto → contactado → calificado → propuesta → negociación → ganado/perdido.

### 7.16 Administración de Usuarios
- Lista de usuarios.
- Crear invitaciones con expiración y rol.
- Asignar proyecto.
- Reutilización con máximo de usos.

## 8. Requerimientos No Funcionales

### 8.1 Rendimiento
- Dashboard responde en tiempos razonables.
- Reportes con cache.
- Operaciones de fondo concurrentes.

### 8.2 Escalabilidad
- Múltiples usuarios simultáneos.
- Procesamiento distribuido si hay Redis.
- Cache con TTL e invalidación.

### 8.3 Seguridad
- Autenticación obligatoria en rutas protegidas.
- Autorización por rol y proyecto.
- Validación de parámetros.
- Registro estructurado de eventos.

### 8.4 Trazabilidad y auditoría
- Aprobaciones, rechazos, pagos y cambios documentales rastreables.

### 8.5 Disponibilidad operativa
- Fallback a memoria si Redis no está disponible.

## 9. Stack Tecnológico

| Componente | Tecnología |
|---|---|
| Framework | Next.js 14 |
| Lenguaje | TypeScript 5.2 |
| Base de datos | MySQL |
| ORM | Prisma 6.7 |
| Autenticación | NextAuth.js 4.24 |
| UI | Shadcn/UI + Radix UI |
| Estilos | Tailwind CSS 3.3 |
| Estado | Zustand |
| Gráficos | Recharts |
| Upload / storage | AWS S3 |
| Cola de jobs | BullMQ + Redis (opcional) |
| Validación | Zod |

## 10. Integraciones

- **AWS S3** — documentos y fotos, presigned URLs.
- **SharePoint** — sincronización documental para subcontratistas.
- **Redis / BullMQ** — jobs distribuidos con fallback a memoria.

## 11. Arquitectura Operativa

1. Next.js expone la UI y rutas protegidas.
2. Prisma persiste en MySQL.
3. Reportes con cache temporal.
4. Tareas largas en BullMQ si Redis está disponible.
5. Worker separado procesa jobs.
6. Mutaciones invalidan cache.

## 12. KPIs Sugeridos

- Tiempo medio de aprobación de pagos.
- % de cortes aprobados sin retrabajo.
- Tiempo de registro de bitácora diaria.
- % de contratistas con documentación completa.
- % de empleados con documentación vigente.
- Tiempo de respuesta de reportes financieros.
- Número de proyectos con presupuesto y avance actualizados.

## 13. Riesgos y Mitigaciones

| Riesgo | Mitigación |
|---|---|
| Datos incompletos | Validaciones y campos requeridos |
| Documentos vencidos | Alertas y semáforos de vigencia |
| Aprobaciones tardías | Flujo multinivel con notificaciones |
| Crecimiento de datos | Cache, paginación y jobs distribuidos |
| Dependencia de Redis | Fallback a memoria |

## 14. Roadmap

### Fase 1 - Consolidación
- Cobertura de todos los módulos.
- Validaciones y mensajes estandarizados.
- Filtros, búsqueda y paginación.

### Fase 2 - Operación avanzada
- Notificaciones automáticas.
- Exportación PDF/Excel.
- Auditoría visual de cambios.
- Alertas por riesgo financiero/documental.

### Fase 3 - Expansión
- Nómina, inventario, compras.
- Integración contable.
- Analítica avanzada.

## 15. Definición de Éxito

Un equipo de construcción puede operar un proyecto completo dentro del sistema, desde su presupuesto y contratación hasta el avance diario, los cortes, la aprobación de pagos y el reporte financiero, sin depender de procesos manuales dispersos.

## 16. Anexo: Inventario de Módulos

Dashboard, Proyectos, Presupuestos, AIU, Contratos, Subcontratistas, Cortes de obra, Bitácora, Tesorería, Reportes financieros, Impuestos, RRHH / empleados, Programación, Ventas / CRM, Administración de usuarios.
