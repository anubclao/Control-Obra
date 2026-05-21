"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  User,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  FileText,
  BookOpen,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { PROJECT_STATUS } from "@/lib/constants";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type ProjectData = any;

type Props = {
  project: ProjectData;
  totalSpent: number;
  userRole: string;
};

export default function ProyectoDetailsClient({
  project,
  totalSpent,
  userRole,
}: Props) {
  const executionPercentage =
    (project?.totalBudget ?? 0) > 0
      ? (totalSpent / (project?.totalBudget ?? 1)) * 100
      : 0;
  const available = (project?.totalBudget ?? 0) - totalSpent;
  const isOverBudget = totalSpent > (project?.totalBudget ?? 0);

  // Detectar centros con sobrecostos
  const overBudgetCenters = project?.costCenters?.filter?.(
    (cc: any) => (cc?.spentAmount ?? 0) > (cc?.assignedBudget ?? 0)
  ) ?? [];

  // Preparar datos para gráfico
  const chartData = project?.costCenters?.map?.((cc: any) => ({
    name: cc?.name?.length > 15 ? cc?.name?.substring?.(0, 15) + "..." : cc?.name,
    asignado: cc?.assignedBudget ?? 0,
    gastado: cc?.spentAmount ?? 0,
  })) ?? [];

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
      <div className="flex items-center gap-4">
        <Link href="/dashboard/proyectos">
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">{project?.name}</h1>
            {getStatusBadge(project?.status ?? "")}
            {isOverBudget && (
              <Badge variant="destructive">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Sobre Presupuesto
              </Badge>
            )}
          </div>
          <p className="text-gray-600 mt-1">Cliente: {project?.client}</p>
        </div>
      </div>

      {/* Información General */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Información General</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-blue-600 mt-1" />
              <div>
                <p className="text-sm text-gray-600">Fecha de Inicio</p>
                <p className="font-semibold">{formatDate(project?.startDate)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-purple-600 mt-1" />
              <div>
                <p className="text-sm text-gray-600">Finalización Estimada</p>
                <p className="font-semibold">{formatDate(project?.estimatedEndDate)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-green-600 mt-1" />
              <div>
                <p className="text-sm text-gray-600">Creado por</p>
                <p className="font-semibold">{project?.createdBy?.name}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-yellow-600 mt-1" />
              <div>
                <p className="text-sm text-gray-600">Cortes Aprobados</p>
                <p className="font-semibold">{project?.workCuts?.length ?? 0}</p>
              </div>
            </div>
          </div>
          {project?.description && (
            <>
              <Separator className="my-4" />
              <div>
                <p className="text-sm text-gray-600 mb-2">Descripción</p>
                <p className="text-gray-900">{project?.description}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Resumen Presupuestal */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Presupuesto Total</p>
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(project?.totalBudget ?? 0)}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Gastado</p>
              <TrendingUp className="w-5 h-5 text-yellow-600" />
            </div>
            <p
              className={`text-2xl font-bold ${
                isOverBudget ? "text-red-600" : "text-gray-900"
              }`}
            >
              {formatCurrency(totalSpent)}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Disponible</p>
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <p
              className={`text-2xl font-bold ${
                available < 0 ? "text-red-600" : "text-gray-900"
              }`}
            >
              {formatCurrency(available)}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Ejecución</p>
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {executionPercentage?.toFixed?.(1) ?? 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Progreso de Ejecución Presupuestal
            </span>
            <span className="text-sm font-medium">
              {executionPercentage?.toFixed?.(1) ?? 0}%
            </span>
          </div>
          <Progress value={Math.min(executionPercentage, 100)} className="h-3" />
        </CardContent>
      </Card>

      {/* Alertas de Sobrecostos */}
      {overBudgetCenters?.length > 0 && (
        <Card className="shadow-md border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Alertas de Sobrecosto ({overBudgetCenters?.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overBudgetCenters?.map?.((cc: any) => (
                <div
                  key={cc?.id}
                  className="p-3 bg-white rounded border border-red-300"
                >
                  <p className="font-semibold text-red-900">{cc?.name}</p>
                  <p className="text-sm text-red-700">
                    Gastado: {formatCurrency(cc?.spentAmount ?? 0)} / Asignado:{" "}
                    {formatCurrency(cc?.assignedBudget ?? 0)}
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    Sobrecosto: {formatCurrency((cc?.spentAmount ?? 0) - (cc?.assignedBudget ?? 0))}
                  </p>
                </div>
              )) ?? []}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gráfico de Centros de Costo */}
      {chartData?.length > 0 && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Distribución Presupuestal por Centro de Costo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                >
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                  />
                  <Tooltip
                    formatter={(value: any) => formatCurrency(value)}
                    contentStyle={{ fontSize: 11 }}
                  />
                  <Bar dataKey="asignado" fill="#60B5FF" name="Asignado" />
                  <Bar dataKey="gastado" fill="#FF9149" name="Gastado" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Últimos Cortes Aprobados */}
      {project?.workCuts?.length > 0 && (
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Últimos Cortes Aprobados</CardTitle>
              <Link href="/dashboard/cortes">
                <Button variant="outline" size="sm">
                  Ver todos
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {project?.workCuts?.map?.((wc: any) => (
                <Link key={wc?.id} href={`/dashboard/cortes/${wc?.id}`}>
                  <div className="p-3 border rounded hover:border-blue-500 hover:shadow-md transition-all cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">
                          Corte #{wc?.cutNumber} - {wc?.contractor?.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Centro: {wc?.costCenter?.name}
                        </p>
                      </div>
                      <p className="font-semibold text-green-600">
                        {formatCurrency(wc?.requestedAmount ?? 0)}
                      </p>
                    </div>
                  </div>
                </Link>
              )) ?? []}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Últimas Bitácoras */}
      {project?.workLogs?.length > 0 && (
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Últimas Entradas de Bitácora</CardTitle>
              <Link href="/dashboard/bitacora">
                <Button variant="outline" size="sm">
                  Ver todas
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {project?.workLogs?.map?.((log: any) => (
                <div key={log?.id} className="p-3 border rounded">
                  <div className="flex items-start gap-3">
                    <BookOpen className="w-4 h-4 text-blue-600 mt-1" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {formatDate(log?.date)} - {log?.createdBy?.name}
                      </p>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                        {log?.activities}
                      </p>
                      {log?.contractor && (
                        <p className="text-xs text-gray-500 mt-1">
                          Subcontratista: {log?.contractor?.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )) ?? []}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
