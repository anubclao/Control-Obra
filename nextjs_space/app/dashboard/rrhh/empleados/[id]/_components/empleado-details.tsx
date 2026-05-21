'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  User,
  Building2,
  Briefcase,
  Calendar,
  Heart,
  CreditCard,
  FileText,
  Upload,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Clock,
  Mail,
  Phone,
  Download,
  Trash2,
  Edit
} from 'lucide-react';
import {
  EMPLOYEE_STATUS,
  EMPLOYEE_STATUS_COLORS,
  EMPLOYEE_DEPARTMENT,
  EMPLOYEE_CONTRACT_TYPE,
  EMPLOYEE_DOCUMENT_TYPE,
  ROLES_CAN_MANAGE_HR
} from '@/lib/constants';
import { formatDate, formatShortDate, formatCurrency } from '@/lib/format';
import DocumentUploadDialog from './document-upload-dialog';
import EditEmployeeDialog from './edit-employee-dialog';

interface Document {
  id: string;
  type: string;
  fileName: string;
  cloudStoragePath: string;
  isPublic: boolean;
  expirationDate?: Date | string | null;
  uploadedAt: Date | string;
  notes?: string | null;
}

interface Employee {
  id: string;
  employeeNumber: string;
  position: string;
  department: string;
  contractType: string;
  startDate: Date | string;
  endDate?: Date | string | null;
  salary?: number | null;
  legalBonus?: number | null;
  extraLegalBonus?: number | null;
  eps?: string | null;
  pensionFund?: string | null;
  arl?: string | null;
  riskLevel: number;
  bankName?: string | null;
  accountType?: string | null;
  accountNumber?: string | null;
  status: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    phone?: string | null;
  } | null;
  documents: Document[];
}

interface DocumentAlerts {
  missing: string[];
  expired: { type: string; daysAgo: number }[];
  expiringSoon: { type: string; daysLeft: number }[];
}

interface EmpleadoDetailsProps {
  employee: Employee;
  documentAlerts: DocumentAlerts;
  userRole: string;
}

