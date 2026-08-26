"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  Wallet,
  ListChecks,
  FileSpreadsheet,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Clock,
  XCircle,
  Users,
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
import { ModuleExplanationCard } from "@/components/ui/module-explanation-card";
import {
  useDataStore,
  useProjectsStore,
  usePaymentsStore,
} from "@/lib/data-store";
import { useDashboardStats } from "@/lib/dashboard-stats";
import { formatCurrency } from "@/lib/utils";

const paymentStatusConfig = {
  PENDING: { label: "Pendiente", variant: "warning" as const },
  APPROVED_LEVEL_1: { label: "Aprobado N1", variant: "info" as const },
  APPROVED_LEVEL_2: { label: "Aprobado N2", variant: "info" as const },
  APPROVED: { label: "Aprobado", variant: "success" as const },
  REJECTED: { label: "Rechazado", variant: "destructive" as const },
  PAID: { label: "Pagado", variant: "success" as const },
  CANCELLED: { label: "Cancelado", variant: "default" as const },
};

const paymentStatusIcon = {
  PENDING: <Clock className="h-4 w-4" />,
  APPROVED_LEVEL_1: <CheckCircle2 className="h-4 w-4" />,
  APPROVED_LEVEL_2: <CheckCircle2 className="h-4 w-4" />,
  APPROVED: <CheckCircle2 className="h-4 w-4" />,
  REJECTED: <XCircle className="h-4 w-4" />,
  PAID: <CheckCircle2 className="h-4 w-4" />,
  CANCELLED: <XCircle className="h-4 w-4" />,
};

export default function AdministrativoDashboard() {
  const { stats, loading } = useDashboardStats();
  const { payments, load: loadPayments } = usePaymentsStore();
  const { projects, load: loadProjects } = useProjectsStore();

  useEffect(() => {
    loadPayments();
    loadProjects();
  }, []);

  const recentPayments = payments.slice(0, 6);
  const totalPendingAmount = stats.pendingAmount;
  const totalExecuted = stats.totalExecutedAdmin;
  const totalBudget = stats.totalBudget;
  // Indicadores derivados — se mantienen como KPIs operacionales
  const retention = totalExecuted * 0.1;
  const ivaReference = totalExecuted * 0.19;

  return (
    <div className="space-y-6">
      <ModuleExplanationCard
        icon={Wallet}
        variant="guide"
        title="Dashboard Administrativo"
        description="Flujo de pagos, aprobaciones y reportes financieros consolidados."
        steps={[
          {
            title: "Registrar una solicitud de pago",
            description:
              "Ve a Pagos → Nueva. Elige el proyecto, el monto y los datos bancarios del beneficiario.",
          },
          {
            title: "Aprobar en orden",
            description:
              "Cada pago requiere 1 o 2 niveles de aprobación según la configuración (Director → Gerente).",
          },
          {
            title: "Ejecutar pago",
            description:
              "Tesorería registra la referencia y método (transferencia/cheque/efectivo) al pagar.",
          },
        ]}
        warnings={[
          "Un pago Rechazado no se puede editar; crea una nueva solicitud si necesitas insistir.",
          "Los reportes aquí son resúmenes rápidos. Para detalle contable ve a Reportes Financieros.",
        ]}
      />

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard Administrativo</h1>
        <p className="text-sm text-muted-foreground">
          Flujo de pagos, reportes financieros y operaciones administrativas
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Por pagar</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrency(totalPendingAmount)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.pendingPayments} solicitudes activas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total ejecutado</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrency(totalExecuted)}</div>
            <p className="text-xs text-muted-foreground">de {formatCurrency(totalBudget)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Retención estimada</CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrency(retention)}</div>
            <p className="text-xs text-muted-foreground">10% sobre ejecutado (referencia)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Empleados activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.activeEmployees}</div>
            <p className="text-xs text-muted-foreground">En RRHH</p>
          </CardContent>
        </Card>
      </div>

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
            {recentPayments.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm font-medium">Sin solicitudes de pago</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Crea una para iniciar el flujo de aprobación multinivel.
                </p>
                <Button asChild className="mt-4" size="sm">
                  <Link href="/administrativo/pagos">Crear solicitud</Link>
                </Button>
              </div>
            ) : (
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
                    const project = projects.find((p) => p.id === payment.projectId);
                    const config = paymentStatusConfig[payment.status];
                    return (
                      <tr key={payment.id} className="border-b last:border-0 hover:bg-accent">
                        <td className="py-3 font-mono text-xs">
                          <Link href={`/administrativo/pagos/${payment.id}`}>
                            {payment.requestNumber}
                          </Link>
                        </td>
                        <td className="py-3 text-xs">{project?.name ?? "—"}</td>
                        <td className="py-3">{payment.beneficiaryName}</td>
                        <td className="py-3 text-xs text-muted-foreground">{payment.type}</td>
                        <td className="py-3 text-right font-medium">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="py-3">
                          <Badge variant={config.variant} className="flex w-fit items-center gap-1">
                            {paymentStatusIcon[payment.status]}
                            {config.label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accesos rápidos</CardTitle>
          <CardDescription>Módulos administrativos</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { href: "/administrativo/tesoreria", icon: Wallet, title: "Tesorería", desc: "Flujo de caja" },
            { href: "/administrativo/pagos", icon: ListChecks, title: "Pagos", desc: "Aprobaciones" },
            { href: "/administrativo/reportes/financiero", icon: FileSpreadsheet, title: "Reportes", desc: "Financiero" },
            { href: "/administrativo/impuestos", icon: FileSpreadsheet, title: "Impuestos", desc: "Configuración" },
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

      <p className="text-center text-xs text-muted-foreground">
        Referencia: la columna &quot;Retención estimada&quot; usa 10% sobre ejecutado.
        La columna IVA referencia 19% — para cálculo real ve a Impuestos.
      </p>
    </div>
  );
}
