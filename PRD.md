# PRD - Control de Obra Pro
## Product Requirements Document

**Versión:** 1.0  
**Fecha:** 19 de Febrero de 2026  
**URL:** https://controlobrapro.abacusai.app

---

## 1. Visión General

**Control de Obra Pro** es un sistema ERP especializado para la gestión integral de proyectos de construcción en Colombia y USA. La plataforma permite administrar proyectos, presupuestos, subcontratistas, cortes de obra, pagos, recursos humanos y ventas desde una interfaz centralizada.

### 1.1 Objetivos del Producto
- Centralizar la gestión de proyectos de construcción
- Automatizar flujos de aprobación de pagos
- Controlar documentación de subcontratistas y empleados
- Gestionar presupuestos con estructura jerárquica (Capítulos/Subcapítulos/Ítems)
- Facilitar el seguimiento de avance diario de obra
- Administrar el ciclo de ventas desde cotización hasta proyecto

---

## 2. Usuarios y Roles

### 2.1 Roles del Sistema

| Rol | Descripción | Permisos Clave |
|-----|-------------|----------------|
| **ADMIN** | Super Administrador | Acceso total, eliminar registros, configuración |
| **GERENTE** | Gerencia General | Aprobar pagos nivel 2, invitar usuarios, ver reportes |
| **DIRECTOR** | Director de Obra | Aprobar pagos nivel 1, gestionar proyectos |
| **RESIDENTE** | Residente de Obra | Registrar avances, crear cortes |
| **CONTABILIDAD** | Área Contable | Ver reportes financieros, configurar impuestos |
| **TESORERIA** | Tesorería | Ejecutar pagos aprobados |
| **HSEQ** | Seguridad y Salud | Gestionar documentación de empleados |
| **CLIENTE** | Cliente Externo | Ver solo su proyecto |
| **USER** | Usuario Básico | Permisos limitados |

### 2.2 Cuentas de Prueba

| Email | Contraseña | Rol |
|-------|------------|-----|
| admin@controlobra.com | admin123 | Super Administrador |
| gerente@controlobra.com | admin123 | Gerente |
| director@controlobra.com | admin123 | Director |
| residente@controlobra.com | admin123 | Residente |
| usuario@controlobra.com | usuario123 | Usuario |

---

## 3. Módulos del Sistema

### 3.1 Dashboard Principal
**Ruta:** `/dashboard`

**Funcionalidades:**
- Estadísticas generales (proyectos, subcontratistas, cortes pendientes)
- Alertas de documentación vencida/próxima a vencer
- Lista de proyectos activos con presupuesto vs ejecutado
- Bitácora reciente

---

### 3.2 Módulo de Proyectos
**Ruta:** `/dashboard/proyectos`

**Modelo de Datos:**
```
Project:
  - code: String (PRY-2024-001)
  - name: String
  - client: String
  - location: String
  - startDate: DateTime
  - estimatedEndDate: DateTime
  - totalBudget: Float
  - status: IN_PLANNING | IN_EXECUTION | PAUSED | COMPLETED
  - description: Text
```

**Funcionalidades:**
- CRUD de proyectos
- Asignar centros de costo
- Ver presupuesto asociado
- Listar cortes de obra por proyecto
- Asignar usuarios al proyecto

---

### 3.3 Módulo de Presupuestos
**Ruta:** `/dashboard/presupuestos`

**Modelo de Datos:**
```
Budget:
  - projectId: String
  - totalValue: Float

BudgetVersion:
  - budgetId: String
  - version: Int
  - isActive: Boolean

BudgetLayer (Jerarquía):
  - code: String (1, 1.1, 1.1.1)
  - name: String
  - layerType: CHAPTER | SUBCHAPTER | ITEM
  - parentId: String (nullable)

BudgetItem:
  - budgetLayerId: String
  - description: String
  - unit: String (M2, ML, UN, GL)
  - quantity: Float
  - unitPrice: Float
  - totalPrice: Float
  - executedQuantity: Float
  - executedAmount: Float
```

**Funcionalidades:**
- Importar presupuesto desde Excel (detección automática de columnas)
- Estructura jerárquica de 3 niveles
- Versionamiento de presupuestos
- Cálculo automático de totales
- Seguimiento de cantidades ejecutadas

---

### 3.4 Módulo AIU (Administración, Imprevistos, Utilidad)
**Ruta:** `/dashboard/planeacion/aiu`

**Funcionalidades:**
- Dashboard gerencial con indicadores
- Configuración de porcentajes AIU por proyecto:
  - Administración (%)
  - Imprevistos (%)
  - Utilidad (%)
- Gráficos de distribución
- Panel de alertas de desviaciones

---

### 3.5 Módulo de Contratos
**Ruta:** `/dashboard/planeacion/contratos`

