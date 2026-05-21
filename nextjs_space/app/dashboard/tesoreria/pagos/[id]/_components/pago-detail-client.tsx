'use client';

import { useState } from 'react';
import type { ComponentProps } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  DollarSign,
  FileText,
  User,
  Loader2,
  Check,
  X,
  Banknote
} from 'lucide-react';
import { formatCurrency, formatDate, formatShortDate } from '@/lib/format';
import {
  PAYMENT_STATUS,
  PAYMENT_PRIORITY,
  PAYMENT_TYPE,
  PAYMENT_STATUS_COLORS,
  PAYMENT_PRIORITY_COLORS,
  USER_ROLE,
  APPROVAL_LEVELS,
  ROLES_CAN_APPROVE_PAYMENTS,
  ROLES_CAN_MARK_PAID
} from '@/lib/constants';

type PaymentStatusKey = keyof typeof PAYMENT_STATUS;
type PaymentPriorityKey = keyof typeof PAYMENT_PRIORITY;
type PaymentTypeKey = keyof typeof PAYMENT_TYPE;
type UserRoleKey = keyof typeof USER_ROLE;
type ApproverRoleKey = (typeof ROLES_CAN_APPROVE_PAYMENTS)[number];
type PayerRoleKey = (typeof ROLES_CAN_MARK_PAID)[number];
type BadgeVariant = ComponentProps<typeof Badge>['variant'];

interface Approval {
  id: string;
  level: number;
  action: string;
  comments: string | null;
  createdAt: string | Date;
  approver: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

interface Payment {
  id: string;
  paymentNumber: string;
  concept: string;
  amount: number;
  currency: string;
  paymentType: string;
  priority: string;
  status: string;
  beneficiaryName: string | null;
  beneficiaryNit: string | null;
  bankName: string | null;
  accountType: string | null;
  accountNumber: string | null;
  currentApprovalLevel: number;
  requiredApprovalLevel: number;
  dueDate: string | Date | null;
  paidAt: string | Date | null;
  createdAt: string | Date;
  notes: string | null;
  rejectionReason: string | null;
  project: { id: string; name: string; code: string | null; client: string };
  contractor: { id: string; name: string; nit: string; email: string; phone: string } | null;
  workCut: { id: string; cutNumber: number; requestedAmount: number; periodStart: string | Date; periodEnd: string | Date } | null;
  contract: { id: string; contractNumber: string; contractValue: number; contractType: string } | null;
  createdBy: { id: string; name: string; email: string; role: string };
  approvals: Approval[];
  documents: unknown[];
}

interface PagoDetailClientProps {
  payment: Payment;
  userRole: string;
  currentUser: { id: string; name: string; email: string; role: string } | null;
}

function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}

