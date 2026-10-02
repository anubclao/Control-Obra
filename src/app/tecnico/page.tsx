"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  FolderKanban,
  Scissors,
  TrendingUp,
  Truck,
  ArrowRight,
  CheckCircle2,
  Pause,
  PlayCircle,
  ClipboardList,
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
import { KpiCard } from "@/components/ui/kpi-card";
import { PanelState } from "@/components/ui/panel-state";
import { useProjectsStore, useCutsStore } from "@/lib/data-store";
import { useDashboardStats } from "@/lib/dashboard-stats";
import { formatCurrency, formatPercent } from "@/lib/utils";

const statusConfig = {
  IN_PLANNING: { label: "Planificación", variant: "info" as const },
  IN_EXECUTION: { label: "En ejecución", variant: "success" as const },
  PAUSED: { label: "Pausado", variant: "warning" as const },
  COMPLETED: { label: "Completado", variant: "default" as const },
};

const statusIcon = {
  IN_PLANNING: <PlayCircle className="h-4 w-4" />,
  IN_EXECUTION: <PlayCircle className="h-4 w-4" />,
  PAUSED: <Pause className="h-4 w-4" />,
  COMPLETED: <CheckCircle2 className="h-4 w-4" />,
};

export default function TecnicoDashboard() {
  // P1 (seccion 4.3): usamos loading/error/reload del hook en vez de
  //   mostrar $0 silencioso.
  const {
    stats,
    loading: statsLoading,
    error: statsError,
    reload: reloadStats,
  } = useDashboardStats();
  const {
    projects,
    loading: projectsLoading,
    error: projectsError,
    load: loadProjects,
  } = useProjectsStore();
  const {
    cuts,
    loading: cutsLoading,
    error: cutsError,
    load: loadCuts,
  } = useCutsStore();

  useEffect(() => {
    loadProjects();
    loadCuts();
  }, []);

  const activeProjects = projects.filter((p) => p.status === "IN_EXECUTION");
  const pendingCuts = cuts.filter((c) =>
    ["SUBMITTED", "VALIDATED"].includes(c.status),
  );

  return (
    <div className="space-y-6">
      <ModuleExplanationCard
        icon={ClipboardList}
        variant="guide"
        title="Dashboard Técnico"
        description="Visión general del estado de tus proyectos, presupuestos y avance de obra."
        steps={[
          {
            title: "Crear un proyecto",
            description:
              "Ve a Proyectos → Nuevo. Define código, cliente, ubicación y presupuesto total.",
          },
          {
            title: "Registrar avance",
            description:
              "Los residentes crean cortes desde la Bitácora diaria y registran Cortes de Obra.",
          },
          {
            title: "Aprobar pagos",
            description:
              "Cuando un Corte está Validado, Tesorería inicia el flujo de pago (1 o 2 niveles).",
          },
        ]}
        tips={[
          "Los cortes en estado DRAFT o REJECTED se pueden eliminar; los demás quedan como auditoría.",
          "El Dashboard se actualiza en tiempo real cuando hay cambios en otros módulos.",
        ]}
      />

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Dashboard Técnico
        </h1>
        <p className="text-sm text-muted-foreground">
          Estado de proyectos, presupuestos y avance de obra
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Proyectos activos"
          icon={FolderKanban}
          value={stats.activeProjects}
          subtitle={`de ${stats.totalProjects} totales · en ejecución`}
          loading={statsLoading}
          error={statsError}
          onRetry={reloadStats}
        />
        <KpiCard
          title="Presupuesto total"
          icon={TrendingUp}
          value={formatCurrency(stats.totalBudget)}
          subtitle={`Ejecutado: ${formatPercent(stats.executionPercent)}`}
          loading={statsLoading}
          error={statsError}
          onRetry={reloadStats}
        />
        <KpiCard
          title="Cortes pendientes"
          icon={Scissors}
          value={stats.pendingCuts}
          subtitle="Requieren validación"
          loading={statsLoading}
          error={statsError}
          onRetry={reloadStats}
        />
        <KpiCard
          title="Bitácoras (7 días)"
          icon={Truck}
          value={stats.recentLogs}
          subtitle="Registradas recientemente"
          loading={statsLoading}
          error={statsError}
          onRetry={reloadStats}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Proyectos en ejecución</CardTitle>
                <CardDescription>
                  Estado actual y avance de obra
                </CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/tecnico/proyectos">
                  Ver todos <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <PanelState
              loading={projectsLoading && activeProjects.length === 0}
              error={activeProjects.length === 0 ? projectsError : null}
              onRetry={loadProjects}
              isEmpty={activeProjects.length === 0}
              emptyTitle="Sin proyectos activos"
              emptyDescription="Crea tu primer proyecto para empezar a gestionar obra."
              emptyCta={{ label: "Crear proyecto", href: "/tecnico/proyectos" }}
              skeletonRows={2}
            >
              {activeProjects.map((project) => {
                const percent =
                  project.totalBudget > 0
                    ? (project.executedAmount / project.totalBudget) * 100
                    : 0;
                const config = statusConfig[project.status];
                return (
                  <Link
                    key={project.id}
                    href={`/tecnico/proyectos/${project.id}`}
                    className="block rounded-lg border p-4 transition-colors hover:bg-accent"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <p className="font-mono text-xs text-muted-foreground">
                          {project.code}
                        </p>
                        <p className="font-medium">{project.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {project.client}
                        </p>
                      </div>
                      <Badge
                        variant={config.variant}
                        className="flex items-center gap-1"
                      >
                        {statusIcon[project.status]}
                        {config.label}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Avance</span>
                        <span className="font-medium">
                          {formatPercent(percent)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${Math.min(percent, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatCurrency(project.executedAmount)}</span>
                        <span>{formatCurrency(project.totalBudget)}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </PanelState>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cortes por validar</CardTitle>
            <CardDescription>Requieren aprobación</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <PanelState
              loading={cutsLoading && pendingCuts.length === 0}
              error={pendingCuts.length === 0 ? cutsError : null}
              onRetry={loadCuts}
              isEmpty={pendingCuts.length === 0}
              emptyTitle="Sin cortes pendientes"
              emptyDescription="Cuando un residente envie un corte aparecera aqui."
              skeletonRows={2}
            >
              {pendingCuts.slice(0, 6).map((cut) => {
                const project = projects.find((p) => p.id === cut.projectId);
                return (
                  <Link
                    key={cut.id}
                    href={`/tecnico/cortes/${cut.id}`}
                    className="block rounded-lg border p-3 transition-colors hover:bg-accent"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <p className="font-mono text-xs">{cut.cutNumber}</p>
                      <Badge
                        variant={
                          cut.status === "SUBMITTED" ? "warning" : "info"
                        }
                      >
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
                  </Link>
                );
              })}
            </PanelState>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