export default function EmpleadoDetails({ employee, documentAlerts, userRole }: EmpleadoDetailsProps) {
  const router = useRouter();
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const canManage = ROLES_CAN_MANAGE_HR.includes(userRole as (typeof ROLES_CAN_MANAGE_HR)[number]);
  const hasAlerts = documentAlerts.missing.length > 0 || documentAlerts.expired.length > 0 || documentAlerts.expiringSoon.length > 0;

  const getStatusBadge = (status: string) => {
    const colorKey = status as keyof typeof EMPLOYEE_STATUS_COLORS;
    const variant = EMPLOYEE_STATUS_COLORS[colorKey] as 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
    const statusKey = status as keyof typeof EMPLOYEE_STATUS;
    return (
      <Badge variant={variant} className="text-sm">
        {EMPLOYEE_STATUS[statusKey] || status}
      </Badge>
    );
  };

  const handleDownload = async (cloudStoragePath: string, fileName: string, isPublic: boolean) => {
    try {
      const response = await fetch(`/api/files/download?path=${encodeURIComponent(cloudStoragePath)}&isPublic=${isPublic}`);
      if (response.ok) {
        const data = await response.json();
        const link = document.createElement('a');
        link.href = data.url;
        link.download = fileName;
        link.click();
      }
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/rrhh/empleados">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">
                {employee.user?.name || 'Sin usuario vinculado'}
              </h1>
              {getStatusBadge(employee.status)}
            </div>
            <p className="text-gray-500 flex items-center gap-2 mt-1">
              <span className="font-mono">{employee.employeeNumber}</span>
              <span>•</span>
              <span>{employee.position}</span>
            </p>
          </div>
        </div>
        {canManage && (
          <Button variant="outline" onClick={() => setShowEditDialog(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
        )}
      </div>

      {/* Alertas */}
      {hasAlerts && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-5 w-5" />
              Alertas de Documentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {documentAlerts.expired.length > 0 && (
                <div className="bg-red-100 p-3 rounded-lg">
                  <p className="font-medium text-red-800 flex items-center gap-1">
                    <XCircle className="h-4 w-4" />
                    Vencidos
                  </p>
                  <ul className="mt-2 space-y-1">
                    {documentAlerts.expired.map((doc, idx) => (
                      <li key={idx} className="text-sm text-red-700">
                        {EMPLOYEE_DOCUMENT_TYPE[doc.type as keyof typeof EMPLOYEE_DOCUMENT_TYPE] || doc.type}
                        <span className="text-xs"> (hace {doc.daysAgo} días)</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {documentAlerts.expiringSoon.length > 0 && (
                <div className="bg-yellow-100 p-3 rounded-lg">
                  <p className="font-medium text-yellow-800 flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Por Vencer
                  </p>
                  <ul className="mt-2 space-y-1">
                    {documentAlerts.expiringSoon.map((doc, idx) => (
                      <li key={idx} className="text-sm text-yellow-700">
                        {EMPLOYEE_DOCUMENT_TYPE[doc.type as keyof typeof EMPLOYEE_DOCUMENT_TYPE] || doc.type}
                        <span className="text-xs"> ({doc.daysLeft} días)</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {documentAlerts.missing.length > 0 && (
                <div className="bg-gray-100 p-3 rounded-lg">
                  <p className="font-medium text-gray-800 flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    Faltantes
                  </p>
                  <ul className="mt-2 space-y-1">
                    {documentAlerts.missing.map((docType, idx) => (
                      <li key={idx} className="text-sm text-gray-700">
                        {EMPLOYEE_DOCUMENT_TYPE[docType as keyof typeof EMPLOYEE_DOCUMENT_TYPE] || docType}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Información del Usuario */}
        {employee.user && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Usuario del Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-gray-400" />
                <span>{employee.user.email}</span>
              </div>
              {employee.user.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span>{employee.user.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Briefcase className="h-4 w-4 text-gray-400" />
                <Badge variant="outline">{employee.user.role}</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Información Laboral */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Información Laboral
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Cargo</p>
                <p className="font-medium">{employee.position}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Departamento</p>
                <p className="font-medium">
                  {EMPLOYEE_DEPARTMENT[employee.department as keyof typeof EMPLOYEE_DEPARTMENT] || employee.department}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Tipo de Contrato</p>
                <p className="font-medium">
                  {EMPLOYEE_CONTRACT_TYPE[employee.contractType as keyof typeof EMPLOYEE_CONTRACT_TYPE] || employee.contractType}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Fecha de Ingreso</p>
                <p className="font-medium">{formatShortDate(employee.startDate)}</p>
              </div>
              {employee.endDate && (
                <div>
                  <p className="text-sm text-gray-500">Fecha de Terminación</p>
                  <p className="font-medium">{formatShortDate(employee.endDate)}</p>
                </div>
              )}
              {employee.salary && (
                <div>
                  <p className="text-sm text-gray-500">Salario Base</p>
                  <p className="font-medium">{formatCurrency(employee.salary)}</p>
                </div>
              )}
              {employee.legalBonus && (
                <div>
                  <p className="text-sm text-gray-500">Auxilio Legal</p>
                  <p className="font-medium">{formatCurrency(employee.legalBonus)}</p>
                </div>
              )}
              {employee.extraLegalBonus && (
                <div>
                  <p className="text-sm text-gray-500">Auxilio Extralegal</p>
                  <p className="font-medium">{formatCurrency(employee.extraLegalBonus)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Seguridad Social */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Seguridad Social
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">EPS</p>
                <p className="font-medium">{employee.eps || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Fondo de Pensiones</p>
                <p className="font-medium">{employee.pensionFund || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">ARL</p>
                <p className="font-medium">{employee.arl || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Nivel de Riesgo</p>
                <p className="font-medium">Nivel {employee.riskLevel}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Información Bancaria */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Información Bancaria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Banco</p>
                <p className="font-medium">{employee.bankName || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Tipo de Cuenta</p>
                <p className="font-medium">
                  {employee.accountType === 'AHORROS' ? 'Ahorros' : employee.accountType === 'CORRIENTE' ? 'Corriente' : '-'}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-gray-500">Número de Cuenta</p>
                <p className="font-medium font-mono">{employee.accountNumber || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Documentos */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documentos ({employee.documents.length})
              </CardTitle>
              <CardDescription>Documentos corporativos del empleado</CardDescription>
            </div>
            {canManage && (
              <Button onClick={() => setShowUploadDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Subir Documento
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {employee.documents.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No hay documentos cargados</p>
              {canManage && (
                <Button variant="outline" className="mt-4" onClick={() => setShowUploadDialog(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Subir Primer Documento
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {employee.documents.map((doc) => {
                const isExpired = doc.expirationDate && new Date(doc.expirationDate) < new Date();
                const isExpiringSoon = doc.expirationDate && !isExpired && 
                  (new Date(doc.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24) <= 30;

                return (
                  <div 
                    key={doc.id} 
                    className={`border rounded-lg p-4 ${
                      isExpired ? 'border-red-200 bg-red-50' : 
                      isExpiringSoon ? 'border-yellow-200 bg-yellow-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isExpired ? (
                          <XCircle className="h-5 w-5 text-red-500" />
                        ) : isExpiringSoon ? (
                          <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        ) : (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        )}
                        <div>
                          <p className="font-medium">
                            {EMPLOYEE_DOCUMENT_TYPE[doc.type as keyof typeof EMPLOYEE_DOCUMENT_TYPE] || doc.type}
                          </p>
                          <p className="text-sm text-gray-500">{doc.fileName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-sm">
                          <p className="text-gray-500">Subido: {formatShortDate(doc.uploadedAt)}</p>
                          {doc.expirationDate && (
                            <p className={isExpired ? 'text-red-600' : isExpiringSoon ? 'text-yellow-600' : 'text-gray-500'}>
                              Vence: {formatShortDate(doc.expirationDate)}
                            </p>
                          )}
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDownload(doc.cloudStoragePath, doc.fileName, doc.isPublic)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {doc.notes && (
                      <p className="mt-2 text-sm text-gray-600 border-t pt-2">{doc.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <DocumentUploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        employeeId={employee.id}
        onSuccess={() => {
          setShowUploadDialog(false);
          router.refresh();
        }}
      />

      {/* Edit Dialog */}
      <EditEmployeeDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        employee={employee}
        onSuccess={() => {
          setShowEditDialog(false);
          router.refresh();
        }}
      />
    </div>
  );
}
