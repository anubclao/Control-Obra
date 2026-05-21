"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import {
  FolderOpen,
  Users,
  FileText,
  AlertTriangle,
  TrendingUp,
  CheckCircle,
  XCircle,
  BookOpen,
  Clock,
  Truck,
  UserCheck,
  Wallet,
  ShoppingCart,
  Building2,
  HardHat,
  Briefcase,
  DollarSign,
  ArrowRight,
  Scissors,
  BarChart3,
  CircleDollarSign,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type DashboardStats = {
  projects: number;
  contractors: number;
  pendingCuts: number;
  alerts: number;
  workLogs: number;
  suppliers: number;
  employees: number;
  pendingPayments: number;
  quotations: number;
  clients: number;
};

type Props = {
  stats: DashboardStats;
  activeProjects: {
    id: string;
    name: string;
    status: string;
    totalBudget: number;
    spent: number;
  }[];
  contractorsWithIssues: {
    id: string;
    name: string;
    status: string;
    missingCount: number;
    expiredCount: number;
  }[];
  recentLogs: {
    id: string;
    date: Date;
    activities: string;
    project: { name: string };
    createdBy: { name: string };
  }[];
  pendingCuts: {
    id: string;
    cutNumber: number;
    requestedAmount: number;
    status: string;
    project: { name: string };
    contractor: { name: string };
  }[];
  userRole: string;
  financialData: {
    totalPendingAmount: number;
    totalApprovedAmount: number;
    totalQuotationsValue: number;
  };
};