export function PagoDetailClient({ payment, userRole, currentUser }: PagoDetailClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Dialogs
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [comments, setComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Verificar permisos
  const canApprove = ROLES_CAN_APPROVE_PAYMENTS.includes(userRole as ApproverRoleKey);
  const canMarkPaid = ROLES_CAN_MARK_PAID.includes(userRole as PayerRoleKey);

  // Verificar si el usuario puede aprobar el nivel actual
  const currentLevelConfig = APPROVAL_LEVELS[payment.currentApprovalLevel as keyof typeof APPROVAL_LEVELS];
  const canApproveCurrentLevel = currentLevelConfig?.roles.includes(userRole as ApproverRoleKey) || false;

  // Verificar si ya aprobó en este nivel
  const alreadyApprovedAtLevel = payment.approvals.some(
    a => a.approver.id === currentUser?.id && 
         a.level === payment.currentApprovalLevel && 
         a.action === 'APPROVED'
  );

  // Estados donde se puede aprobar
  const canApproveNow = 
    canApprove && 
    canApproveCurrentLevel && 
    !alreadyApprovedAtLevel &&
    ['PENDING', 'APPROVED_LEVEL_1', 'APPROVED_LEVEL_2'].includes(payment.status);

  const handleApprove = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/pagos/${payment.id}/aprobar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al aprobar');
      }

      setShowApproveDialog(false);
      setComments('');
      router.refresh();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Error al aprobar'));
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setError('Debe proporcionar un motivo de rechazo');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/pagos/${payment.id}/rechazar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason, comments: rejectionReason })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al rechazar');
      }

      setShowRejectDialog(false);
      setRejectionReason('');
      router.refresh();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Error al rechazar'));
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/pagos/${payment.id}/pagar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: paymentNotes })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al marcar como pagado');
      }

      setShowPayDialog(false);
      setPaymentNotes('');
      router.refresh();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Error al marcar como pagado'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
      case 'APPROVED_LEVEL_1':
      case 'APPROVED_LEVEL_2':
        return <Clock className="h-5 w-5" />;
      case 'APPROVED':
        return <CheckCircle className="h-5 w-5" />;
      case 'PAID':
        return <DollarSign className="h-5 w-5" />;
      case 'REJECTED':
        return <XCircle className="h-5 w-5" />;
      case 'CANCELLED':
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/tesoreria/pagos">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{payment.paymentNumber}</h1>
              <Badge variant={PAYMENT_STATUS_COLORS[payment.status as PaymentStatusKey] as BadgeVariant}>
                {getStatusIcon(payment.status)}
                <span className="ml-1">{PAYMENT_STATUS[payment.status as PaymentStatusKey]}</span>
              </Badge>
              <Badge variant={PAYMENT_PRIORITY_COLORS[payment.priority as PaymentPriorityKey] as BadgeVariant}>
                {PAYMENT_PRIORITY[payment.priority as PaymentPriorityKey]}
              </Badge>
            </div>
            <p className="text-gray-500 mt-1">
              Creado el {formatDate(payment.createdAt)} por {payment.createdBy.name}
            </p>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex gap-2">
          {canApproveNow && (
            <>
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setShowRejectDialog(true)}
              >
                <X className="h-4 w-4 mr-2" />
                Rechazar
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => setShowApproveDialog(true)}
              >
                <Check className="h-4 w-4 mr-2" />
                Aprobar
              </Button>
            </>
          )}
          {canMarkPaid && payment.status === 'APPROVED' && (
            <Button onClick={() => setShowPayDialog(true)}>
              <Banknote className="h-4 w-4 mr-2" />
              Marcar como Pagado
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Motivo de rechazo */}
      {payment.rejectionReason && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Motivo de rechazo:</strong> {payment.rejectionReason}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Información del pago */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Información del Pago
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">Concepto</label>
                <p className="text-gray-900">{payment.concept}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Monto</label>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(payment.amount)}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Tipo de Pago</label>
                  <p className="text-gray-900">
                    {PAYMENT_TYPE[payment.paymentType as PaymentTypeKey]}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Proyecto</label>
                  <p className="text-gray-900">
                    <Link
                      href={`/dashboard/proyectos/${payment.project.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {payment.project.code ? `${payment.project.code} - ` : ''}
                      {payment.project.name}
                    </Link>
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Cliente</label>
                  <p className="text-gray-900">{payment.project.client}</p>
                </div>
              </div>

              {payment.dueDate && (
                <div>
                  <label className="text-sm text-gray-500">Fecha Límite de Pago</label>
                  <p className="text-gray-900 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {formatDate(payment.dueDate)}
                  </p>
                </div>
              )}

              {payment.paidAt && (
                <div>
                  <label className="text-sm text-gray-500">Fecha de Pago</label>
                  <p className="text-green-600 font-medium flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    {formatDate(payment.paidAt)}
                  </p>
                </div>
              )}

              {payment.notes && (
                <div>
                  <label className="text-sm text-gray-500">Notas</label>
                  <p className="text-gray-600 whitespace-pre-wrap">{payment.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Beneficiario */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Beneficiario
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payment.contractor ? (
                <div className="space-y-2">
                  <p className="font-medium">{payment.contractor.name}</p>
                  <p className="text-sm text-gray-500">NIT: {payment.contractor.nit}</p>
                  <p className="text-sm text-gray-500">Email: {payment.contractor.email}</p>
                  <p className="text-sm text-gray-500">Tel: {payment.contractor.phone}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {payment.beneficiaryName && (
                    <p className="font-medium">{payment.beneficiaryName}</p>
                  )}
                  {payment.beneficiaryNit && (
                    <p className="text-sm text-gray-500">NIT/CC: {payment.beneficiaryNit}</p>
                  )}
                  {payment.bankName && (
                    <p className="text-sm text-gray-500">Banco: {payment.bankName}</p>
                  )}
                  {payment.accountType && payment.accountNumber && (
                    <p className="text-sm text-gray-500">
                      Cuenta {payment.accountType}: {payment.accountNumber}
                    </p>
                  )}
                  {!payment.beneficiaryName && !payment.beneficiaryNit && (
                    <p className="text-gray-400 italic">Sin información de beneficiario</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Referencias */}
          {(payment.workCut || payment.contract) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Referencias
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {payment.workCut && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium">Corte de Obra #{payment.workCut.cutNumber}</p>
                    <p className="text-sm text-gray-500">
                      Período: {formatShortDate(payment.workCut.periodStart)} - {formatShortDate(payment.workCut.periodEnd)}
                    </p>
                    <p className="text-sm text-gray-500">
                      Monto solicitado: {formatCurrency(payment.workCut.requestedAmount)}
                    </p>
                  </div>
                )}
                {payment.contract && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium">Contrato {payment.contract.contractNumber}</p>
                    <p className="text-sm text-gray-500">
                      Valor: {formatCurrency(payment.contract.contractValue)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Columna lateral - Flujo de aprobación */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Flujo de Aprobación
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Niveles de aprobación */}
                {Array.from({ length: payment.requiredApprovalLevel }).map((_, index) => {
                  const level = index + 1;
                  const levelConfig = APPROVAL_LEVELS[level as keyof typeof APPROVAL_LEVELS];
                  const approval = payment.approvals.find(
                    a => a.level === level && a.action === 'APPROVED'
                  );
                  const rejection = payment.approvals.find(
                    a => a.level === level && a.action === 'REJECTED'
                  );

                  const isCurrentLevel = payment.currentApprovalLevel === level;
                  const isPassed = level < payment.currentApprovalLevel || payment.status === 'APPROVED' || payment.status === 'PAID';
                  const isRejected = payment.status === 'REJECTED';

                  return (
                    <div key={level} className="relative">
                      {index > 0 && (
                        <div className={`absolute left-4 -top-4 w-0.5 h-4 ${
                          isPassed ? 'bg-green-500' : 'bg-gray-200'
                        }`} />
                      )}
                      
                      <div className={`flex items-start gap-3 p-3 rounded-lg border ${
                        approval ? 'bg-green-50 border-green-200' :
                        rejection ? 'bg-red-50 border-red-200' :
                        isCurrentLevel && !isRejected ? 'bg-amber-50 border-amber-200' :
                        'bg-gray-50 border-gray-200'
                      }`}>
                        <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                          approval ? 'bg-green-500 text-white' :
                          rejection ? 'bg-red-500 text-white' :
                          isCurrentLevel && !isRejected ? 'bg-amber-500 text-white' :
                          'bg-gray-300 text-white'
                        }`}>
                          {approval ? <Check className="h-4 w-4" /> :
                           rejection ? <X className="h-4 w-4" /> :
                           level}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">
                            Nivel {level}: {levelConfig?.name}
                          </p>
                          {approval && (
                            <div className="mt-1">
                              <p className="text-xs text-green-700">
                                Aprobado por {approval.approver.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatShortDate(approval.createdAt)}
                              </p>
                              {approval.comments && (
                                <p className="text-xs text-gray-600 mt-1 italic">
                                  &ldquo;{approval.comments}&rdquo;
                                </p>
                              )}
                            </div>
                          )}
                          {rejection && (
                            <div className="mt-1">
                              <p className="text-xs text-red-700">
                                Rechazado por {rejection.approver.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatShortDate(rejection.createdAt)}
                              </p>
                              {rejection.comments && (
                                <p className="text-xs text-gray-600 mt-1 italic">
                                  &ldquo;{rejection.comments}&rdquo;
                                </p>
                              )}
                            </div>
                          )}
                          {!approval && !rejection && isCurrentLevel && !isRejected && (
                            <p className="text-xs text-amber-700 mt-1">
                              Pendiente de aprobación
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Estado final */}
                {(payment.status === 'APPROVED' || payment.status === 'PAID') && (
                  <div className="relative">
                    <div className="absolute left-4 -top-4 w-0.5 h-4 bg-green-500" />
                    <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                      payment.status === 'PAID' ? 'bg-emerald-50 border-emerald-200' : 'bg-green-50 border-green-200'
                    }`}>
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        payment.status === 'PAID' ? 'bg-emerald-500' : 'bg-green-500'
                      } text-white`}>
                        {payment.status === 'PAID' ? <DollarSign className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {payment.status === 'PAID' ? 'Pagado' : 'Aprobado'}
                        </p>
                        {payment.paidAt && (
                          <p className="text-xs text-emerald-700">
                            {formatShortDate(payment.paidAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Información del creador */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Creado por</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">{payment.createdBy.name}</p>
                  <p className="text-xs text-gray-500">
                    {USER_ROLE[payment.createdBy.role as UserRoleKey]}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog de aprobación */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprobar Solicitud de Pago</DialogTitle>
            <DialogDescription>
              Estás aprobando {payment.paymentNumber} por {formatCurrency(payment.amount)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Comentarios (opcional)</label>
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Agregar comentarios sobre la aprobación..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleApprove} disabled={loading} className="bg-green-600 hover:bg-green-700">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar Aprobación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de rechazo */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar Solicitud de Pago</DialogTitle>
            <DialogDescription>
              Estás rechazando {payment.paymentNumber} por {formatCurrency(payment.amount)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Motivo del rechazo *</label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explica el motivo del rechazo..."
                rows={3}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleReject} disabled={loading} variant="destructive">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar Rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de pago */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como Pagado</DialogTitle>
            <DialogDescription>
              Confirmar el pago de {payment.paymentNumber} por {formatCurrency(payment.amount)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Notas de pago (opcional)</label>
              <Textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Número de transferencia, referencia, etc..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayDialog(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleMarkPaid} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
