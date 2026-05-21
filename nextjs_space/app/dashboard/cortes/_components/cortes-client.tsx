"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Scissors,
  TrendingUp,
  FolderKanban,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { WORK_CUT_STATUS, PROJECT_STATUS } from "@/lib/constants";

type WorkCutData = any;

type ProjectProgress = {
  id: string;
  code?: string | null;
  name: string;
  client: string;
  status: string;
  budget?: { id: string; totalPC: number; totalPT: number } | null;
  dailyProgress: Array<{ id: string; date: Date | string }>;
};

type Props = {
  workCuts: WorkCutData[];
  projects: ProjectProgress[];
  userRole: string;
};

export default function CortesClient({ workCuts, projects, userRole }: Props) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Filtrar cortes
  const filteredCuts = workCuts?.filter?.((cut) => {
    const matchesSearch =
      cut?.project?.name?.toLowerCase?.()?.includes?.(searchTerm?.toLowerCase?.() ?? "") ||
      cut?.contractor?.name?.toLowerCase?.()?.includes?.(searchTerm?.toLowerCase?.() ?? "") ||
      cut?.cutNumber?.toString?.()?.includes?.(searchTerm);
    const matchesStatus = !statusFilter || cut?.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) ?? [];

  // Estadísticas cortes
  const stats = {
    total: workCuts?.length ?? 0,
    pending: workCuts?.filter?.((c) => c?.status === "PENDING")?.length ?? 0,
    inReview: workCuts?.filter?.((c) => c?.status === "IN_REVIEW")?.length ?? 0,
    approved: workCuts?.filter?.((c) => c?.status === "APPROVED")?.length ?? 0,
    rejected: workCuts?.filter?.((c) => c?.status === "REJECTED")?.length ?? 0,
  };

  // Estadísticas avance
  const progressStats = {
    total: projects.length,
    withBudget: projects.filter((p) => p.budget).length,
    updatedToday: projects.filter((p) =>
      p.dailyProgress.some(
        (dp) => new Date(dp.date).toDateString() === new Date().toDateString()
      )
    ).length,
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: any; label: string; icon: any }> = {
      PENDING: { variant: "secondary", label: WORK_CUT_STATUS.PENDING, icon: Clock },
      IN_REVIEW: { variant: "default", label: WORK_CUT_STATUS.IN_REVIEW, icon: Eye },
      APPROVED: { variant: "success", label: WORK_CUT_STATUS.APPROVED, icon: CheckCircle },
      REJECTED: { variant: "destructive", label: WORK_CUT_STATUS.REJECTED, icon: XCircle },
    };
    const config = statusMap?.[status] ?? { variant: "secondary", label: status, icon: FileText };
    const Icon = config?.icon;
    return (
      <Badge variant={config?.variant}>
        <Icon className="w-3 h-3 mr-1" />
        {config?.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cortes de Obra</h1>
          <p className="text-gray-600 mt-1">Control de cortes, aprobaciones y avance</p>
        </div>
        {userRole === "ADMIN" && (
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href="/dashboard/cortes/nuevo">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Corte
            </Link>
          </Button>
        )}
      </div>

      <Tabs defaultValue="cortes" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-flex">
          <TabsTrigger value="cortes" className="flex items-center gap-2">
            <Scissors className="w-4 h-4" />
            Cortes de Obra
          </TabsTrigger>
          <TabsTrigger value="avance" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Avance de Obra
          </TabsTrigger>
        </TabsList>

        {/* ===== TAB CORTES ===== */}
        <TabsContent value="cortes" className="space-y-6">
          {/* Estadísticas */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total</p>
                    <p className="text-2xl font-bold text-gray-900">{stats?.total ?? 0}</p>
                  </div>
                  <FileText className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Pendientes</p>
                    <p className="text-2xl font-bold text-gray-900">{stats?.pending ?? 0}</p>
                  </div>
                  <Clock className="w-8 h-8 text-gray-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">En Revisión</p>
                    <p className="text-2xl font-bold text-gray-900">{stats?.inReview ?? 0}</p>
                  </div>
                  <Eye className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Aprobados</p>
                    <p className="text-2xl font-bold text-gray-900">{stats?.approved ?? 0}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Rechazados</p>
                    <p className="text-2xl font-bold text-gray-900">{stats?.rejected ?? 0}</p>
                  </div>
                  <XCircle className="w-8 h-8 text-red-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Buscador y Filtros */}
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar por proyecto, subcontratista o número..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e?.target?.value ?? "")}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={statusFilter === null ? "default" : "outline"}
                    onClick={() => setStatusFilter(null)}
                    size="sm"
                  >
                    Todos
                  </Button>
                  <Button
                    variant={statusFilter === "PENDING" ? "default" : "outline"}
                    onClick={() => setStatusFilter("PENDING")}
                    size="sm"
                  >
                    Pendientes
                  </Button>
                  <Button
                    variant={statusFilter === "IN_REVIEW" ? "default" : "outline"}
                    onClick={() => setStatusFilter("IN_REVIEW")}
                    size="sm"
                  >
                    En Revisión
                  </Button>
                  <Button
                    variant={statusFilter === "APPROVED" ? "default" : "outline"}
                    onClick={() => setStatusFilter("APPROVED")}
                    size="sm"
                  >
                    Aprobados
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Listado de Cortes */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Listado de Cortes ({filteredCuts?.length ?? 0})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredCuts?.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    No se encontraron cortes
                  </p>
                ) : (
                  filteredCuts?.map?.((cut) => (
                    <div
                      key={cut?.id}
                      onClick={() => router.push(`/dashboard/cortes/${cut?.id}`)}
                      className="p-4 border rounded-lg hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-lg font-semibold text-gray-900">
                              Corte #{cut?.cutNumber}
                            </h3>
                            {getStatusBadge(cut?.status ?? "")}
                          </div>
                          <p className="text-sm text-gray-600">
                            Proyecto: {cut?.project?.name}
                          </p>
                          <p className="text-sm text-gray-600">
                            Subcontratista: {cut?.contractor?.name}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">
                            {formatCurrency(cut?.requestedAmount ?? 0)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {cut?._count?.documents ?? 0} documentos
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-500">Centro de Costo</p>
                          <p className="font-medium">{cut?.costCenter?.name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Período</p>
                          <p className="font-medium">
                            {formatDate(cut?.periodStart)} - {formatDate(cut?.periodEnd)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Creado</p>
                          <p className="font-medium">{formatDate(cut?.createdAt)}</p>
                        </div>
                      </div>

                      {cut?.status === "APPROVED" && cut?.approvedBy && (
                        <div className="mt-2 pt-2 border-t">
                          <p className="text-xs text-gray-500">
                            Aprobado por {cut?.approvedBy?.name} el{" "}
                            {formatDate(cut?.approvedAt)}
                          </p>
                        </div>
                      )}

                      {cut?.status === "REJECTED" && cut?.rejectionReason && (
                        <div className="mt-2 pt-2 border-t">
                          <p className="text-xs text-red-600">
                            Razón: {cut?.rejectionReason}
                          </p>
                        </div>
                      )}
                    </div>
                  )) ?? []
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TAB AVANCE DE OBRA ===== */}
        <TabsContent value="avance" className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Proyectos</p>
                    <p className="text-2xl font-bold">{progressStats.total}</p>
                  </div>
                  <FolderKanban className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Con Presupuesto</p>
                    <p className="text-2xl font-bold text-green-600">{progressStats.withBudget}</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Actualizados Hoy</p>
                    <p className="text-2xl font-bold text-orange-600">{progressStats.updatedToday}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lista de proyectos con avance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Proyectos con Presupuesto</CardTitle>
              <CardDescription>
                Seleccione un proyecto para ver o registrar avance de obra
              </CardDescription>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? (
                <div className="text-center py-12">
                  <FolderKanban className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">No hay proyectos con presupuesto cargado</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Cargue un presupuesto en un proyecto para habilitar el seguimiento de avance
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {projects.map((project) => {
                    const lastProgress = project.dailyProgress[0];
                    const hasProgressToday =
                      lastProgress &&
                      new Date(lastProgress.date).toDateString() === new Date().toDateString();

                    return (
                      <Link
                        key={project.id}
                        href={`/dashboard/programacion/${project.id}`}
                      >
                        <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                {project.code && (
                                  <span className="font-mono text-sm text-gray-500">
                                    {project.code}
                                  </span>
                                )}
                                <Badge
                                  variant={
                                    project.status === "IN_EXECUTION" ? "success" : "secondary"
                                  }
                                >
                                  {PROJECT_STATUS[project.status as keyof typeof PROJECT_STATUS] ||
                                    project.status}
                                </Badge>
                                {hasProgressToday && (
                                  <Badge
                                    variant="outline"
                                    className="text-green-600 border-green-600"
                                  >
                                    Actualizado hoy
                                  </Badge>
                                )}
                              </div>
                              <p className="font-semibold">{project.name}</p>
                              <p className="text-sm text-gray-500">{project.client}</p>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right hidden sm:block">
                                {project.budget ? (
                                  <>
                                    <p className="text-sm text-gray-500">
                                      PSC: {formatCurrency(project.budget.totalPC)}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                      {project.dailyProgress.length === 0
                                        ? "Sin registros de avance"
                                        : `Último: ${formatDate(project.dailyProgress[0].date)}`}
                                    </p>
                                  </>
                                ) : (
                                  <p className="text-sm text-gray-400">Sin presupuesto</p>
                                )}
                              </div>
                              <ChevronRight className="h-5 w-5 text-gray-400" />
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