function StatCard({
  label,
  value,
  icon: Icon,
  href,
  accent = "blue",
  valueClassName,
}: {
  label: string;
  value: string | number;
  icon: any;
  href: string;
  accent?: "blue" | "amber" | "green" | "red";
  valueClassName?: string;
}) {
  const accentMap = {
    blue:  { border: "border-l-blue-500",  icon: "text-blue-500",  bg: "hover:bg-blue-50/50" },
    amber: { border: "border-l-amber-500", icon: "text-amber-500", bg: "hover:bg-amber-50/50" },
    green: { border: "border-l-green-500", icon: "text-green-500", bg: "hover:bg-green-50/50" },
    red:   { border: "border-l-red-500",   icon: "text-red-500",   bg: "hover:bg-red-50/50" },
  };
  const colors = accentMap[accent];

  return (
    <Link href={href}>
      <Card className={cn("border-l-4 transition-all hover:shadow-md cursor-pointer", colors.border, colors.bg)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className={cn("text-2xl font-bold", valueClassName ?? "text-foreground")}>{value}</p>
            </div>
            <Icon className={cn("w-8 h-8 opacity-80", colors.icon)} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  color,
}: {
  icon: any;
  title: string;
  color: "blue" | "amber" | "green";
}) {
  const colorMap = {
    blue:  { icon: "text-blue-600",  text: "text-blue-900",  border: "border-blue-200", bg: "bg-blue-50" },
    amber: { icon: "text-amber-600", text: "text-amber-900", border: "border-amber-200", bg: "bg-amber-50" },
    green: { icon: "text-green-600", text: "text-green-900", border: "border-green-200", bg: "bg-green-50" },
  };
  const c = colorMap[color];
  return (
    <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border", c.bg, c.border)}>
      <Icon className={cn("w-4 h-4", c.icon)} />
      <h2 className={cn("text-sm font-bold uppercase tracking-wide", c.text)}>{title}</h2>
    </div>
  );
}

export default function DashboardOverview({
  stats,
  activeProjects,
  contractorsWithIssues,
  recentLogs,
  pendingCuts,
  userRole,
  financialData,
}: Props) {
  const canViewFinancial = ["ADMIN", "GERENTE", "DIRECTOR", "CONTABILIDAD", "TESORERIA"].includes(userRole);
  const canViewSales = ["ADMIN", "GERENTE", "DIRECTOR"].includes(userRole);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Panel de Control</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Resumen ejecutivo — {new Date().toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>

      {/* ===== ÁREA TÉCNICA ===== */}
      <div className="space-y-3">
        <SectionHeader icon={HardHat} title="Área Técnica" color="blue" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Proyectos Activos"
            value={stats.projects}
            icon={FolderOpen}
            href="/dashboard/proyectos"
            accent="blue"
          />
          <StatCard
            label="Cortes Pendientes"
            value={stats.pendingCuts}
            icon={Scissors}
            href="/dashboard/cortes"
            accent={stats.pendingCuts > 0 ? "red" : "blue"}
            valueClassName={stats.pendingCuts > 0 ? "text-red-600" : undefined}
          />
          <StatCard
            label="Entradas de Bitácora"
            value={stats.workLogs}
            icon={BookOpen}
            href="/dashboard/bitacora"
            accent="blue"
          />
          <StatCard
            label="Alertas Documentos"
            value={stats.alerts}
            icon={AlertTriangle}
            href="/dashboard/subcontratistas"
            accent={stats.alerts > 0 ? "red" : "blue"}
            valueClassName={stats.alerts > 0 ? "text-red-600" : undefined}
          />
        </div>
      </div>

      {/* ===== ÁREA ADMINISTRATIVA ===== */}
      {canViewFinancial && (
        <div className="space-y-3">
          <SectionHeader icon={Briefcase} title="Área Administrativa" color="amber" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Subcontratistas" value={stats.contractors} icon={Users} href="/dashboard/subcontratistas" accent="amber" />
            <StatCard label="Proveedores" value={stats.suppliers} icon={Truck} href="/dashboard/proveedores" accent="amber" />
            <StatCard label="Empleados Activos" value={stats.employees} icon={UserCheck} href="/dashboard/rrhh/empleados" accent="amber" />
            <StatCard
              label="Pagos Pendientes"
              value={stats.pendingPayments}
              icon={Wallet}
              href="/dashboard/tesoreria/pagos"
              accent={stats.pendingPayments > 0 ? "amber" : "amber"}
            />
          </div>

          {/* Fila financiera */}
          {(financialData.totalPendingAmount > 0 || financialData.totalApprovedAmount > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card className="border-l-4 border-l-orange-400 bg-orange-50/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <CircleDollarSign className="w-8 h-8 text-orange-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Total por Pagar (pendiente)</p>
                      <p className="text-lg font-bold text-orange-600">{formatCurrency(financialData.totalPendingAmount)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-green-400 bg-green-50/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-8 h-8 text-green-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Total Aprobado (en proceso)</p>
                      <p className="text-lg font-bold text-green-600">{formatCurrency(financialData.totalApprovedAmount)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ===== ÁREA VENTAS ===== */}
      {canViewSales && (
        <div className="space-y-3">
          <SectionHeader icon={ShoppingCart} title="Área Ventas" color="green" />
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <StatCard label="Clientes" value={stats.clients} icon={Building2} href="/dashboard/ventas/clientes" accent="green" />
            <StatCard label="Cotizaciones Activas" value={stats.quotations} icon={FileText} href="/dashboard/ventas/cotizaciones" accent="green" />
            <Card className="border-l-4 border-l-green-500 bg-green-50/30 col-span-2 lg:col-span-1">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-8 h-8 text-green-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Valor Cotizaciones Enviadas</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(financialData.totalQuotationsValue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ===== PANELES INFERIORES ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Proyectos Activos */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                Proyectos — Ejecución Presupuestal
              </CardTitle>
              <Link href="/dashboard/proyectos">
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  Ver todos <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeProjects.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-muted-foreground">
                <FolderOpen className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-sm">Sin proyectos activos</p>
              </div>
            ) : (
              activeProjects.map((project) => {
                const pct = project.totalBudget > 0
                  ? Math.min((project.spent / project.totalBudget) * 100, 100)
                  : 0;
                const overBudget = project.spent > project.totalBudget;
                return (
                  <Link key={project.id} href={`/dashboard/proyectos/${project.id}`}>
                    <div className="p-3 border rounded-lg hover:border-blue-400 hover:shadow-sm transition-all group">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium truncate flex-1 group-hover:text-blue-700">{project.name}</p>
                        {overBudget && (
                          <Badge variant="destructive" className="text-[10px] ml-2 flex-shrink-0">Sobre presup.</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mb-2">
                        <div>
                          <span className="block">Presupuesto</span>
                          <span className="font-medium text-foreground">{formatCurrency(project.totalBudget)}</span>
                        </div>
                        <div>
                          <span className="block">Ejecutado</span>
                          <span className={cn("font-medium", overBudget ? "text-red-600" : "text-foreground")}>
                            {formatCurrency(project.spent)}
                          </span>
                        </div>
                        <div>
                          <span className="block">Disponible</span>
                          <span className="font-medium text-foreground">
                            {formatCurrency(project.totalBudget - project.spent)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="h-1.5 flex-1" />
                        <span className="text-[10px] text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Panel derecho: Alertas + Cortes */}
        <div className="space-y-4">

          {/* Alertas de documentación */}
          {contractorsWithIssues.length > 0 && (
            <Card className="border-red-200 bg-red-50/40 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2 text-red-800">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    Alertas de Documentación ({contractorsWithIssues.length})
                  </CardTitle>
                  <Link href="/dashboard/subcontratistas">
                    <Button variant="ghost" size="sm" className="text-xs gap-1 text-red-700 hover:text-red-900">
                      Ver todos <ArrowRight className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {contractorsWithIssues.slice(0, 4).map((c) => (
                  <Link key={c.id} href={`/dashboard/subcontratistas/${c.id}`}>
                    <div className="flex items-center justify-between p-2 bg-white border border-red-200 rounded-lg hover:border-red-400 transition-all">
                      <p className="text-sm font-medium text-red-900 truncate flex-1">{c.name}</p>
                      <div className="flex gap-1 ml-2 flex-shrink-0">
                        {c.missingCount > 0 && (
                          <Badge variant="destructive" className="text-[10px] gap-1">
                            <XCircle className="w-3 h-3" />{c.missingCount}
                          </Badge>
                        )}
                        {c.expiredCount > 0 && (
                          <Badge className="text-[10px] bg-orange-500 gap-1">
                            <Clock className="w-3 h-3" />{c.expiredCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Cortes pendientes */}
          {pendingCuts.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-orange-600" />
                    Cortes Pendientes ({pendingCuts.length})
                  </CardTitle>
                  <Link href="/dashboard/cortes">
                    <Button variant="ghost" size="sm" className="text-xs gap-1">
                      Ver todos <ArrowRight className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingCuts.slice(0, 4).map((cut) => (
                  <Link key={cut.id} href={`/dashboard/cortes/${cut.id}`}>
                    <div className="flex items-center justify-between p-2 border rounded-lg hover:border-orange-400 transition-all">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          Corte #{cut.cutNumber} — {cut.contractor.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{cut.project.name}</p>
                      </div>
                      <div className="ml-3 flex-shrink-0 text-right">
                        <p className="text-sm font-semibold text-blue-600">{formatCurrency(cut.requestedAmount)}</p>
                        <Badge variant="secondary" className="text-[10px]">
                          {cut.status === "PENDING" ? "Pendiente" : "En Revisión"}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Últimas bitácoras */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  Últimas Bitácoras
                </CardTitle>
                <Link href="/dashboard/bitacora">
                  <Button variant="ghost" size="sm" className="text-xs gap-1">
                    Ver todas <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentLogs.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-muted-foreground">
                  <BookOpen className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm">Sin registros recientes</p>
                </div>
              ) : (
                recentLogs.slice(0, 4).map((log) => (
                  <Link key={log.id} href={`/dashboard/bitacora/${log.id}`}>
                    <div className="flex gap-3 p-2 border rounded-lg hover:border-blue-400 transition-all">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{formatDate(log.date)}</span>
                          <span className="text-xs text-muted-foreground truncate">{log.project.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{log.activities}</p>
                        <p className="text-[10px] text-muted-foreground">Por {log.createdBy.name}</p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
