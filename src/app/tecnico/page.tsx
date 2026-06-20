"use client";

import Link from "next/link";
import {
  FolderKanban,
  Scissors,
  TrendingUp,
  Truck,
  AlertTriangle,
  Calendar,
  ArrowRight,
  CheckCircle2,
  Clock,
  Pause,
  PlayCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MOCK_PROJECTS, MOCK_WORK_CUTS, getDashboardStats } from "@/mocks";
import { formatCurrency, formatPercent, formatDate } from "@/lib/utils";
import type { ProjectStatus } from "@/types";

const statusConfig: Record<ProjectStatus, { label: string; variant: "default" | "info" | "warning" | "success" }> = {
  IN_PLANNING: { label: "Planificación", variant: "info" },
  IN_EXECUTION: { label: "En ejecución", variant: "success" },
  PAUSED: { label: "Pausado", variant: "warning" },
  COMPLETED: { label: "Completado", variant: "default" },
};

const statusIcon: Record<ProjectStatus, React.ReactNode> = {
  IN_PLANNING: <PlayCircle className="h-4 w-4" />,
  IN_EXECUTION: <PlayCircle className="h-4 w-4" />,
  PAUSED: <Pause className="h-4 w-4" />,
  COMPLETED: <CheckCircle2 className="h-4 w-4" />,
};

export default function TecnicoDashboard() {
  const stats = getDashboardStats();
  const activeProjects = MOCK_PROJECTS.filter((p) => p.status === "IN_EXECUTION");
  const pendingCuts = MOCK_WORK_CUTS.filter((c) => ["SUBMITTED", "VALIDATED"].includes(c.status));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard Técnico</h1>
        <p className="text-sm text-muted-foreground">
          Estado de proyectos, presupuestos y avance de obra
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proyectos activos</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.activeProjects}</div>
            <p className="text-xs text-muted-foreground">En ejecución</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Presupuesto total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrency(stats.totalBudget)}</div>
            <p className="text-xs text-muted-foreground">
              Ejecutado: {formatPercent(stats.executionPercent)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cortes pendientes</CardTitle>
            <Scissors className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.pendingCuts}</div>
            <p className="text-xs text-muted-foreground">Requieren validación</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proveedores</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">12</div>
            <p className="text-xs text-muted-foreground">3 con docs por vencer</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Proyectos activos */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Proyectos en ejecución</CardTitle>
                <CardDescription>Estado actual y avance de obra</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/tecnico/proyectos">
                  Ver todos <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeProjects.map((project) => {
              const percent = (project.executedAmount / project.totalBudget) * 100;
              const config = statusConfig[project.status];
              return (
                <div key={project.id} className="rounded-lg border p-4">
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <p className="text-xs font-mono text-muted-foreground">{project.code}</p>
                      <p className="font-medium">{project.name}</p>
                      <p className="text-sm text-muted-foreground">{project.client}</p>
                    </div>
                    <Badge variant={config.variant} className="flex items-center gap-1">
                      {statusIcon[project.status]}
                      {config.label}
                    </Badge>
                  </div>
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Avance</span>
                      <span className="font-medium">{formatPercent(percent)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatCurrency(project.executedAmount)}</span>
                      <span>{formatCurrency(project.totalBudget)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Cortes pendientes */}
        <Card>
          <CardHeader>
            <CardTitle>Cortes por validar</CardTitle>
            <CardDescription>Requieren aprobación</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingCuts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin cortes pendientes</p>
            ) : (
              pendingCuts.map((cut) => {
                const project = MOCK_PROJECTS.find((p) => p.id === cut.projectId);
                return (
                  <div key={cut.id} className="rounded-lg border p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="font-mono text-xs">{cut.cutNumber}</p>
                      <Badge variant={cut.status === "SUBMITTED" ? "warning" : "info"}>
                        {cut.status === "SUBMITTED" ? "Enviado" : "Validado"}
                      </Badge>
                    </div>
                    <p className="text-sm">{cut.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {project?.name}
                    </p>
                    <p className="mt-2 text-sm font-semibold">
                      {formatCurrency(cut.netValue)}
                    </p>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bitácora reciente y alertas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bitácora reciente</CardTitle>
            <CardDescription>Últimos registros de avance diario</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { project: "Edificio Mirador del Norte", date: "2026-06-12", activity: "Cimentación piso 7-8 completada", weather: "Soleado" },
              { project: "Plaza Andina", date: "2026-06-12", activity: "Estructura metálica nivel 2", weather: "Nublado" },
              { project: "Bodega Zona Franca", date: "2026-06-11", activity: "Cubierta 80% instalada", weather: "Lluvioso" },
            ].map((entry, i) => (
              <div key={i} className="flex gap-3 border-b pb-3 last:border-0">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-secondary">
                  <Calendar className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{entry.activity}</p>
                  <p className="text-xs text-muted-foreground">{entry.project}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDate(entry.date)}</span>
                    <span>·</span>
                    <span>{entry.weather}</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Alertas y notificaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { type: "warning", message: "Cámara de Comercio de Estructuras del Norte vence en 15 días", area: "Proveedores" },
              { type: "info", message: "Cotización COT-2026-0001 fue vista por el cliente", area: "Ventas" },
              { type: "success", message: "Corte CO-001-P001 fue aprobado por Director de Obra", area: "Cortes" },
            ].map((alert, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-md border-l-4 bg-secondary/50 p-3"
                style={{
                  borderColor:
                    alert.type === "warning"
                      ? "#f59e0b"
                      : alert.type === "success"
                      ? "#10b981"
                      : "#3b82f6",
                }}
              >
                <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm">{alert.message}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{alert.area}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
