"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Wallet,
  Banknote,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  ArrowRight,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  usePaymentsStore,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_VARIANTS,
  PAYMENT_TYPE_LABELS,
} from "@/lib/payments-store";
import { useProjectsStore } from "@/lib/projects-store";
import { useProvidersStore } from "@/lib/providers-store";
import { useAuthStore } from "@/lib/auth-store";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { PaymentRequest, PaymentStatus } from "@/types";

export default function TesoreriaPage() {
  const { payments, performAction } = usePaymentsStore();
  const { getProject } = useProjectsStore();
  const { getProvider } = useProvidersStore();
  const { user } = useAuthStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | PaymentStatus>(
    "ALL",
  );
  const [payDialog, setPayDialog] = useState<PaymentRequest | null>(null);
  const [payRef, setPayRef] = useState("");
  const [payMethod, setPayMethod] = useState<"TRANSFER" | "CHECK" | "CASH">(
    "TRANSFER",
  );
  const [payComments, setPayComments] = useState("");
  const [payError, setPayError] = useState<string | null>(null);

  // Resumen
  const summary = useMemo(() => {
    const approved = payments.filter((p) => p.status === "APPROVED");
    const paid = payments.filter((p) => p.status === "PAID");
    const pending = payments.filter((p) =>
      ["PENDING", "APPROVED_LEVEL_1", "APPROVED_LEVEL_2"].includes(p.status),
    );
    const approvedAmount = approved.reduce((s, p) => s + p.amount, 0);
    const paidAmount = paid.reduce((s, p) => s + p.amount, 0);
    const pendingAmount = pending.reduce((s, p) => s + p.amount, 0);
    return {
      readyToPay: approved.length,
      readyAmount: approvedAmount,
      paid: paid.length,
      paidAmount,
      pending: pending.length,
      pendingAmount,
      total: payments.length,
    };
  }, [payments]);

  // Cola de pagos (todo lo pendiente de ejecución)
  const cola = useMemo(() => {
    return payments
      .filter((p) =>
        [
          "PENDING",
          "APPROVED_LEVEL_1",
          "APPROVED_LEVEL_2",
          "APPROVED",
        ].includes(p.status),
      )
      .filter((p) => {
        const project = getProject(p.projectId);
        const matchSearch =
          !search ||
          p.requestNumber.toLowerCase().includes(search.toLowerCase()) ||
          p.beneficiaryName.toLowerCase().includes(search.toLowerCase()) ||
          (project?.name.toLowerCase().includes(search.toLowerCase()) ?? false);
        const matchStatus = statusFilter === "ALL" || p.status === statusFilter;
        return matchSearch && matchStatus;
      })
      .sort((a, b) => {
        // APPROVED primero, luego por prioridad
        const order: Record<string, number> = {
          APPROVED: 0,
          APPROVED_LEVEL_2: 1,
          APPROVED_LEVEL_1: 2,
          PENDING: 3,
        };
        const orderDiff = (order[a.status] ?? 99) - (order[b.status] ?? 99);
        if (orderDiff !== 0) return orderDiff;
        const prioOrder: Record<string, number> = {
          URGENT: 0,
          HIGH: 1,
          NORMAL: 2,
          LOW: 3,
        };
        return (prioOrder[a.priority] ?? 99) - (prioOrder[b.priority] ?? 99);
      });
  }, [payments, search, statusFilter, getProject]);

  // Histórico (pagados)
  const historico = useMemo(() => {
    return payments
      .filter((p) => p.status === "PAID")
      .sort((a, b) => (b.paidAt || "").localeCompare(a.paidAt || ""));
  }, [payments]);

  function handlePay() {
    if (!payDialog || !user) return;
    setPayError(null);
    const result = performAction(
      payDialog.id,
      "PAY",
      { id: user.id, name: user.name, role: user.role },
      {
        paymentReference: payRef,
        paymentMethod: payMethod,
        comments: payComments || undefined,
      },
    );
    if (!result.ok) {
      setPayError(result.error || "Error al registrar el pago");
      return;
    }
    // FIX Bug #17: resetear TODO el estado del dialog al cerrar
    setPayDialog(null);
    setPayRef("");
    setPayComments("");
    setPayMethod("TRANSFER");
    setPayError(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Tesorería</h1>
        <p className="text-sm text-muted-foreground">
          Ejecución de pagos aprobados y consulta de histórico
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Por ejecutar
            </CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.readyToPay}</p>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(summary.readyAmount)} listos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              En aprobación
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.pending}</p>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(summary.pendingAmount)} en flujo
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Pagado
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.paid}</p>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(summary.paidAmount)} ejecutado
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="cola" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cola">
            <Wallet className="mr-1.5 h-4 w-4" />
            Cola de pagos ({cola.length})
          </TabsTrigger>
          <TabsTrigger value="historico">
            <Receipt className="mr-1.5 h-4 w-4" />
            Histórico ({summary.paid})
          </TabsTrigger>
        </TabsList>

        {/* COLA */}
        <TabsContent value="cola" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, beneficiario o proyecto…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="APPROVED">Aprobados (listos)</SelectItem>
                <SelectItem value="APPROVED_LEVEL_2">Aprobado N2</SelectItem>
                <SelectItem value="APPROVED_LEVEL_1">Aprobado N1</SelectItem>
                <SelectItem value="PENDING">Pendientes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {cola.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <h3 className="mt-4 text-lg font-semibold">Cola vacía</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                No hay pagos pendientes de ejecución
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {cola.map((p) => {
                const project = getProject(p.projectId);
                const provider = p.providerId
                  ? getProvider(p.providerId)
                  : undefined;
                const isReady = p.status === "APPROVED";
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm",
                      isReady && "border-emerald-300 bg-emerald-50/30",
                    )}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Banknote className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-xs text-muted-foreground">
                            {p.requestNumber}
                          </p>
                          <Badge variant={PAYMENT_STATUS_VARIANTS[p.status]}>
                            {PAYMENT_STATUS_LABELS[p.status]}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {PAYMENT_TYPE_LABELS[p.type]}
                          </span>
                          <Badge
                            variant={
                              p.priority === "URGENT"
                                ? "destructive"
                                : p.priority === "HIGH"
                                  ? "warning"
                                  : "outline"
                            }
                            className="text-[10px]"
                          >
                            {p.priority}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm font-medium">
                          {p.beneficiaryName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {project?.code} · {project?.name}
                          {provider ? ` · ${provider.name}` : ""}
                          {p.dueDate ? ` · Vence ${formatDate(p.dueDate)}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold">
                          {formatCurrency(p.amount)}
                        </p>
                        <div className="mt-1 flex justify-end gap-1.5">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/administrativo/pagos/${p.id}`}>
                              Ver <ArrowRight className="ml-1 h-3 w-3" />
                            </Link>
                          </Button>
                          {isReady && (
                            <Button size="sm" onClick={() => setPayDialog(p)}>
                              <Banknote className="mr-1.5 h-3.5 w-3.5" />
                              Pagar
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* HISTÓRICO */}
        <TabsContent value="historico" className="space-y-2">
          {historico.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <Receipt className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">
                Sin pagos ejecutados
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Aún no se ha ejecutado ningún pago
              </p>
            </div>
          ) : (
            historico.map((p) => {
              const project = getProject(p.projectId);
              return (
                <div key={p.id} className="rounded-lg border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-xs text-muted-foreground">
                          {p.requestNumber}
                        </p>
                        <Badge variant="success">Pagado</Badge>
                        {p.paidMethod && (
                          <span className="text-xs text-muted-foreground">
                            {p.paidMethod === "TRANSFER" && "Transferencia"}
                            {p.paidMethod === "CHECK" && "Cheque"}
                            {p.paidMethod === "CASH" && "Efectivo"}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium">{p.beneficiaryName}</p>
                      <p className="text-xs text-muted-foreground">
                        {project?.code} · {project?.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-emerald-700">
                        {formatCurrency(p.amount)}
                      </p>
                      {p.paidAt && (
                        <p className="text-xs text-muted-foreground">
                          {formatDate(p.paidAt)}
                        </p>
                      )}
                      {p.paidReference && (
                        <p className="text-xs text-muted-foreground font-mono">
                          {p.paidReference}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* Modal de pago */}
      <Dialog open={!!payDialog} onOpenChange={(o) => !o && setPayDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
            <DialogDescription>
              Marca la solicitud como pagada. Esta acción queda en el historial.
            </DialogDescription>
          </DialogHeader>

          {payDialog && (
            <div className="space-y-4">
              <div className="rounded-md border bg-secondary/40 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">
                      {payDialog.requestNumber}
                    </p>
                    <p className="text-sm font-medium">
                      {payDialog.beneficiaryName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {payDialog.beneficiaryNit}
                    </p>
                  </div>
                  <p className="text-xl font-bold text-emerald-600">
                    {formatCurrency(payDialog.amount)}
                  </p>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Banco:</span>{" "}
                    <span className="font-medium">{payDialog.bankName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cuenta:</span>{" "}
                    <span className="font-mono">{payDialog.accountNumber}</span>
                  </div>
                </div>
              </div>

              {payError && (
                <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                  {payError}
                </div>
              )}

              <div>
                <Label className="mb-1.5 block">Método de pago</Label>
                <Select
                  value={payMethod}
                  onValueChange={(v) =>
                    setPayMethod(v as "TRANSFER" | "CHECK" | "CASH")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TRANSFER">
                      Transferencia bancaria
                    </SelectItem>
                    <SelectItem value="CHECK">Cheque</SelectItem>
                    <SelectItem value="CASH">Efectivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-1.5 block">
                  Referencia / comprobante *
                </Label>
                <Input
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="TRF-2026-00123"
                />
              </div>

              <div>
                <Label className="mb-1.5 block">Comentarios (opcional)</Label>
                <Textarea
                  value={payComments}
                  onChange={(e) => setPayComments(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={handlePay} disabled={!payRef.trim()}>
              <Banknote className="mr-2 h-4 w-4" />
              Confirmar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
