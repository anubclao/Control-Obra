'use client';

import { useState } from 'react';
import type { ComponentProps } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Search,
  Plus,
  DollarSign,
  FileText,
  Building2,
  Calendar,
  ChevronRight
} from 'lucide-react';
import { formatCurrency, formatShortDate } from '@/lib/format';
import {
  PAYMENT_STATUS,
  PAYMENT_PRIORITY,
  PAYMENT_TYPE,
  PAYMENT_STATUS_COLORS,
  PAYMENT_PRIORITY_COLORS,
  ROLES_CAN_CREATE_PAYMENTS
} from '@/lib/constants';
import { NuevoPagoDialog } from './nuevo-pago-dialog';

type PaymentStatusKey = keyof typeof PAYMENT_STATUS;
type PaymentPriorityKey = keyof typeof PAYMENT_PRIORITY;
type PaymentTypeKey = keyof typeof PAYMENT_TYPE;
type PaymentRoleKey = (typeof ROLES_CAN_CREATE_PAYMENTS)[number];
type BadgeVariant = ComponentProps<typeof Badge>['variant'];

interface Payment {
  id: string;
  paymentNumber: string;
  concept: string;
  amount: number;
  paymentType: string;
  priority: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
  project: { id: string; name: string; code: string | null };
  contractor: { id: string; name: string; nit: string } | null;
  workCut: { id: string; cutNumber: number } | null;
  contract: { id: string; contractNumber: string } | null;
  createdBy: { id: string; name: string; email: string };
  currentApprovalLevel: number;
  requiredApprovalLevel: number;
  approvals: unknown[];
  _count: { documents: number };
}

interface PagosClientProps {
  payments: Payment[];
  projects: { id: string; name: string; code: string | null }[];
  contractors: { id: string; name: string; nit: string }[];
  stats: {
    total: number;
    pending: number;
    approved: number;
    paid: number;
    rejected: number;
    totalAmount: number;
    pendingAmount: number;
    paidAmount: number;
  };
  userRole: string;
}

export function PagosClient({ payments, projects, contractors, stats, userRole }: PagosClientProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [showNewDialog, setShowNewDialog] = useState(false);

  const canCreatePayments = ROLES_CAN_CREATE_PAYMENTS.includes(userRole as PaymentRoleKey);

  // Filtrar pagos
  const filteredPayments = payments.filter(payment => {
    const matchesSearch =
      payment.paymentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.concept.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.contractor?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.project.name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || payment.status === statusFilter;
    const matchesProject = projectFilter === 'ALL' || payment.project.id === projectFilter;
    const matchesPriority = priorityFilter === 'ALL' || payment.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesProject && matchesPriority;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
      case 'APPROVED_LEVEL_1':
      case 'APPROVED_LEVEL_2':
        return <Clock className="h-4 w-4" />;
      case 'APPROVED':
        return <CheckCircle className="h-4 w-4" />;
      case 'PAID':
        return <DollarSign className="h-4 w-4" />;
      case 'REJECTED':
        return <XCircle className="h-4 w-4" />;
      case 'CANCELLED':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flujo de Pagos</h1>
          <p className="text-gray-500 mt-1">Gestión de solicitudes de pago y aprobaciones</p>
        </div>
        {canCreatePayments && (
          <Button onClick={() => setShowNewDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Solicitud
          </Button>
        )}
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Solicitudes</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Pendientes</p>
                <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                <p className="text-xs text-gray-400">{formatCurrency(stats.pendingAmount)}</p>
              </div>
              <div className="h-12 w-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Aprobados</p>
                <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Pagados</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.paid}</p>
                <p className="text-xs text-gray-400">{formatCurrency(stats.paidAmount)}</p>
              </div>
              <div className="h-12 w-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por número, concepto, beneficiario..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los estados</SelectItem>
                {Object.entries(PAYMENT_STATUS).map(([key, value]) => (
                  <SelectItem key={key} value={key}>{value}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Proyecto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los proyectos</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.code ? `${project.code} - ` : ''}{project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas las prioridades</SelectItem>
                {Object.entries(PAYMENT_PRIORITY).map(([key, value]) => (
                  <SelectItem key={key} value={key}>{value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de pagos */}
      <Card>
        <CardHeader>
          <CardTitle>Solicitudes de Pago ({filteredPayments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPayments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No se encontraron solicitudes de pago</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPayments.map((payment) => (
                <Link
                  key={payment.id}
                  href={`/dashboard/tesoreria/pagos/${payment.id}`}
                  className="block"
                >
                  <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono text-sm font-medium text-blue-600">
                            {payment.paymentNumber}
                          </span>
                          <Badge
                            variant={PAYMENT_STATUS_COLORS[payment.status as PaymentStatusKey] as BadgeVariant}
                          >
                            {getStatusIcon(payment.status)}
                            <span className="ml-1">
                              {PAYMENT_STATUS[payment.status as PaymentStatusKey]}
                            </span>
                          </Badge>
                          <Badge
                            variant={PAYMENT_PRIORITY_COLORS[payment.priority as PaymentPriorityKey] as BadgeVariant}
                          >
                            {PAYMENT_PRIORITY[payment.priority as PaymentPriorityKey]}
                          </Badge>
                        </div>

                        <h3 className="font-medium text-gray-900 mb-1">
                          {payment.concept.length > 80
                            ? payment.concept.substring(0, 80) + '...'
                            : payment.concept}
                        </h3>

                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {payment.project.name}
                          </span>
                          {payment.contractor && (
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {payment.contractor.name}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatShortDate(payment.createdAt)}
                          </span>
                        </div>

                        {/* Nivel de aprobación */}
                        {['PENDING', 'APPROVED_LEVEL_1', 'APPROVED_LEVEL_2'].includes(payment.status) && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs text-gray-400">Nivel de aprobación:</span>
                            <div className="flex gap-1">
                              {Array.from({ length: payment.requiredApprovalLevel }).map((_, i) => (
                                <div
                                  key={i}
                                  className={`h-2 w-6 rounded ${
                                    i < payment.currentApprovalLevel - 1
                                      ? 'bg-green-500'
                                      : i === payment.currentApprovalLevel - 1
                                      ? 'bg-amber-500'
                                      : 'bg-gray-200'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-xs text-gray-500">
                              {payment.currentApprovalLevel}/{payment.requiredApprovalLevel}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="text-right ml-4">
                        <p className="text-lg font-bold text-gray-900">
                          {formatCurrency(payment.amount)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {PAYMENT_TYPE[payment.paymentType as PaymentTypeKey]}
                        </p>
                        {payment.dueDate && (
                          <p className="text-xs text-gray-400 mt-1">
                            Vence: {formatShortDate(payment.dueDate)}
                          </p>
                        )}
                      </div>

                      <ChevronRight className="h-5 w-5 text-gray-400 ml-2" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para nueva solicitud */}
      <NuevoPagoDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        projects={projects}
        contractors={contractors}
        onSuccess={() => {
          setShowNewDialog(false);
          router.refresh();
        }}
      />
    </div>
  );
}
