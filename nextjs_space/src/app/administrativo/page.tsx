"use client";

import Link from "next/link";
import {
  Wallet,
  ListChecks,
  FileSpreadsheet,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MOCK_PROJECTS } from "@/mocks";
import { usePaymentsStore } from "@/lib/payments-store";
import { useDashboardStats } from "@/lib/dashboard-stats";
import { formatCurrency } from "@/lib/utils";
import type { PaymentStatus } from "@/types";

const paymentStatusConfig: Record<
  PaymentStatus,
  {
    label: string;
    variant: "default" | "info" | "warning" | "success" | "destructive";
  }
> = {
  PENDING: { label: "Pendiente", variant: "warning" },
  APPROVED_LEVEL_1: { label: "Aprobado N1", variant: "info" },
  APPROVED_LEVEL_2: { label: "Aprobado N2", variant: "info" },
  APPROVED: { label: "Aprobado", variant: "success" },
  REJECTED: { label: "Rechazado", variant: "destructive" },
  PAID: { label: "Pagado", variant: "success" },
  CANCELLED: { label: "Cancelado", variant: "default" },
};

const paymentStatusIcon: Record<PaymentStatus, React.ReactNode> = {
  PENDING: <Clock className="h-4 w-4" />,
  APPROVED_LEVEL_1: <CheckCircle2 className="h-4 w-4" />,
  APPROVED_LEVEL_2: <CheckCircle2 className="h-4 w-4" />,
  APPROVED: <CheckCircle2 className="h-4 w-4" />,
  REJECTED: <XCircle className="h-4 w-4" />,
  PAID: <CheckCircle2 className="h-4 w-4" />,
  CANCELLED: <XCircle className="h-4 w-4" />,
};

export default function AdministrativoDashboard() {
  const stats = useDashboardStats();
  const payments = usePaymentsStore((s) => s.payments);
  const recentPayments = payments.slice(0, 6);
  const totalPendingAmount = stats.pendingAmount;
  const totalExecuted = stats.totalExecutedAdmin;
  const totalBudget = stats.totalBudget;
  const retention = totalExecuted * 0.1; // simulado 10%
  const taxes = totalExecuted * 0.19; // simulado IVA 19%

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Dashboard Administrativo
        </h1>
        <p className="text-sm text-muted-foreground">
          Flujo de pagos, reportes financieros y operaciones administrativas
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Por pagar</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {formatCurrency(totalPendingAmount)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.pendingPayments} solicitudes activas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total ejecutado
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {formatCurrency(totalExecuted)}
            </div>
            <p className="text-xs text-muted-foreground">
              de {formatCurrency(totalBudget)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Retenciones</CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {formatCurrency(retention)}
            </div>
            <p className="text-xs text-muted-foreground">10% sobre ejecutado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Impuestos</CardTitle>
            <ListChecks className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {formatCurrency(taxes)}
            </div>
            <p className="text-xs text-muted-foreground">IVA 19% calculado</p>
          </CardContent>
        </Card>
      </div>

      {/* Pagos recientes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Solicitudes de pago</CardTitle>
              <CardDescription>Flujo de aprobación multinivel</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/administrativo/pagos">
                Ver todas <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2">Solicitud</th>
                  <th className="py-2">Proyecto</th>
                  <th className="py-2">Beneficiario</th>
                  <th className="py-2">Tipo</th>
                  <th className="py-2 text-right">Monto</th>
                  <th className="py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((payment) => {
                  const project = MOCK_PROJECTS.find(
                    (p) => p.id === payment.projectId,
                  );
                  const config = paymentStatusConfig[payment.status];
                  return (
                    <tr key={payment.id} className="border-b last:border-0">
                      <td className="py-3 font-mono text-xs">
                        {payment.requestNumber}
                      </td>
                      <td className="py-3 text-xs">{project?.name}</td>
                      <td className="py-3">{payment.beneficiaryName}</td>
                      <td className="py-3 text-xs text-muted-foreground">
                        {payment.type}
                      </td>
                      <td className="py-3 text-right font-medium">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="py-3">
                        <Badge
                          variant={config.variant}
                          className="flex w-fit items-center gap-1"
                        >
                          {paymentStatusIcon[payment.status]}
                          {config.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Accesos rápidos */}
        <Card>
          <CardHeader>
            <CardTitle>Accesos rápidos</CardTitle>
            <CardDescription>Módulos administrativos</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {[
              {
                href: "/administrativo/tesoreria",
                icon: Wallet,
                title: "Tesorería",
                desc: "Flujo de caja",
              },
              {
                href: "/administrativo/pagos",
                icon: ListChecks,
                title: "Pagos",
                desc: "Aprobaciones",
              },
              {
                href: "/administrativo/reportes/financiero",
                icon: FileSpreadsheet,
                title: "Reportes",
                desc: "Financiero",
              },
              {
                href: "/administrativo/impuestos",
                icon: FileSpreadsheet,
                title: "Impuestos",
                desc: "Configuración",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg border p-4 transition-colors hover:bg-accent"
                >
                  <Icon className="mb-2 h-5 w-5 text-primary" />
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        {/* Aprobaciones pendientes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Aprobaciones pendientes
            </CardTitle>
            <CardDescription>Requieren tu revisión</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                num: "PAG-2026-00002",
                amount: 522_000_000,
                level: "Director + Gerente",
                project: "Plaza Andina",
              },
              {
                num: "PAG-2026-00003",
                amount: 45_800_000,
                level: "Gerente",
                project: "Mirador del Norte",
              },
            ].map((item) => (
              <div key={item.num} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-xs">{item.num}</p>
                  <Badge variant="warning">Pendiente</Badge>
                </div>
                <p className="mt-1 text-sm">{item.project}</p>
                <p className="text-xs text-muted-foreground">
                  Aprobación: {item.level}
                </p>
                <p className="mt-2 text-base font-semibold">
                  {formatCurrency(item.amount)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