**Modelo de Datos:**
```
Contract:
  - contractNumber: String (CTR-2024-0001)
  - projectId: String
  - contractorId: String
  - type: OBRA | SUMINISTRO | SERVICIOS | CONSULTORIA
  - value: Float
  - startDate: DateTime
  - endDate: DateTime
  - status: DRAFT | ACTIVE | COMPLETED | CANCELLED | SUSPENDED
  - scopeOfWork: Text
  - retentionPercent: Float (default 10%)
  - advancePercent: Float

ContractDocument:
  - contractId: String
  - fileName: String
  - cloudStoragePath: String
  - documentType: CONTRATO_FIRMADO | POLIZA_CUMPLIMIENTO | POLIZA_RESPONSABILIDAD...
```

**Funcionalidades:**
- CRUD de contratos
- Vinculación con proyectos y subcontratistas
- Carga de documentos contractuales
- Cálculo de retenciones y anticipos
- Estados de contrato

---

### 3.6 Módulo de Subcontratistas
**Ruta:** `/dashboard/subcontratistas`

**Modelo de Datos:**
```
Contractor:
  - name: String (Razón Social)
  - nit: String (único)
  - contact: String
  - email: String
  - phone: String
  - website: String?
  - address: String?
  - city: String?
  - department: String?
  - postalCode: String?
  - legalRepName: String?
  - legalRepCedula: String?
  - legalRepEmail: String?
  - legalRepPhone: String?
  - reportedIncome: Float? (Renta reportada)
  - incomeYear: Int?
  - ref1Name, ref1Company, ref1Phone, ref1Email (Referencia 1)
  - ref2Name, ref2Company, ref2Phone, ref2Email (Referencia 2)
  - ref3Name, ref3Company, ref3Phone, ref3Email (Referencia 3)
  - status: COMPLETE | INCOMPLETE | EXPIRED

Document:
  - type: CEDULA | RUT | CAMARA_COMERCIO | CERTIFICADO_BANCARIO
  - fileName: String
  - cloudStoragePath: String
  - expirationDate: DateTime?
  - sharepointPath: String?
```

**Funcionalidades:**
- CRUD de subcontratistas
- Formulario completo con 5 secciones:
  - Información Básica
  - Dirección
  - Representante Legal
  - Información Financiera
  - 3 Referencias Comerciales
- Gestión de documentos obligatorios:
  - Cédula de Ciudadanía
  - RUT
  - Cámara de Comercio
  - Certificado Bancario
- Alertas de documentos vencidos/faltantes
- Integración con SharePoint para almacenamiento
- Botón Editar (todos los usuarios)
- Botón Eliminar (solo ADMIN)

---

### 3.7 Módulo de Cortes de Obra
**Ruta:** `/dashboard/cortes`

**Modelo de Datos:**
```
WorkCut:
  - cutNumber: String (CO-001-P001)
  - projectId: String
  - contractorId: String
  - costCenterId: String
  - description: Text
  - grossValue: Float
  - retentionValue: Float
  - advanceDeduction: Float
  - netValue: Float
  - status: DRAFT | SUBMITTED | VALIDATED | APPROVED | REJECTED | PAID
  - submittedAt: DateTime?
  - approvedAt: DateTime?
  - approvedById: String?

WorkCutDocument:
  - workCutId: String
  - fileName: String
  - cloudStoragePath: String
  - documentType: ACTA | FACTURA | SOPORTE
```

**Funcionalidades:**
- Crear cortes de obra
- Flujo de estados: Borrador → Enviado → Validado → Aprobado → Pagado
- Cálculo automático de retenciones
- Carga de documentos soporte
- Aprobación por roles autorizados

---

### 3.8 Módulo de Bitácora
**Ruta:** `/dashboard/bitacora`

**Modelo de Datos:**
```
WorkLog:
  - projectId: String
  - date: DateTime
  - weather: String
  - temperature: Float?
  - workersCount: Int
  - activities: Text
  - incidents: Text?
  - materials: Text?
  - observations: Text?
  - createdById: String

WorkLogPhoto:
  - workLogId: String
  - fileName: String
  - cloudStoragePath: String
  - caption: String?
```

**Funcionalidades:**
- Registro diario de actividades
- Condiciones climáticas
- Conteo de personal
- Registro de incidentes
- Galería de fotos

---

### 3.9 Módulo de Tesorería - Flujo de Pagos
**Ruta:** `/dashboard/tesoreria/pagos`

