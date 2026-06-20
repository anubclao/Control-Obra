// Tipos centrales del sistema Control de Obra Pro
// Basados en el PRD v1.0

export type Role =
  | "ADMIN"
  | "GERENTE"
  | "DIRECTOR"
  | "RESIDENTE"
  | "CONTABILIDAD"
  | "TESORERIA"
  | "HSEQ"
  | "CLIENTE"
  | "USER";

export type Area = "tecnico" | "administrativo" | "ventas";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  area: Area;
  avatar?: string;
}

export type ProjectStatus = "IN_PLANNING" | "IN_EXECUTION" | "PAUSED" | "COMPLETED";

export interface Project {
  id: string;
  code: string;
  name: string;
  client: string;
  location: string;
  startDate: string;
  estimatedEndDate: string;
  totalBudget: number;
  executedAmount: number;
  status: ProjectStatus;
  description?: string;
}

export type WorkCutStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "VALIDATED"
  | "APPROVED"
  | "REJECTED"
  | "PAID";

export interface WorkCutItem {
  id: string;
  description: string;
  unit: string; // M2, ML, UN, GL
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  budgetItemCode?: string; // Vinculación con PT/PSC (opcional)
}

export type WorkCutDocumentType = "ACTA" | "FACTURA" | "SOPORTE" | "OTROS";

export interface WorkCutDocument {
  id: string;
  type: WorkCutDocumentType;
  fileName: string;
  uploadedAt: string;
}

export type ApprovalAction = "SUBMIT" | "VALIDATE" | "APPROVE" | "REJECT" | "PAY";

export interface WorkCutApproval {
  id: string;
  action: ApprovalAction;
  userId: string;
  userName: string;
  userRole: string;
  comments?: string;
  createdAt: string;
}

export interface WorkCut {
  id: string;
  cutNumber: string;
  projectId: string;
  providerId: string;
  description: string;
  periodStart: string;
  periodEnd: string;
  items: WorkCutItem[];
  grossValue: number;
  retentionPercent: number; // ej: 10
  retentionValue: number;
  advanceDeduction: number;
  netValue: number;
  status: WorkCutStatus;
  documents: WorkCutDocument[];
  approvals: WorkCutApproval[];
  submittedAt?: string;
  validatedAt?: string;
  approvedAt?: string;
  paidAt?: string;
  rejectionReason?: string;
  createdBy: string; // userId
  createdAt: string;
}

export type ClientStatus =
  | "PROSPECT"
  | "CONTACTED"
  | "QUALIFIED"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "WON"
  | "LOST";

export interface Client {
  id: string;
  clientNumber: string;
  companyName: string;
  nit?: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  sector?: string;
  source: "REFERIDO" | "WEB" | "REDES_SOCIALES" | "FERIA" | "LLAMADA_FRIA" | "OTROS";
  status: ClientStatus;
}

export type QuotationStatus =
  | "DRAFT"
  | "SENT"
  | "VIEWED"
  | "ACCEPTED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED";

