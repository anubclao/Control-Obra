// Constantes de la aplicación

export const PROJECT_STATUS = {
  IN_PLANNING: 'En Planificación',
  IN_EXECUTION: 'En Ejecución',
  PAUSED: 'Pausado',
  COMPLETED: 'Completado'
} as const;

export const WORK_CUT_STATUS = {
  PENDING: 'Pendiente',
  IN_REVIEW: 'En Revisión',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado'
} as const;

export const CONTRACTOR_STATUS = {
  COMPLETE: 'Completo',
  INCOMPLETE: 'Incompleto',
  EXPIRED: 'Vencido'
} as const;

export const DOCUMENT_TYPE = {
  CEDULA: 'Cédula de Ciudadanía',
  RUT: 'RUT',
  CAMARA_COMERCIO: 'Cámara de Comercio',
  CERTIFICADO_BANCARIO: 'Certificado Bancario'
} as const;

export const REQUIRED_CONTRACTOR_DOCUMENTS = [
  'CEDULA',
  'RUT',
  'CAMARA_COMERCIO',
  'CERTIFICADO_BANCARIO',
] as const;

export const USER_ROLE = {
  ADMIN: 'Super Administrador',
  GERENTE: 'Gerente',
  DIRECTOR: 'Director de Obra',
  RESIDENTE: 'Residente',
  CONTABILIDAD: 'Contabilidad',
  TESORERIA: 'Tesorería',
  HSEQ: 'HSEQ',
  CLIENTE: 'Cliente',
  USER: 'Usuario'
} as const;

// Roles que pueden invitar usuarios
export const ROLES_CAN_INVITE = ['ADMIN', 'GERENTE'] as const;

// Roles que pueden aprobar pagos
export const ROLES_CAN_APPROVE_PAYMENTS = ['ADMIN', 'GERENTE', 'DIRECTOR'] as const;

// Roles que pueden ver reportes financieros
export const ROLES_CAN_VIEW_FINANCIAL = ['ADMIN', 'GERENTE', 'DIRECTOR', 'CONTABILIDAD', 'TESORERIA'] as const;

// Roles internos (no clientes)
export const INTERNAL_ROLES = ['ADMIN', 'GERENTE', 'DIRECTOR', 'RESIDENTE', 'CONTABILIDAD', 'TESORERIA', 'HSEQ'] as const;

export const CONTRACT_TYPE = {
  OBRA: 'Obra',
  SUMINISTRO: 'Suministro',
  SERVICIOS: 'Servicios',
  CONSULTORIA: 'Consultoría',
  MIXTO: 'Mixto'
} as const;

export const PAYMENT_METHOD = {
  POR_CORTES: 'Por Cortes',
  ANTICIPO: 'Anticipo + Cortes',
  PRECIO_GLOBAL: 'Precio Global',
  ADMINISTRACION: 'Administración Delegada'
} as const;

export const CONTRACT_STATUS = {
  DRAFT: 'Borrador',
  ENABLED: 'Habilitado',
  SUSPENDED: 'Suspendido',
  CLOSED: 'Cerrado',
  CANCELLED: 'Cancelado'
} as const;

export const CONTRACT_DOCUMENT_TYPE = {
  CONTRATO: 'Contrato',
  POLIZA: 'Póliza',
  OTROS: 'Otros'
} as const;

export const REQUIRED_CONTRACT_DOCUMENTS = ['CONTRATO', 'POLIZA'] as const;

// =============================================
// CONSTANTES DE FLUJO DE PAGOS
// =============================================

export const PAYMENT_TYPE = {
  CORTE_OBRA: 'Corte de Obra',
  ANTICIPO: 'Anticipo',
  RETENCION: 'Retención',
  SUMINISTRO: 'Suministro',
  SERVICIOS: 'Servicios',
  HONORARIOS: 'Honorarios',
  OTROS: 'Otros'
} as const;

export const PAYMENT_PRIORITY = {
  LOW: 'Baja',
  NORMAL: 'Normal',
  HIGH: 'Alta',
  URGENT: 'Urgente'
} as const;