**Modelo de Datos:**
```
PaymentRequest:
  - requestNumber: String (PAG-2026-00001)
  - projectId: String
  - contractorId: String?
  - type: CORTE_OBRA | ANTICIPO | RETENCION | SUMINISTRO | SERVICIOS | HONORARIOS | OTROS
  - amount: Float
  - priority: LOW | NORMAL | HIGH | URGENT
  - status: PENDING | APPROVED_LEVEL_1 | APPROVED_LEVEL_2 | APPROVED | REJECTED | PAID | CANCELLED
  - currentApprovalLevel: Int
  - requiredApprovalLevel: Int
  - beneficiaryName, beneficiaryNit, bankName, accountType, accountNumber
  - dueDate: DateTime?
  - paidAt: DateTime?

PaymentApproval:
  - paymentRequestId: String
  - level: Int (1, 2, 3)
  - action: APPROVED | REJECTED | RETURNED
  - comments: Text
  - approverId: String
```

**Flujo de Aprobación:**
1. **Nivel 1 - Director de Obra:** Valida el pago
2. **Nivel 2 - Gerente:** Aprueba el pago
3. **Nivel 3 - Administrador:** (Opcional) Aprobación final para montos altos

**Funcionalidades:**
- Crear solicitudes de pago
- Dashboard con estadísticas
- Filtros por estado, prioridad, proyecto
- Flujo de aprobación multinivel
- Historial de aprobaciones
- Ejecución de pago (Tesorería)

---

### 3.10 Módulo de Reportes Financieros
**Ruta:** `/dashboard/reportes/financiero`

**Funcionalidades:**
- Resumen ejecutivo con cards:
  - Total Presupuestado
  - Total Ejecutado
  - Porcentaje de Ejecución
  - Impuestos Retenidos
- Filtro por proyecto
- Desglose detallado por categoría
- Tabla de cortes con valores y retenciones

---

### 3.11 Módulo de Configuración de Impuestos
**Ruta:** `/dashboard/reportes/impuestos`

**Modelo de Datos:**
```
TaxConfig:
  - projectId: String
  - name: String
  - rate: Float (%)
  - type: IVA | RETENCION_FUENTE | RETENCION_IVA | RETENCION_ICA | ESTAMPILLAS | OTROS
  - appliesTo: VENTAS | COMPRAS | AMBOS
  - isActive: Boolean
```

**Impuestos Colombianos por Defecto:**
- IVA: 19%
- Retención en la Fuente: 11%
- Retención de IVA: 15%
- Retención de ICA: 0.966%

**Funcionalidades:**
- Configurar impuestos por proyecto
- Activar/desactivar impuestos
- CRUD completo

---

### 3.12 Módulo de RRHH - Empleados
**Ruta:** `/dashboard/rrhh/empleados`

**Modelo de Datos:**
```
Employee:
  - employeeNumber: String (EMP-0001, auto-generado)
  - position: String
  - department: GERENCIA | OPERACIONES | CONTABILIDAD | TESORERIA | HSEQ | COMERCIAL | ADMINISTRATIVO
  - contractType: INDEFINIDO | FIJO | OBRA_LABOR | PRESTACION | APRENDIZAJE
  - startDate, endDate: DateTime
  - salary: Float?
  - eps, pensionFund, arl: String
  - riskLevel: Int (1-5)
  - bankName, accountType, accountNumber: String
  - status: ACTIVE | INACTIVE | ON_LEAVE | TERMINATED
  - userId: String? (vinculación a usuario)

EmployeeDocument:
  - type: CEDULA | CONTRATO | AFILIACION_EPS | AFILIACION_PENSION | AFILIACION_ARL | 
          EXAMEN_INGRESO | EXAMEN_PERIODICO | CERTIFICACION_ALTURAS | 
          LICENCIA_CONDUCIR | CURSO_SST | OTROS
  - fileName, cloudStoragePath: String
  - expirationDate: DateTime?
```

**Funcionalidades:**
- CRUD de empleados
- Dashboard con estadísticas
- Alertas de documentos faltantes/vencidos
- Gestión de 11 tipos de documentos
- Vinculación con usuarios del sistema

---

### 3.13 Módulo de Programación - Avance Diario
**Ruta:** `/dashboard/programacion`

**Modelo de Datos:**
```
DailyProgress:
  - projectId: String
  - date: DateTime (único por proyecto)
  - weather: String
  - temperature: Float?
  - personnelCount: Int
  - generalNotes: Text

ProgressEntry:
  - dailyProgressId: String
  - budgetItemId: String
  - quantityToday: Float
  - contractorId: String?
  - notes: Text

ProgressPhoto:
  - dailyProgressId: String
  - fileName, cloudStoragePath: String
  - caption: String?
```

**Funcionalidades:**
- Lista de proyectos con porcentaje de avance
- Registro diario de avance
- Avance por ítem de presupuesto
- Cálculo de porcentaje ponderado
- Gráficos de progreso
- Desglose por capítulo
- Histórico de avances

---

### 3.14 Módulo de Ventas / CRM
**Ruta:** `/dashboard/ventas`