export interface QuotationItem {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  clientId: string;
  title: string;
  description?: string;
  status: QuotationStatus;
  items: QuotationItem[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  ivaPercent: number;
  ivaAmount: number;
  total: number;
  validUntil: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  warranty?: string;
  observations?: string;
  sentAt?: string;
  viewedAt?: string;
  respondedAt?: string;
  // Si fue aceptada y se convirtió en proyecto
  convertedToProjectId?: string;
  createdBy?: string;
  createdAt: string;
}

export type PaymentStatus =
  | "PENDING"
  | "APPROVED_LEVEL_1"
  | "APPROVED_LEVEL_2"
  | "APPROVED"
  | "REJECTED"
  | "PAID"
  | "CANCELLED";

export type WeatherCondition =
  | "SOLEADO"
  | "NUBLADO"
  | "LLUVIOSO"
  | "TORMENTA"
  | "VIENTO"
  | "NIEBLA"
  | "OTRO";

export interface WorkLogPhoto {
  id: string;
  fileName: string;
  caption?: string;
  uploadedAt: string;
}

export interface WorkLog {
  id: string;
  projectId: string;
  date: string; // único por proyecto+fecha
  weather: WeatherCondition;
  temperature?: number; // °C
  workersCount: number;
  activities: string;
  incidents?: string;
  materials?: string;
  observations?: string;
  photos: WorkLogPhoto[];
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export type PaymentType =
  | "CORTE_OBRA"
  | "ANTICIPO"
  | "RETENCION"
  | "SUMINISTRO"
  | "SERVICIOS"
  | "HONORARIOS"
  | "OTROS";

export type PaymentPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type PaymentAction = "APPROVE_L1" | "APPROVE_L2" | "PAY" | "REJECT" | "CANCEL";

export interface PaymentApproval {
  id: string;
  action: PaymentAction;
  level?: 1 | 2;
  userId: string;
  userName: string;
  userRole: string;
  comments?: string;
  createdAt: string;
  paymentReference?: string; // Para PAY: comprobante de pago
  paymentMethod?: "TRANSFER" | "CHECK" | "CASH";
}

export interface PaymentRequest {
  id: string;
  requestNumber: string;
  projectId: string;
  providerId?: string;
  workCutId?: string; // Si viene de un corte aprobado
  type: PaymentType;
  amount: number;
  priority: PaymentPriority;
  status: PaymentStatus;
  currentApprovalLevel: number; // 0, 1, 2
  requiredApprovalLevel: number; // 1 o 2 (o 3 para montos altos)
  // Datos bancarios
  beneficiaryName: string;
  beneficiaryNit: string;
  bankName: string;
  accountType: "SAVINGS" | "CHECKING";
  accountNumber: string;
  dueDate?: string;
  description?: string;
  approvals: PaymentApproval[];
  paidAt?: string;
  paidReference?: string;
  paidMethod?: "TRANSFER" | "CHECK" | "CASH";
  rejectionReason?: string;
  createdBy: string;
  createdAt: string;
}

// Proveedor — unifica Subcontratista + Proveedor según rediseño
export type ProviderStatus = "COMPLETE" | "INCOMPLETE" | "EXPIRED";

export type PersonType = "NATURAL" | "JURIDICA";

export type ProviderCategory = "PRODUCTO" | "SERVICIO";

// Subcategorías — fijas para selección directa; "OTROS" permite texto libre
export const PROVIDER_PRODUCT_SUBCATEGORIES = [
  "ELECTRICO",
  "AIRES_ACONDICIONADOS",
  "HIDRAULICO",
  "OBRA_CIVIL",
  "RED_CONTRA_INCENDIOS",
  "DRYWALL",
  "PISOS",
  "ACABADOS",
  "OTROS",
] as const;

export const PROVIDER_SERVICE_SUBCATEGORIES = [
  "ALQUILER",
  "TRANSPORTE",
  "MANO_DE_OBRA",
  "CAPACITACIONES",
  "GASTOS_MEDICOS",
  "HONORARIOS",
  "OTROS",
] as const;

export type ProviderProductSubcategory = (typeof PROVIDER_PRODUCT_SUBCATEGORIES)[number];
export type ProviderServiceSubcategory = (typeof PROVIDER_SERVICE_SUBCATEGORIES)[number];
export type ProviderSubcategory = ProviderProductSubcategory | ProviderServiceSubcategory;

export type ProviderDocumentType =
  | "CEDULA"
  | "RUT"
  | "CAMARA_COMERCIO"
  | "CERTIFICADO_BANCARIO"
  | "CERTIFICACIONES_COMERCIALES"
  | "OTROS";

export interface ProviderDocument {
  id: string;
  type: ProviderDocumentType;
  fileName: string;
  uploadedAt: string;
  expirationDate?: string;
}

export interface ProviderReference {
  name: string;
  company: string;
  phone: string;
  email: string;
}

export interface Provider {
  id: string;
  // Tipo de persona (obligatorio)
  personType: PersonType;
  // Nombre/Razón social según tipo de persona
  name: string;
  // CC (NATURAL) o NIT (JURIDICA)
  nit: string;
  contact: string;
  email: string;
  // Segundo email opcional (PDF: PODER INCLUIR MAS DE 01 EMAIL)
  email2?: string;
  phone: string;
  // Segundo teléfono opcional (PDF: PODER INCLUIR MAS DE 01 TELEFONO)
  phone2?: string;
  website?: string;
  address?: string;
  city?: string;
  department?: string;
  postalCode?: string;
  // Categoría y subcategoría (PDF: PRODUCTO o SERVICIO con subcategorías)
  category?: ProviderCategory;
  subcategory?: ProviderSubcategory;
  // Texto libre cuando subcategory = OTROS
  subcategoryOther?: string;
  // Representante legal — solo JURIDICA
  legalRepName?: string;
  legalRepCedula?: string;
  legalRepEmail?: string;
  legalRepPhone?: string;
  reportedIncome?: number;
  incomeYear?: number;
  references: ProviderReference[];
  status: ProviderStatus;
  rating?: number;
  documents: ProviderDocument[];
  notes?: string;
  createdAt: string;
}

// Presupuesto (PT) - estructura jerárquica 3 niveles
export type BudgetLayerType = "CHAPTER" | "SUBCHAPTER" | "ITEM";

export interface BudgetItem {
  id: string;
  layerId: string;
  description: string;
  unit: string; // M2, ML, UN, GL
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  executedQuantity: number;
  executedAmount: number;
}

export interface BudgetLayer {
  id: string;
  budgetId: string;
  code: string; // "1", "1.1", "1.1.1"
  name: string;
  layerType: BudgetLayerType;
  parentId?: string;
  items: BudgetItem[];
}

export interface BudgetVersion {
  id: string;
  budgetId: string;
  version: number;
  isActive: boolean;
  totalValue: number;
  createdAt: string;
  notes?: string;
}

export interface Budget {
  id: string;
  projectId: string;
  // Solo 1 PT por proyecto (regla del cuello de botella)
  versions: BudgetVersion[]; // histórico de versiones
  activeVersionId: string;
  // PRESUPUESTO TOPE — con el que se trabaja en obra para contratar (PDF p.6)
  layers: BudgetLayer[]; // estructura jerárquica
  totalValue: number;
  // PRESUPUESTO CLIENTE — lo que el cliente aprobó (PDF p.3)
  clientLayers: BudgetLayer[];
  clientValue: number;
  // ITEMS NO PREVISTOS — se crean durante la obra y se auto-suman al tope (PDF p.5)
  unforeseenItems: BudgetItem[];
  unforeseenValue: number;
  createdAt: string;
}

// AIU - Administración, Imprevistos, Utilidad
export interface AiuConfig {
  id: string;
  projectId: string;
  administration: number;
  imprevistos: number;
  utilidad: number;
  notes?: string;
  updatedBy?: string;
  updatedAt: string;
}

// Contratos
export type ContractType = "OBRA" | "SUMINISTRO" | "SERVICIOS" | "CONSULTORIA";
export type ContractStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED" | "SUSPENDED";

export type ContractDocumentType =
  | "CONTRATO_FIRMADO"
  | "POLIZA_CUMPLIMIENTO"
  | "POLIZA_RESPONSABILIDAD"
  | "POLIZA_ANTICIPO"
  | "ACTA_INICIO"
  | "OTROS";

export interface ContractDocument {
  id: string;
  type: ContractDocumentType;
  fileName: string;
  uploadedAt: string;
  expirationDate?: string;
}

export interface Contract {
  id: string;
  contractNumber: string;
  projectId: string;
  providerId: string;
  type: ContractType;
  value: number;
  startDate: string;
  endDate: string;
  status: ContractStatus;
  scopeOfWork: string;
  retentionPercent: number;
  advancePercent: number;
  documents: ContractDocument[];
  notes?: string;
  createdBy?: string;
  createdAt: string;
}

// Impuestos
export type TaxType =
  | "IVA"
  | "RETENCION_FUENTE"
  | "RETENCION_IVA"
  | "RETENCION_ICA"
  | "ESTAMPILLAS"
  | "OTROS";

export type TaxAppliesTo = "VENTAS" | "COMPRAS" | "AMBOS";

export interface TaxConfig {
  id: string;
  projectId?: string; // opcional: si está vacío aplica a todos
  name: string;
  rate: number; // %
  type: TaxType;
  appliesTo: TaxAppliesTo;
  isActive: boolean;
  notes?: string;
  createdAt: string;
}

// RRHH - Empleados
export type EmployeeStatus = "ACTIVE" | "INACTIVE" | "ON_LEAVE" | "TERMINATED";
export type EmployeeDepartment =
  | "GERENCIA"
  | "OPERACIONES"
  | "CONTABILIDAD"
  | "TESORERIA"
  | "HSEQ"
  | "COMERCIAL"
  | "ADMINISTRATIVO";
export type EmployeeContractType =
  | "INDEFINIDO"
  | "FIJO"
  | "OBRA_LABOR"
  | "PRESTACION"
  | "APRENDIZAJE";

export type EmployeeDocumentType =
  | "CEDULA"
  | "CONTRATO"
  | "AFILIACION_EPS"
  | "AFILIACION_PENSION"
  | "AFILIACION_ARL"
  | "EXAMEN_INGRESO"
  | "EXAMEN_PERIODICO"
  | "CERTIFICACION_ALTURAS"
  | "LICENCIA_CONDUCIR"
  | "CURSO_SST"
  | "OTROS";

export interface EmployeeDocument {
  id: string;
  type: EmployeeDocumentType;
  fileName: string;
  uploadedAt: string;
  expirationDate?: string;
}

export interface Employee {
  id: string;
  employeeNumber: string; // EMP-0001
  fullName: string;
  documentId: string; // cédula
  position: string;
  department: EmployeeDepartment;
  contractType: EmployeeContractType;
  startDate: string;
  endDate?: string;
  salary?: number;
  eps?: string;
  pensionFund?: string;
  arl?: string;
  riskLevel?: 1 | 2 | 3 | 4 | 5;
  bankName?: string;
  accountType?: "SAVINGS" | "CHECKING";
  accountNumber?: string;
  email?: string;
  phone?: string;
  status: EmployeeStatus;
  userId?: string; // vínculo con usuario del sistema
  documents: EmployeeDocument[];
  createdAt: string;
}

// Invitaciones
export type InvitationStatus = "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED";

export interface Invitation {
  id: string;
  code: string; // 8 caracteres
  email: string;
  role: Role;
  area?: Area;
  projectId?: string;
  status: InvitationStatus;
  maxUses: number; // default 1
  uses: number;
  expiresAt: string;
  createdBy: string;
  createdAt: string;
  acceptedBy?: string;
  acceptedAt?: string;
}

// PSC - Presupuesto Proveedor (espejo del PT)
// Cada PSC está vinculado a un PT (projectId) y a un proveedor
// Contiene los items del PT que ese proveedor cubrirá
export type PSCStatus = "DRAFT" | "ACTIVE" | "SUSPENDED" | "COMPLETED" | "CANCELLED";

export interface PSCItem {
  id: string;
  // Referencia al item del PT (BudgetItem.id)
  budgetItemId: string;
  description: string;
  unit: string;
  // Cantidad contratada (puede ser menor a la del PT si se reparte entre contratistas)
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  // Avance ejecutado contra este item
  executedQuantity: number;
  executedAmount: number;
}

export interface PSC {
  id: string;
  // pscNumber: PSC-2026-0001
  pscNumber: string;
  projectId: string;
  // ID del PT del cual se copia la estructura
  budgetId: string;
  // Proveedor (antes contratista) que cubre estos items
  providerId: string;
  // Items espejo (subset del PT)
  items: PSCItem[];
  // Total contratado al proveedor
  totalValue: number;
  status: PSCStatus;
  notes?: string;
  startDate?: string;
  endDate?: string;
  createdBy?: string;
  createdAt: string;
}

// Registro de Gastos — PDF p.7-14
// 13 tipos documentales unificados bajo un solo flujo
export type ExpenseType =
  | "CONTRATO_OBRA_CIVIL_POLIZAS"
  | "CONTRATO_OBRA_CIVIL_SIN_POLIZAS"
  | "PRESTACION_SERVICIOS"
  | "LABORAL_OBRA"
  | "LABORAL_TERMINO_INDEFINIDO"
  | "LABORAL_TERMINO_DEFINIDO"
  | "ORDEN_SERVICIO_POLIZAS"
  | "ORDEN_SERVICIO_SIN_POLIZAS"
  | "ORDEN_COMPRA_POLIZAS"
  | "ORDEN_COMPRA_SIN_POLIZAS"
  | "SOLICITUD_RECURSO"
  | "SOLICITUD_REINTEGRO"
  | "LEGALIZACION_GASTO";

export type ExpenseStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "PAID";

export interface ExpenseItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  // Soporte (PDF p.13: en cada item se cargan facturas, cuentas de cobro, recibos)
  attachments?: string[]; // nombres de archivos (mock)
}

export interface Expense {
  id: string;
  expenseNumber: string; // GASTO-2026-0001
  projectId: string;
  providerId: string;
  type: ExpenseType;
  description: string;
  amount: number;
  date: string;
  status: ExpenseStatus;
  // Campos según tipo (PDF p.8-9)
  advancePercent?: number;          // anticipo del contrato (%)
  hasPolizas?: boolean;             // si aplica pólizas
  polizasVigenciaDesde?: string;    // PDF p.9
  polizasVigenciaHasta?: string;    // PDF p.9
  cotizacionAprobada?: boolean;     // PDF p.8
  // Items del gasto
  items: ExpenseItem[];
  // Aprobación (solo Super Admin — PDF p.8/21)
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectedReason?: string;
  notes?: string;
}