export const PAYMENT_PRIORITY_COLORS = {
  LOW: 'secondary',
  NORMAL: 'default',
  HIGH: 'warning',
  URGENT: 'destructive'
} as const;

export const PAYMENT_STATUS = {
  PENDING: 'Pendiente',
  APPROVED_LEVEL_1: 'Aprobado Nivel 1',
  APPROVED_LEVEL_2: 'Aprobado Nivel 2',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  PAID: 'Pagado',
  CANCELLED: 'Cancelado'
} as const;

export const PAYMENT_STATUS_COLORS = {
  PENDING: 'warning',
  APPROVED_LEVEL_1: 'default',
  APPROVED_LEVEL_2: 'default',
  APPROVED: 'success',
  REJECTED: 'destructive',
  PAID: 'success',
  CANCELLED: 'secondary'
} as const;

export const APPROVAL_ACTION = {
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  RETURNED: 'Devuelto'
} as const;

// Niveles de aprobación y roles asociados
export const APPROVAL_LEVELS = {
  1: { name: 'Director', roles: ['DIRECTOR', 'GERENTE', 'ADMIN'] },
  2: { name: 'Gerente', roles: ['GERENTE', 'ADMIN'] },
  3: { name: 'Administrador', roles: ['ADMIN'] }
} as const;

// Roles que pueden crear solicitudes de pago
export const ROLES_CAN_CREATE_PAYMENTS = ['ADMIN', 'GERENTE', 'DIRECTOR', 'RESIDENTE', 'CONTABILIDAD', 'TESORERIA'] as const;

// Roles que pueden marcar como pagado
export const ROLES_CAN_MARK_PAID = ['ADMIN', 'GERENTE', 'TESORERIA'] as const;

// =============================================
// CONSTANTES DE REPORTES FINANCIEROS
// =============================================

export const TAX_TYPE = {
  IVA: 'IVA',
  RETENCION_FUENTE: 'Retención en la Fuente',
  RETENCION_IVA: 'Retención de IVA',
  RETENCION_ICA: 'Retención de ICA',
  ESTAMPILLAS: 'Estampillas',
  OTROS: 'Otros'
} as const;

export const TAX_APPLIES_TO = {
  VENTAS: 'Ventas',
  COMPRAS: 'Compras',
  AMBOS: 'Ambos'
} as const;

// Impuestos predeterminados para Colombia
export const DEFAULT_TAXES_COLOMBIA = [
  { name: 'IVA 19%', rate: 19, type: 'IVA', appliesTo: 'VENTAS' },
  { name: 'Retención Fuente 11%', rate: 11, type: 'RETENCION_FUENTE', appliesTo: 'COMPRAS' },
  { name: 'Retención IVA 15%', rate: 15, type: 'RETENCION_IVA', appliesTo: 'COMPRAS' },
  { name: 'Retención ICA 0.966%', rate: 0.966, type: 'RETENCION_ICA', appliesTo: 'COMPRAS' }
] as const;

// Roles que pueden configurar impuestos
export const ROLES_CAN_CONFIGURE_TAXES = ['ADMIN', 'GERENTE', 'CONTABILIDAD'] as const;

// =============================================
// CONSTANTES DE RRHH
// =============================================

export const EMPLOYEE_DEPARTMENT = {
  GERENCIA: 'Gerencia',
  OPERACIONES: 'Operaciones',
  CONTABILIDAD: 'Contabilidad',
  TESORERIA: 'Tesorería',
  HSEQ: 'HSEQ',
  COMERCIAL: 'Comercial',
  ADMINISTRATIVO: 'Administrativo'
} as const;

export const EMPLOYEE_CONTRACT_TYPE = {
  INDEFINIDO: 'Término Indefinido',
  FIJO: 'Término Fijo',
  OBRA_LABOR: 'Obra o Labor',
  PRESTACION: 'Prestación de Servicios',
  APRENDIZAJE: 'Aprendizaje'
} as const;

export const EMPLOYEE_STATUS = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  ON_LEAVE: 'En Licencia',
  TERMINATED: 'Terminado'
} as const;

