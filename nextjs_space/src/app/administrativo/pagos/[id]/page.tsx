"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Building2,
  Wallet,
  Calendar,
  Scissors,
  History,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Banknote,
  Ban,
  BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  usePaymentsStore,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_VARIANTS,
  PAYMENT_TYPE_LABELS,
  PAYMENT_PRIORITY_LABELS,
  PAYMENT_PRIORITY_VARIANTS,
  PAYMENT_ACTION_LABELS,
  getAvailablePaymentActions,
} from "@/lib/data-store";
import { useProjectsStore } from "@/lib/data-store";
import { useProvidersStore } from "@/lib/data-store";
import { useCutsStore } from "@/lib/data-store";
import { useAuthStore } from "@/lib/auth-store";
import { PaymentForm } from "@/components/payments/payment-form";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { PaymentAction, PaymentRequest } from "@/types";
interface PaymentActionButton {
  action: PaymentAction;
  label: string;
  variant: "default" | "info" | "warning" | "destructive";
}

export default function PaymentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { getPayment, performAction } = usePaymentsStore();
  const { getProject } = useProjectsStore();
  const { getProvider } = useProvidersStore();
  const { getCut } = useCutsStore();
  const { user } = useAuthStore();
  const [editOpen, setEditOpen] = useState(false);
  const [actionDialog, setActionDialog] = useState<{ action: PaymentAction } | null>(null);
  const [actionComments, setActionComments] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [payRef, setPayRef] = useState("");
  const [payMethod, setPayMethod] = useState<"TRANSFER" | "CHECK" | "CASH">("TRANSFER");
  const [actionError, setActionError] = useState<string | null>(null);

  const payment = getPayment(id);

  if (!payment) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/administrativo/pagos">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver
          </Link>
        </Button>
        <div className="rounded-lg border border-dashed p-12 text-center">
          <h2 className="text-lg font-semibold">Solicitud no encontrada</h2>
        </div>
      </div>
    );
  }

  const project = getProject(payment.projectId);
  const provider = payment.providerId ? getProvider(payment.providerId) : undefined;
  const workCut = payment.workCutId ? getCut(payment.workCutId) : undefined;
  const variant = PAYMENT_STATUS_VARIANTS[payment.status];
  const priorityVariant = PAYMENT_PRIORITY_VARIANTS[payment.priority];
  const isEditable = payment.status === "PENDING";
  const userRole = user?.role ?? "USER";
  const availableActions = getAvailablePaymentActions(payment as any, userRole);

  function handleAction() {
    if (!actionDialog || !user) return;
    setActionError(null);
    const result = performAction(
      payment!.id,
      actionDialog.action,
      { id: user.id, name: user.name, role: user.role },
      {
        comments: actionComments || undefined,
        rejectionReason: actionDialog.action === "REJECT" ? rejectionReason : undefined,
        paymentReference: actionDialog.action === "PAY" ? payRef : undefined,
        paymentMethod: actionDialog.action === "PAY" ? payMethod : undefined,
      }
    );
    if (!result.ok) {
      setActionError(result.error || "Error desconocido");
      return;
    }
    setActionDialog(null);
    setActionComments("");
    setRejectionReason("");
    setPayRef("");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/administrativo/pagos">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Pagos
          </Link>
        </Button>
        {isEditable && (
          <Button onClick={() => setEditOpen(true)} variant="outline" size="sm">
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Button>
        )}
      </div>

      {/* Header */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-xs text-muted-foreground">{payment.requestNumber}</p>
              <Badge variant={variant}>{PAYMENT_STATUS_LABELS[payment.status]}</Badge>
              <Badge variant={priorityVariant}>{PAYMENT_PRIORITY_LABELS[payment.priority]}</Badge>
              <span className="text-xs text-muted-foreground">
                {PAYMENT_TYPE_LABELS[payment.type]}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{payment.beneficiaryName}</h1>
            <p className="font-mono text-xs text-muted-foreground">NIT {payment.beneficiaryNit}</p>
            <div className="mt-3 flex flex-col gap-1.5 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-4">
              {project && (
                <p className="flex items-center gap-1.5">
                  <Building2 className="h-4 w-4" />
                  {project.code} · {project.name}
                </p>
              )}
              {provider && (
                <p className="flex items-center gap-1.5">
                  <Wallet className="h-4 w-4" />
                  {provider.name}
                </p>
              )}
              {payment.dueDate && (
                <p className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  Vence: {formatDate(payment.dueDate)}
                </p>
              )}
            </div>
            {payment.description && (
              <p className="mt-3 rounded-md bg-secondary/40 p-2 text-sm">{payment.description}</p>
            )}
          </div>

          <div className="rounded-lg bg-secondary/50 p-4 sm:min-w-[220px]">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Monto a pagar</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{formatCurrency(payment.amount)}</p>
            {payment.paidAt && (
              <p className="mt-2 text-xs text-muted-foreground">
                Pagado el {formatDate(payment.paidAt)}
                {payment.paidReference && ` · ${payment.paidReference}`}
              </p>
            )}
          </div>
        </div>

        {/* Acciones */}
        {availableActions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
            {availableActions.map(({ action, label, variant: btnVariant }) => (
              <Button
                key={action}
                variant={btnVariant === "destructive" ? "destructive" : "default"}
                size="sm"
                onClick={() => setActionDialog({ action })}
              >
                {action === "APPROVE_L1" && <BadgeCheck className="mr-2 h-4 w-4" />}
                {action === "APPROVE_L2" && <ThumbsUp className="mr-2 h-4 w-4" />}
                {action === "PAY" && <Banknote className="mr-2 h-4 w-4" />}
                {action === "REJECT" && <ThumbsDown className="mr-2 h-4 w-4" />}
                {action === "CANCEL" && <Ban className="mr-2 h-4 w-4" />}
                {label}
              </Button>
            ))}
          </div>
        )}

        {payment.status === "REJECTED" && payment.rejectionReason && (
          <Alert variant="destructive" className="mt-4">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Motivo del rechazo</AlertTitle>
            <AlertDescription>{payment.rejectionReason}</AlertDescription>
          </Alert>
        )}

        {payment.paidAt && payment.paidMethod && (
          <Alert className="mt-4">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Pagado</AlertTitle>
            <AlertDescription>
              {payment.paidMethod === "TRANSFER" && "Transferencia bancaria"}
              {payment.paidMethod === "CHECK" && "Cheque"}
              {payment.paidMethod === "CASH" && "Efectivo"}
              {payment.paidReference && ` · Ref: ${payment.paidReference}`}
              {" · "}
              {formatDate(payment.paidAt)}
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">
            <Wallet className="mr-1.5 h-4 w-4" />
            Información
          </TabsTrigger>
          <TabsTrigger value="corte">
            <Scissors className="mr-1.5 h-4 w-4" />
            Corte asociado
          </TabsTrigger>
          <TabsTrigger value="historial">
            <History className="mr-1.5 h-4 w-4" />
            Historial ({payment.approvals.length})
          </TabsTrigger>
        </TabsList>

        {/* Info */}
        <TabsContent value="info" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Datos bancarios</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Beneficiario" value={payment.beneficiaryName} />
                <Row label="NIT / Cédula" value={payment.beneficiaryNit} />
                <Row label="Banco" value={payment.bankName} />
                <Row label="Tipo de cuenta" value={payment.accountType === "CHECKING" ? "Corriente" : "Ahorros"} />
                <Row label="Número de cuenta" value={payment.accountNumber} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detalles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Tipo" value={PAYMENT_TYPE_LABELS[payment.type]} />
                <Row label="Prioridad" value={PAYMENT_PRIORITY_LABELS[payment.priority]} />
                <Row label="Niveles requeridos" value={payment.requiredApprovalLevel.toString()} />
                <Row label="Nivel actual" value={payment.currentApprovalLevel.toString()} />
                <Row label="Fecha límite" value={payment.dueDate ? formatDate(payment.dueDate) : undefined} />
                <Row label="Creado" value={formatDate(payment.createdAt)} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Corte asociado */}
        <TabsContent value="corte">
          <Card>
            <CardHeader>
              <CardTitle>Corte de obra asociado</CardTitle>
              <CardDescription>
                {workCut
                  ? "Este pago se generó a partir de un corte aprobado"
                  : "Esta solicitud no está vinculada a un corte"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {workCut ? (
                <div className="rounded-lg border bg-secondary/30 p-4">
                  <div className="flex items-center gap-2">
                    <Scissors className="h-4 w-4 text-muted-foreground" />
                    <p className="font-mono text-sm">{workCut.cutNumber}</p>
                    <Badge variant="success">{workCut.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm">{workCut.description}</p>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Bruto</p>
                      <p className="font-semibold">{formatCurrency(workCut.grossValue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Retención</p>
                      <p className="font-semibold text-red-600">−{formatCurrency(workCut.retentionValue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Neto</p>
                      <p className="font-semibold text-emerald-600">{formatCurrency(workCut.netValue)}</p>
                    </div>
                  </div>
                  <Button asChild variant="link" className="mt-3 h-auto p-0">
                    <Link href={`/tecnico/cortes/${workCut.id}`}>Ver corte completo →</Link>
                  </Button>
                </div>
              ) : (
                <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No hay corte asociado. Esta solicitud es de tipo {PAYMENT_TYPE_LABELS[payment.type].toLowerCase()}.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Historial */}
        <TabsContent value="historial">
          <Card>
            <CardHeader>
              <CardTitle>Historial de aprobaciones</CardTitle>
              <CardDescription>Trazabilidad completa de la solicitud</CardDescription>
            </CardHeader>
            <CardContent>
              {payment.approvals.length === 0 ? (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Aún no hay acciones registradas
                </p>
              ) : (
                <div className="space-y-3">
                  {payment.approvals.map((a) => {
                    const aVariant: "success" | "destructive" | "info" | "warning" =
                      a.action === "APPROVE_L1"
                        ? "info"
                        : a.action === "APPROVE_L2" || a.action === "PAY"
                        ? "success"
                        : a.action === "REJECT" || a.action === "CANCEL"
                        ? "destructive"
                        : "warning";
                    return (
                      <div key={a.id} className="flex gap-3 rounded-md border bg-secondary/20 p-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-background">
                          {a.action === "APPROVE_L1" && <BadgeCheck className="h-4 w-4 text-blue-600" />}
                          {a.action === "APPROVE_L2" && <ThumbsUp className="h-4 w-4 text-emerald-600" />}
                          {a.action === "PAY" && <Banknote className="h-4 w-4 text-emerald-700" />}
                          {a.action === "REJECT" && <ThumbsDown className="h-4 w-4 text-red-600" />}
                          {a.action === "CANCEL" && <Ban className="h-4 w-4 text-red-600" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={aVariant}>{PAYMENT_ACTION_LABELS[a.action]}</Badge>
                            {a.level && <span className="text-xs text-muted-foreground">Nivel {a.level}</span>}
                            <p className="text-sm font-medium">{a.userName}</p>
                            <span className="text-xs text-muted-foreground">({a.userRole})</span>
                          </div>
                          {a.comments && (
                            <p className="mt-1 text-sm text-muted-foreground">{a.comments}</p>
                          )}
                          {a.paymentReference && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Comprobante: {a.paymentReference} ({a.paymentMethod})
                            </p>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(a.createdAt).toLocaleString("es-CO")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal editar */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar solicitud</DialogTitle>
            <DialogDescription>{payment.requestNumber}</DialogDescription>
          </DialogHeader>
          <PaymentForm payment={payment} onSuccess={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Modal acción */}
      <Dialog open={!!actionDialog} onOpenChange={(o) => !o && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.action === "REJECT"
                ? "Rechazar solicitud"
                : actionDialog?.action === "PAY"
                ? "Registrar pago"
                : actionDialog?.action === "CANCEL"
                ? "Cancelar solicitud"
                : actionDialog?.action === "APPROVE_L1"
                ? "Aprobar nivel 1"
                : "Aprobar nivel 2"}
            </DialogTitle>
            <DialogDescription>
              {actionDialog?.action === "PAY"
                ? "Ingresa el comprobante de pago. Esta acción marca la solicitud como pagada."
                : actionDialog?.action === "REJECT"
                ? "Indica el motivo del rechazo."
                : actionDialog?.action === "CANCEL"
                ? "La solicitud quedará cancelada y no se podrá reactivar."
                : "Esta acción quedará registrada en el historial."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {actionError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            )}

            {actionDialog?.action === "PAY" && (
              <>
                <div>
                  <Label className="mb-1.5 block">Método de pago</Label>
                  <Select value={payMethod} onValueChange={(v) => setPayMethod(v as "TRANSFER" | "CHECK" | "CASH")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TRANSFER">Transferencia bancaria</SelectItem>
                      <SelectItem value="CHECK">Cheque</SelectItem>
                      <SelectItem value="CASH">Efectivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block">Referencia / comprobante *</Label>
                  <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="TRF-2026-00123" />
                </div>
              </>
            )}

            {actionDialog?.action === "REJECT" ? (
              <div>
                <Label className="mb-1.5 block">Motivo del rechazo *</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Describe el motivo…"
                  rows={3}
                />
              </div>
            ) : actionDialog?.action !== "PAY" ? (
              <div>
                <Label className="mb-1.5 block">Comentarios (opcional)</Label>
                <Textarea
                  value={actionComments}
                  onChange={(e) => setActionComments(e.target.value)}
                  placeholder="Notas para el historial…"
                  rows={3}
                />
              </div>
            ) : (
              <div>
                <Label className="mb-1.5 block">Comentarios (opcional)</Label>
                <Textarea
                  value={actionComments}
                  onChange={(e) => setActionComments(e.target.value)}
                  placeholder="Notas adicionales…"
                  rows={2}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant={actionDialog?.action === "REJECT" || actionDialog?.action === "CANCEL" ? "destructive" : "default"}
              onClick={handleAction}
              disabled={
                (actionDialog?.action === "REJECT" && !rejectionReason.trim()) ||
                (actionDialog?.action === "PAY" && !payRef.trim())
              }
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", !value && "text-muted-foreground italic")}>
        {value || "No registrado"}
      </span>
    </div>
  );
}