#### 3.14.1 Clientes
**Ruta:** `/dashboard/ventas/clientes`

**Modelo de Datos:**
```
Client:
  - clientNumber: String (CLI-0001, auto-generado)
  - companyName: String
  - nit: String?
  - contactName, contactPosition: String
  - email, phone, address, city: String
  - sector: String?
  - source: REFERIDO | WEB | REDES_SOCIALES | FERIA | LLAMADA_FRIA | OTROS
  - status: PROSPECT | CONTACTED | QUALIFIED | PROPOSAL | NEGOTIATION | WON | LOST
```

**Funcionalidades:**
- CRUD de clientes
- Dashboard de pipeline (funnel de ventas)
- Filtros por estado y fuente
- Historial de cotizaciones por cliente

#### 3.14.2 Cotizaciones
**Ruta:** `/dashboard/ventas/cotizaciones`

**Modelo de Datos:**
```
Quotation:
  - quotationNumber: String (COT-2026-0001, auto-generado)
  - clientId: String
  - title: String
  - description: Text
  - validUntil: DateTime
  - status: DRAFT | SENT | VIEWED | ACCEPTED | REJECTED | EXPIRED | CANCELLED
  - subtotal, discountPercent, discountAmount: Float
  - ivaPercent (default 19%), ivaAmount: Float
  - total: Float
  - paymentTerms, deliveryTerms, warranty, observations: Text
  - sentAt, respondedAt: DateTime?

QuotationItem:
  - quotationId: String
  - itemNumber: Int
  - description: Text
  - unit: String
  - quantity, unitPrice, totalPrice: Float
```

**Funcionalidades:**
- Crear cotizaciones con ítems
- Cálculo automático de subtotal, IVA y total
- Estados de cotización
- Actualización automática del estado del cliente
- Condiciones comerciales configurables

**Visibilidad:** Solo ADMIN, GERENTE, DIRECTOR

---

### 3.15 Módulo de Administración - Usuarios
**Ruta:** `/dashboard/administracion/usuarios`

**Funcionalidades:**
- Lista de usuarios del sistema
- Sistema de invitaciones con código
- Código de 8 caracteres auto-generado
- Fecha de expiración configurable
- Asignación de rol por invitación
- Asignación a proyecto específico

---

## 4. Autenticación

**Ruta de Login:** `/login`  
**Ruta de Registro:** `/registro`

**Implementación:**
- NextAuth.js con credenciales
- JWT tokens
- Bcrypt para hash de contraseñas
- Registro por invitación (código de 8 caracteres)
- Protección de rutas por rol

---

## 5. Integraciones

### 5.1 AWS S3
- Almacenamiento de archivos y documentos
- URLs pre-firmadas para upload directo
- Soporte para archivos públicos y privados

### 5.2 SharePoint
- Sincronización de documentos de subcontratistas
- Estructura de carpetas por proyecto

---

## 6. Stack Tecnológico

| Componente | Tecnología |
|------------|------------|
| Framework | Next.js 14 (App Router) |
| Lenguaje | TypeScript |
| Base de Datos | PostgreSQL |
| ORM | Prisma 6.7 |
| Autenticación | NextAuth.js 4.24 |
| UI Components | Shadcn/UI + Radix UI |
| Estilos | Tailwind CSS 3.3 |
| Iconos | Lucide React |
| Gráficos | Recharts |
| Storage | AWS S3 |

---

## 7. Estructura de Navegación

```
📊 Dashboard
📁 Proyectos
  └── Detalle de Proyecto
  └── Nuevo Proyecto
📋 Planeación
  ├── Presupuestos
  ├── AIU
  └── Contratos
👷 Subcontratistas
  └── Detalle
  └── Nuevo
✂️ Cortes de Obra
  └── Detalle
  └── Nuevo
📓 Bitácora
  └── Nueva Entrada
💰 Tesorería
  └── Flujo de Pagos
📈 Reportes
  ├── Financiero
  └── Impuestos
📅 Programación
  └── Avance por Proyecto
💼 Ventas
  ├── Cotizaciones
  └── Clientes
👥 RRHH
  └── Empleados
⚙️ Administración
  └── Usuarios
```

---

## 8. Roadmap Futuro

### Fase 2 (Próxima)
- [ ] Nómina básica
- [ ] Inventario de materiales
- [ ] App móvil para registro de avances
- [ ] Notificaciones por email
- [ ] Reportes PDF exportables

### Fase 3
- [ ] Módulo de compras
- [ ] Integración contable (SIIGO, SAP)
- [ ] Dashboard de BI avanzado
- [ ] Multi-moneda (USD/COP)

---

## 9. Contacto

**Aplicación:** Control de Obra Pro  
**URL:** https://controlobrapro.abacusai.app  
**Plataforma:** Abacus.AI DeepAgent