export const EMPLOYEE_STATUS_COLORS = {
  ACTIVE: 'success',
  INACTIVE: 'secondary',
  ON_LEAVE: 'warning',
  TERMINATED: 'destructive'
} as const;

export const EMPLOYEE_DOCUMENT_TYPE = {
  CEDULA: 'Cédula de Ciudadanía',
  CONTRATO: 'Contrato de Trabajo',
  AFILIACION_EPS: 'Afiliación EPS',
  AFILIACION_PENSION: 'Afiliación Pensión',
  AFILIACION_ARL: 'Afiliación ARL',
  EXAMEN_INGRESO: 'Examen Médico de Ingreso',
  EXAMEN_PERIODICO: 'Examen Médico Periódico',
  CERTIFICACION_ALTURAS: 'Certificación Trabajo en Alturas',
  LICENCIA_CONDUCIR: 'Licencia de Conducción',
  CURSO_SST: 'Curso SST 50 Horas',
  TITULO_PROFESIONAL: 'Título Profesional',
  DIPLOMA: 'Diploma',
  LIBRETA_MILITAR: 'Libreta Militar',
  CERTIFICADOS_EXPERIENCIA: 'Certificados de Experiencia',
  OTROS: 'Otros'
} as const;

// Documentos requeridos para empleados
export const REQUIRED_EMPLOYEE_DOCUMENTS = [
  'CEDULA',
  'CONTRATO',
  'AFILIACION_EPS',
  'AFILIACION_PENSION',
  'AFILIACION_ARL',
  'EXAMEN_INGRESO'
] as const;

// Documentos con vencimiento
export const EXPIRABLE_EMPLOYEE_DOCUMENTS = [
  'EXAMEN_PERIODICO',
  'CERTIFICACION_ALTURAS',
  'LICENCIA_CONDUCIR',
  'CURSO_SST'
] as const;

// Roles que pueden gestionar RRHH
export const ROLES_CAN_MANAGE_HR = ['ADMIN', 'GERENTE', 'CONTABILIDAD'] as const;

// Roles que pueden ver información de RRHH
export const ROLES_CAN_VIEW_HR = ['ADMIN', 'GERENTE', 'CONTABILIDAD', 'HSEQ'] as const;

// =============================================
// CONSTANTES DE PROGRAMACIÓN Y AVANCE
// =============================================

export const WEATHER_OPTIONS = {
  SOLEADO: 'Soleado',
  NUBLADO: 'Nublado',
  LLUVIOSO: 'Lluvioso',
  TORMENTOSO: 'Tormentoso',
  VENTOSO: 'Ventoso'
} as const;

// Roles que pueden registrar avance
export const ROLES_CAN_CREATE_PROGRESS = ['ADMIN', 'GERENTE', 'DIRECTOR', 'RESIDENTE'] as const;

// Roles que pueden ver programación
export const ROLES_CAN_VIEW_PROGRESS = ['ADMIN', 'GERENTE', 'DIRECTOR', 'RESIDENTE', 'CLIENTE'] as const;

// =============================================
// CONSTANTES DE VENTAS / CRM
// =============================================

export const CLIENT_SOURCE = {
  REFERIDO: 'Referido',
  WEB: 'Sitio Web',
  REDES_SOCIALES: 'Redes Sociales',
  FERIA: 'Feria/Evento',
  LLAMADA_FRIA: 'Llamada en Frío',
  OTROS: 'Otros'
} as const;

export const CLIENT_STATUS = {
  PROSPECT: 'Prospecto',
  CONTACTED: 'Contactado',
  QUALIFIED: 'Calificado',
  PROPOSAL: 'En Propuesta',
  NEGOTIATION: 'En Negociación',
  WON: 'Cliente Ganado',
  LOST: 'Cliente Perdido'
} as const;

export const CLIENT_STATUS_COLORS = {
  PROSPECT: 'secondary',
  CONTACTED: 'default',
  QUALIFIED: 'default',
  PROPOSAL: 'warning',
  NEGOTIATION: 'warning',
  WON: 'success',
  LOST: 'destructive'
} as const;

