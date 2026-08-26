"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Calendar as CalendarIcon,
  Pencil,
  Trash2,
  Scissors,
  Truck,
  Calculator,
  BookOpen,
  Activity,
  Users,
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
import {
  useProjectsStore,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_VARIANTS,
} from "@/lib/data-store";
import { ProjectForm } from "@/components/projects/project-form";
import { useIsSuperAdmin } from "@/lib/permissions";
import { useCutsStore, useProvidersStore } from "@/lib/data-store";
import { formatCurrency, formatDate, formatPercent, cn } from "@/lib/utils";

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { getProject, deleteProject } = useProjectsStore();
  const { cuts: allCuts, load: loadCuts } = useCutsStore();
  const { providers: allProviders, load: loadProviders } = useProvidersStore();
  const isSuperAdmin = useIsSuperAdmin();

  // Cargar cortes y proveedores desde BD si no están en cache
  useEffect(() => {
    if (!allCuts || allCuts.length === 0) loadCuts();
    if (!allProviders || allProviders.length === 0) loadProviders();
  }, [allCuts, allProviders, loadCuts, loadProviders]);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const project = getProject(id);

  if (!project) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/tecnico/proyectos">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver
          </Link>
        </Button>
        <div className="rounded-lg border border-dashed p-12 text-center">
          <h2 className="text-lg font-semibold">Proyecto no encontrado</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            El proyecto que buscas no existe o fue eliminado.
          </p>
        </div>
      </div>
    );
  }

  const percent = project.totalBudget > 0 ? (project.executedAmount / project.totalBudget) * 100 : 0;
  const projectCuts = (allCuts || []).filter((c) => c.projectId === project.id);
  const cutsTotal = projectCuts.reduce((s, c) => s + c.grossValue, 0);
  const cutsPending = projectCuts.filter((c) => ["SUBMITTED", "VALIDATED"].includes(c.status)).length;

  // Providers reales del proyecto (placeholder: primeros 3 hasta que exista relación project_provider)
  // TODO: cuando exista tabla project_providers, filtrar por project.id
  const projectProviders = (allProviders || []).slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/tecnico/proyectos">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Proyectos
          </Link>
        </Button>
        {isSuperAdmin && (
          <div className="flex gap-2">
            <Button onClick={() => setEditOpen(true)} variant="outline" size="sm">
              <Pencil className="mr-2 h-4 w-4" />
              Modificar proyecto
            </Button>
            <Button onClick={() => setConfirmDelete(true)} variant="destructive" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar proyecto
            </Button>
          </div>
        )}
      </div>

      {/* Title */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-mono text-xs text-muted-foreground">{project.code}</p>
              <Badge variant={PROJECT_STATUS_VARIANTS[project.status]}>
                {PROJECT_STATUS_LABELS[project.status]}
              </Badge>
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{project.name}</h1>
            <div className="mt-3 flex flex-col gap-1.5 text-sm text-muted-foreground sm:flex-row sm:gap-4">
              <p className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4" />
                {project.client}
              </p>
              <p className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {project.location}
              </p>
              <p className="flex items-center gap-1.5">
                <CalendarIcon className="h-4 w-4" />
                {formatDate(project.startDate)} → {formatDate(project.estimatedEndDate)}
              </p>
            </div>
            {project.description && (
              <p className="mt-3 text-sm text-muted-foreground">{project.description}</p>
            )}
          </div>
          <div className="rounded-lg bg-secondary/50 p-4 sm:min-w-[220px]">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Avance</p>
            <p className="mt-1 text-3xl font-semibold">{formatPercent(percent)}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-background">
              <div
                className={cn(
                  "h-full",
                  percent >= 90 ? "bg-emerald-500" : percent >= 30 ? "bg-primary" : "bg-amber-500"
                )}
                style={{ width: `${Math.min(percent, 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {formatCurrency(project.executedAmount)} de {formatCurrency(project.totalBudget)}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="resumen" className="space-y-4">
        <TabsList>
          <TabsTrigger value="resumen">
            <Activity className="mr-1.5 h-4 w-4" />
            Resumen
          </TabsTrigger>
          <TabsTrigger value="presupuesto">
            <Calculator className="mr-1.5 h-4 w-4" />
            Presupuesto
          </TabsTrigger>
          <TabsTrigger value="cortes">
            <Scissors className="mr-1.5 h-4 w-4" />
            Cortes
            {projectCuts.length > 0 && (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                {projectCuts.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="contratistas">
            <Truck className="mr-1.5 h-4 w-4" />
            Contratistas
          </TabsTrigger>
          <TabsTrigger value="bitacora">
            <BookOpen className="mr-1.5 h-4 w-4" />
            Bitácora
          </TabsTrigger>
        </TabsList>

        {/* Resumen */}
        <TabsContent value="resumen" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Presupuesto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{formatCurrency(project.totalBudget)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Ejecutado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{formatCurrency(project.executedAmount)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Cortes totales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{projectCuts.length}</p>
                {cutsPending > 0 && (
                  <p className="text-xs text-amber-600">{cutsPending} pendientes</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  En cortes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{formatCurrency(cutsTotal)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Avance financiero</CardTitle>
              <CardDescription>
                Ejecutado vs presupuesto total aprobado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-6 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="flex h-full items-center justify-end bg-primary px-2 text-xs font-medium text-primary-foreground"
                    style={{ width: `${Math.max(Math.min(percent, 100), 5)}%` }}
                  >
                    {formatPercent(percent)}
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Saldo por ejecutar:</span>
                  <span className="font-semibold">
                    {formatCurrency(project.totalBudget - project.executedAmount)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Presupuesto */}
        <TabsContent value="presupuesto">
          <Card>
            <CardHeader>
              <CardTitle>Estructura presupuestal</CardTitle>
              <CardDescription>
                El presupuesto se importará desde Excel cuando se active la carga de archivos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed p-8 text-center">
                <Calculator className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">Sin presupuesto asignado</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Próximamente: importar Excel o crear capítulos manualmente
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cortes */}
        <TabsContent value="cortes">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Cortes de obra</CardTitle>
                  <CardDescription>
                    {projectCuts.length} cortes registrados
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" disabled>
                  <Scissors className="mr-2 h-4 w-4" />
                  Nuevo corte
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {projectCuts.length === 0 ? (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No hay cortes registrados para este proyecto
                </p>
              ) : (
                <div className="space-y-2">
                  {projectCuts.map((cut) => {
                    const statusVariant: "success" | "destructive" | "default" | "warning" =
                      cut.status === "APPROVED" || cut.status === "PAID"
                        ? "success"
                        : cut.status === "REJECTED"
                        ? "destructive"
                        : cut.status === "DRAFT"
                        ? "default"
                        : "warning";
                    return (
                      <div key={cut.id} className="flex items-center justify-between rounded-md border p-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-xs text-muted-foreground">{cut.cutNumber}</p>
                          <p className="text-sm font-medium">{cut.description}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(cut.netValue)}</p>
                          <Badge variant={statusVariant} className="mt-1">
                            {cut.status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contratistas */}
        <TabsContent value="contratistas">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Proveedores asignados</CardTitle>
                  <CardDescription>Personal y empresas vinculados al proyecto</CardDescription>
                </div>
                <Button variant="outline" size="sm" disabled>
                  <Users className="mr-2 h-4 w-4" />
                  Vincular
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {projectProviders.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        NIT {c.nit} · {c.contact}
                      </p>
                    </div>
                    <Badge
                      variant={
                        c.status === "COMPLETE"
                          ? "success"
                          : c.status === "EXPIRED"
                          ? "destructive"
                          : "warning"
                      }
                    >
                      {c.status === "COMPLETE"
                        ? "Habilitado"
                        : c.status === "EXPIRED"
                        ? "Docs vencidos"
                        : "Incompleto"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bitácora */}
        <TabsContent value="bitacora">
          <Card>
            <CardHeader>
              <CardTitle>Bitácora del proyecto</CardTitle>
              <CardDescription>Registro diario de actividades</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed p-8 text-center">
                <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">Bitácora no disponible aún</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Se mostrará cuando se cree el primer registro
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal editar */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modificar proyecto</DialogTitle>
            <DialogDescription>
              {project.code} · Cambia fechas, presupuesto u otros datos. El estado no se puede modificar.
            </DialogDescription>
          </DialogHeader>
          <ProjectForm project={project} onSuccess={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar proyecto?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Se eliminará{" "}
              <strong>{project.name}</strong> ({project.code}) y todos sus datos asociados
              (presupuestos, cortes, contratos, bitácoras).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteProject(project.id);
                router.push("/tecnico/proyectos");
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
