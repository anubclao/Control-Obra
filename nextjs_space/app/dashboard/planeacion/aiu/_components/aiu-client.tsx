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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Building2,
  FileText,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Bell,
  Settings,
  ChevronRight,
  Percent,
  DollarSign,
  Loader2,
  CheckCircle,
  FileWarning,
  Clock,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { PROJECT_STATUS } from "@/lib/constants";

interface AIUClientProps {
  projects: any[];
  stats: {
    totalProyectos: number;
    proyectosActivos: number;
    proyectosConPresupuesto: number;
    totalPresupuestoPC: number;
    totalPresupuestoPT: number;
    totalEjecutado: number;
    margenProyectado: number;
  };
  alerts: any[];
  userRole: string;
}

export function AIUClient({ projects, stats, alerts, userRole }: AIUClientProps) {
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [newAIU, setNewAIU] = useState<number>(30);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const router = useRouter();
  const isAdmin = userRole === "ADMIN";

  // Preparar datos para el gráfico
  const chartData = projects
    .filter((p) => p.hasBudget)
    .slice(0, 5)
    .map((p) => ({
      name: p.name.length > 15 ? p.name.substring(0, 15) + "..." : p.name,
      "Presupuesto PSC": p.totalPC / 1000000,
      "Presupuesto Tope": p.totalPT / 1000000,
      Ejecutado: p.ejecutado / 1000000,
    }));

  const handleEditAIU = (project: any) => {
    setSelectedProject(project);
    setNewAIU(project.aiuPercentage);
    setShowEditDialog(true);
  };

  const handleUpdateAIU = async () => {
    if (!selectedProject) return;

    setIsUpdating(true);
    try {
      const response = await fetch("/api/aiu", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProject.id,
          aiuPercentage: newAIU,
        }),
      });

      if (response.ok) {
        setShowEditDialog(false);
        router.refresh();
      }
    } catch (error) {
      console.error("Error updating AIU:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "expired":
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case "expiring":
        return <Clock className="w-5 h-5 text-orange-500" />;
      case "cost":
        return <TrendingDown className="w-5 h-5 text-yellow-500" />;
      case "workcut":
        return <FileText className="w-5 h-5 text-blue-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getAlertBgColor = (type: string) => {
    switch (type) {
      case "expired":
        return "bg-red-50 border-red-200";
      case "expiring":
        return "bg-orange-50 border-orange-200";
      case "cost":
        return "bg-yellow-50 border-yellow-200";
      case "workcut":
        return "bg-blue-50 border-blue-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  // Calcular variación (simulada)
  const variacionPresupuesto = 2.3;
  const variacionEjecutado = 5.8;
  const variacionMargen = -0.8;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Gerencial</h1>
        <p className="text-gray-600">Vista general de proyectos y control financiero</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Proyectos Activos</p>
                <p className="text-3xl font-bold">{stats.proyectosActivos}</p>
                <p className="text-xs text-gray-500 mt-1">- 0% vs mes anterior</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Presupuesto Total</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalPresupuestoPC)}</p>
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  +{variacionPresupuesto}% vs mes anterior
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Costo Ejecutado</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalEjecutado)}</p>
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  +{variacionEjecutado}% vs mes anterior
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Margen Proyectado</p>
                <p className="text-3xl font-bold">{stats.margenProyectado.toFixed(1)}%</p>
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" />
                  {variacionMargen}% vs mes anterior
                </p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Presupuesto vs Ejecución
              </CardTitle>
              <p className="text-sm text-gray-500">Comparativo por proyecto (millones COP)</p>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip
                      formatter={(value: number) => [
                        `$${value.toLocaleString()}M`,
                        "",
                      ]}
                    />
                    <Legend />
                    <Bar
                      dataKey="Presupuesto PSC"
                      fill="#3B82F6"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="Presupuesto Tope"
                      fill="#6B7280"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="Ejecutado"
                      fill="#F59E0B"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                  No hay datos de presupuesto para mostrar
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Alertas */}
        <div>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Alertas y Notificaciones
              </CardTitle>
              <p className="text-sm text-gray-500">Requieren atención inmediata</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {alerts.length > 0 ? (
                alerts.slice(0, 5).map((alert, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${getAlertBgColor(alert.type)}`}
                  >
                    <div className="flex items-start gap-3">
                      {getAlertIcon(alert.type)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{alert.title}</p>
                        <p className="text-xs text-gray-600 truncate">
                          {alert.description}
                        </p>
                        {alert.projectName && (
                          <p className="text-xs text-gray-500 mt-1">
                            {alert.projectName}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-400" />
                  <p>Sin alertas pendientes</p>
                </div>
              )}
              {alerts.length > 5 && (
                <Button variant="link" className="w-full">
                  Ver todas las alertas →
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabla de Configuración AIU */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Percent className="w-5 h-5" />
                Configuración AIU por Proyecto
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Administración, Imprevistos y Utilidad
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proyecto</TableHead>
                  <TableHead className="text-center">AIU %</TableHead>
                  <TableHead className="text-right">Costo Directo PSC</TableHead>
                  <TableHead className="text-right">AIU PSC</TableHead>
                  <TableHead className="text-right">Total PSC</TableHead>
                  <TableHead className="text-right">Ejecutado</TableHead>
                  <TableHead className="text-center">% Ejecución</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{project.name}</p>
                        <p className="text-xs text-gray-500">
                          {project.code || "Sin código"} • {project.client}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={project.hasBudget ? "default" : "outline"}
                        className="font-mono"
                      >
                        {project.aiuPercentage}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {project.hasBudget
                        ? formatCurrency(project.totalDirectCostPC)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {project.hasBudget
                        ? formatCurrency(project.totalAIU_PC)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {project.hasBudget
                        ? formatCurrency(project.totalPC)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-orange-600">
                      {formatCurrency(project.ejecutado)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          project.porcentajeEjecucion > 90
                            ? "destructive"
                            : project.porcentajeEjecucion > 70
                            ? "warning"
                            : "default"
                        }
                      >
                        {project.porcentajeEjecucion.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditAIU(project)}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog para editar AIU */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar AIU</DialogTitle>
            <DialogDescription>
              Ajuste el porcentaje de Administración, Imprevistos y Utilidad para{" "}
              <strong>{selectedProject?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Porcentaje AIU (%)</Label>
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={newAIU}
                  onChange={(e) => setNewAIU(parseFloat(e.target.value) || 0)}
                  className="w-32"
                />
                <span className="text-gray-500">%</span>
              </div>
              <p className="text-xs text-gray-500">
                El AIU se aplicará sobre el costo directo para calcular el total.
              </p>
            </div>

            {selectedProject && selectedProject.hasBudget && (
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">Vista previa:</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Costo Directo PC</p>
                    <p className="font-mono">
                      {formatCurrency(selectedProject.totalDirectCostPC)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Nuevo AIU PSC</p>
                    <p className="font-mono">
                      {formatCurrency(selectedProject.totalDirectCostPC * (newAIU / 100))}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500">Nuevo Total PSC</p>
                    <p className="font-mono font-bold text-lg">
                      {formatCurrency(
                        selectedProject.totalDirectCostPC +
                          selectedProject.totalDirectCostPC * (newAIU / 100)
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowEditDialog(false)}
                disabled={isUpdating}
              >
                Cancelar
              </Button>
              <Button onClick={handleUpdateAIU} disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar Cambios"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
