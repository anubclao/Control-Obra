"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  FileSpreadsheet,
  Search,
  Upload,
  Building2,
  MapPin,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  FileText,
  Eye,
  DollarSign,
  BarChart3,
  Layers,
} from "lucide-react";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { PROJECT_STATUS } from "@/lib/constants";
import { UploadBudgetDialog } from "./upload-budget-dialog";

interface PresupuestosClientProps {
  projects: any[];
  stats: {
    withBudget: number;
    withoutBudget: number;
    totalPC: number;
    totalPT: number;
    totalItems: number;
  };
  userRole: string;
}

export function PresupuestosClient({
  projects,
  stats,
  userRole,
}: PresupuestosClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const router = useRouter();
  const isAdmin = userRole === "ADMIN";

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.code && p.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const projectsWithBudget = filteredProjects.filter((p) => p.budget !== null);

  const handleProjectSelect = (projectId: string) => {
    setSelectedProject(projectId);
    if (projectId) {
      router.push(`/dashboard/presupuestos/${projectId}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Presupuestos</h1>
          <p className="text-gray-600">
            Gestión de presupuestos PC, PT y PCS agrupados por proyecto
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowUploadDialog(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Cargar presupuesto
          </Button>
        )}
      </div>

      {/* Gestión Rápida */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            Gestión Rápida de Presupuesto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <label className="text-sm font-medium">Seleccionar Proyecto</label>
            <Select value={selectedProject} onValueChange={handleProjectSelect}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Seleccione un proyecto..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.code ? `${project.code} - ` : ""}
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
            <FileText className="w-4 h-4" />
            <span>
              Los presupuestos también se gestionan desde cada proyecto.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Proyectos con Presupuesto</p>
                <p className="text-2xl font-bold">{stats.withBudget}</p>
              </div>
              <FileSpreadsheet className="w-10 h-10 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Sin Presupuesto</p>
                <p className="text-2xl font-bold text-orange-600">
                  {stats.withoutBudget}
                </p>
              </div>
              <AlertTriangle className="w-10 h-10 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total PSC (Contratista)</p>
                <p className="text-lg font-bold text-green-700">
                  {formatCurrency(stats.totalPC)}
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total PT (Tope)</p>
                <p className="text-lg font-bold text-blue-700">
                  {formatCurrency(stats.totalPT)}
                </p>
              </div>
              <TrendingDown className="w-10 h-10 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Proyectos y Presupuestos */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="text-lg">Proyectos y sus Presupuestos</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar proyecto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredProjects.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No se encontraron proyectos
              </div>
            ) : (
              filteredProjects.map((project) => (
                <div
                  key={project.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Info del Proyecto */}
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Building2 className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {project.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-600">
                          {project.code && (
                            <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                              {project.code}
                            </span>
                          )}
                          {project.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {project.location}
                            </span>
                          )}
                          <span>• {project.client}</span>
                        </div>
                      </div>
                    </div>

                    {/* Estado del Presupuesto */}
                    <div className="flex flex-wrap items-center gap-4">
                      {project.budget ? (
                        <>
                          {/* Versión Activa */}
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Versión Activa</p>
                            <p className="font-medium text-sm">
                              {project.budget.versions[0]?.name || "Sin versión"}
                            </p>
                            <p className="text-xs text-gray-500">
                              AIU: {project.budget.aiuPercentage}%
                            </p>
                          </div>

                          {/* Totales */}
                          <div className="text-right">
                            <p className="text-xs text-gray-500">PC (Cliente)</p>
                            <p className="font-semibold text-green-700">
                              {formatCurrency(project.budget.totalPC)}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-xs text-gray-500">PT (Tope)</p>
                            <p className="font-semibold text-blue-700">
                              {formatCurrency(project.budget.totalPT)}
                            </p>
                          </div>

                          {/* Indicador */}
                          {project.budget.totalPC < project.budget.totalPT && (
                            <Badge variant="destructive" className="text-xs">
                              Crítico
                            </Badge>
                          )}

                          {/* Items */}
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Items</p>
                            <p className="font-medium">
                              {project.budget.layers.reduce(
                                (sum: number, l: any) => sum + l._count.items,
                                0
                              )}
                            </p>
                          </div>
                        </>
                      ) : (
                        <Badge variant="outline" className="text-orange-600 border-orange-300">
                          Sin Presupuesto
                        </Badge>
                      )}

                      {/* Botón Ver */}
                      <Link href={`/dashboard/presupuestos/${project.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4 mr-1" />
                          Ver Presupuesto
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Carga */}
      <UploadBudgetDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        projects={projects}
      />
    </div>
  );
}