export const QUOTATION_STATUS = {
  DRAFT: 'Borrador',
  SENT: 'Enviada',
  VIEWED: 'Vista',
  ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada',
  EXPIRED: 'Expirada',
  CANCELLED: 'Cancelada'
} as const;

export const QUOTATION_STATUS_COLORS = {
  DRAFT: 'secondary',
  SENT: 'default',
  VIEWED: 'default',
  ACCEPTED: 'success',
  REJECTED: 'destructive',
  EXPIRED: 'warning',
  CANCELLED: 'secondary'
} as const;

// Unidades comunes para cotizaciones
export const QUOTATION_UNITS = [
  { value: 'un', label: 'Unidad (un)' },
  { value: 'm2', label: 'Metro cuadrado (m²)' },
  { value: 'ml', label: 'Metro lineal (ml)' },
  { value: 'm3', label: 'Metro cúbico (m³)' },
  { value: 'kg', label: 'Kilogramo (kg)' },
  { value: 'gl', label: 'Global (gl)' },
  { value: 'hr', label: 'Hora (hr)' },
  { value: 'dia', label: 'Día' },
  { value: 'mes', label: 'Mes' }
] as const;

// Roles que pueden ver ventas/CRM
export const ROLES_CAN_VIEW_SALES = ['ADMIN', 'GERENTE', 'DIRECTOR'] as const;

// Roles que pueden gestionar ventas/CRM
export const ROLES_CAN_MANAGE_SALES = ['ADMIN', 'GERENTE'] as const;

// =============================================
// CONSTANTES DE PROVEEDORES
// =============================================

export const SUPPLIER_STATUS = {
  COMPLETE: 'Completo',
  INCOMPLETE: 'Incompleto',
  EXPIRED: 'Vencido'
} as const;

export const SUPPLIER_PERSON_TYPE = {
  NATURAL: 'Persona natural',
  JURIDICA: 'Persona jurídica'
} as const;

export const SUPPLIER_COMMERCIAL_TYPE = {
  PRODUCTO: 'Producto',
  SERVICIO: 'Servicio'
} as const;

export const SUPPLIER_PRODUCT_SUBCATEGORY = {
  ELECTRICO: 'Eléctrico',
  AIRES_ACONDICIONADOS: 'Aires acondicionados',
  HIDRAULICO: 'Hidráulico',
  OBRA_CIVIL: 'Obra civil',
  RED_CONTRA_INCENDIOS: 'Red contra incendios',
  DRYWALL: 'Drywall',
  PISOS: 'Pisos',
  ACABADOS: 'Acabados',
  OTROS: 'Otros'
} as const;

export const SUPPLIER_SERVICE_SUBCATEGORY = {
  ALQUILER: 'Alquiler',
  TRANSPORTE: 'Transporte',
  MANO_DE_OBRA: 'Mano de obra',
  CAPACITACIONES: 'Capacitaciones',
  GASTOS_MEDICOS: 'Gastos médicos',
  HONORARIOS: 'Honorarios',
  OTROS: 'Otros'
} as const;

export const SUPPLIER_CATEGORY = {
  MATERIALES: 'Materiales de Construcción',
  FERRETERIA: 'Ferretería',
  ACABADOS: 'Acabados',
  ELECTRICO: 'Eléctrico',
  HIDRAULICO: 'Hidráulico',
  MAQUINARIA: 'Maquinaria y Equipos',
  TRANSPORTE: 'Transporte',
  OTROS: 'Otros'
} as const;

export const SUPPLIER_DOCUMENT_TYPE = {
  CEDULA: 'Cédula de Ciudadanía',
  RUT: 'RUT',
  CAMARA_COMERCIO: 'Cámara de Comercio',
  CERTIFICADO_BANCARIO: 'Certificado Bancario'
} as const;

// Roles que pueden gestionar proveedores
export const ROLES_CAN_MANAGE_SUPPLIERS = ['ADMIN', 'GERENTE', 'DIRECTOR', 'CONTABILIDAD'] as const;
