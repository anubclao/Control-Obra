"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  FolderOpen,
  Calendar,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { PROJECT_STATUS } from "@/lib/constants";

type ProjectData = {
  id: string;
  name: string;
  client: string;
  status: string;
  totalBudget: number;
  totalSpent: number;
  startDate: Date;
  estimatedEndDate: Date;
  createdBy: { name: string };
  _count: { workCuts: number; workLogs: number };
};

type Props = {
  projects: ProjectData[];
  userRole: string;
};

export default function ProyectosClient({ projects, userRole }: Props) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Filtrar proyectos
  const filteredProjects = projects?.filter?.((project) => {
    const matchesSearch =
      project?.name?.toLowerCase?.()?.includes?.(searchTerm?.toLowerCase?.() ?? "") ||
      project?.client?.toLowerCase?.()?.includes?.(searchTerm?.toLowerCase?.() ?? "");
    const matchesStatus = !statusFilter || project?.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) ?? [];

  // Estadísticas
  const stats = {
    total: projects?.length ?? 0,
    inExecution: projects?.filter?.((p) => p?.status === "IN_EXECUTION")?.length ?? 0,
    completed: projects?.filter?.((p) => p?.status === "COMPLETED")?.length ?? 0,
    totalBudget: projects?.reduce?.((sum, p) => sum + (p?.totalBudget ?? 0), 0) ?? 0,
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: any; label: string }> = {
      IN_PLANNING: { variant: "secondary", label: PROJECT_STATUS.IN_PLANNING },
      IN_EXECUTION: { variant: "default", label: PROJECT_STATUS.IN_EXECUTION },
      PAUSED: { variant: "warning", label: PROJECT_STATUS.PAUSED },
      COMPLETED: { variant: "success", label: PROJECT_STATUS.COMPLETED },
    };
    const config = statusMap?.[status] ?? { variant: "secondary", label: status };
    return <Badge variant={config?.variant}>{config?.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Proyectos</h1>
          <p className="text-gray-600 mt-1">Gestión de proyectos y presupuestos</p>
        </div>
        {userRole === "ADMIN" && (
          <Link href="/dashboard/proyectos/nuevo">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Proyecto
            </Button>
          </Link>
        )}
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Proyectos</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.total ?? 0}</p>
              </div>
              <FolderOpen className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">En Ejecución</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.inExecution ?? 0}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completados</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.completed ?? 0}</p>
              </div>
              <Calendar className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Presupuesto Total</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats?.totalBudget ?? 0)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-yellow-600" />
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
                placeholder="Buscar por nombre o cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e?.target?.value ?? "")}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === null ? "default" : "outline"}
                onClick={() => setStatusFilter(null)}
                size="sm"
              >
                Todos
              </Button>
              <Button
                variant={statusFilter === "IN_EXECUTION" ? "default" : "outline"}
                onClick={() => setStatusFilter("IN_EXECUTION")}
                size="sm"
              >
                En Ejecución
              </Button>
              <Button
                variant={statusFilter === "COMPLETED" ? "default" : "outline"}
                onClick={() => setStatusFilter("COMPLETED")}
                size="sm"
              >
                Completados
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Listado de Proyectos */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Listado de Proyectos ({filteredProjects?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredProjects?.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No se encontraron proyectos
              </p>
            ) : (
              filteredProjects?.map?.((project) => {
                const executionPercentage =
                  (project?.totalBudget ?? 0) > 0
                    ? ((project?.totalSpent ?? 0) / (project?.totalBudget ?? 1)) * 100
                    : 0;
                const isOverBudget = (project?.totalSpent ?? 0) > (project?.totalBudget ?? 0);

                return (
                  <div
                    key={project?.id}
                    onClick={() => router.push(`/dashboard/proyectos/${project?.id}`)}
                    className="p-4 border rounded-lg hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {project?.name}
                          </h3>
                          {getStatusBadge(project?.status ?? "")}
                          {isOverBudget && (
                            <Badge variant="destructive">Sobre Presupuesto</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Cliente: {project?.client}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-gray-500">Presupuesto Total</p>
                        <p className="text-sm font-semibold">
                          {formatCurrency(project?.totalBudget ?? 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Gastado</p>
                        <p
                          className={`text-sm font-semibold ${
                            isOverBudget ? "text-red-600" : "text-gray-900"
                          }`}
                        >
                          {formatCurrency(project?.totalSpent ?? 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Disponible</p>
                        <p className="text-sm font-semibold">
                          {formatCurrency(
                            (project?.totalBudget ?? 0) - (project?.totalSpent ?? 0)
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600">Ejecución Presupuestal</span>
                        <span className="text-xs font-medium">
                          {executionPercentage?.toFixed?.(1) ?? 0}%
                        </span>
                      </div>
                      <Progress
                        value={Math.min(executionPercentage, 100)}
                        className="h-2"
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Creado por {project?.createdBy?.name}</span>
                      <div className="flex gap-4">
                        <span>{project?._count?.workCuts ?? 0} cortes</span>
                        <span>{project?._count?.workLogs ?? 0} bitácoras</span>
                      </div>
                    </div>
                  </div>
                );
              }) ?? []
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
