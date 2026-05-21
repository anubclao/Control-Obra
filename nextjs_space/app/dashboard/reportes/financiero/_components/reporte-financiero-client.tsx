'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  Building2,
  Calculator,
  PieChart,
  BarChart3,
  ArrowRight,
  Settings,
  AlertTriangle
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { PROJECT_STATUS } from '@/lib/constants';

type ProjectStatusKey = keyof typeof PROJECT_STATUS;

interface FinancialProject {
  id: string;
  code: string | null;
  name: string;
  client: string;
  status: string;
  budgetPC: number;
  budgetPT: number;
  aiuPercentage: number;
  totalPaid: number;
  totalCutsApproved: number;
  totalContracts: number;
  totalTaxes: number;
  grossMargin: number;
  netMargin: number;
  marginPercentage: number;
  progressPercentage: number;
  layers: { code: string; name: string; totalPC: number; totalPT: number }[];
}

interface Totals {
  totalBudgetPC: number;
  totalBudgetPT: number;
  totalPaid: number;
  totalContracts: number;
  totalTaxes: number;
  totalMargin: number;
}

interface ReporteFinancieroClientProps {
  projects: FinancialProject[];
  totals: Totals;
}

export function ReporteFinancieroClient({ projects, totals }: ReporteFinancieroClientProps) {
  const [selectedProject, setSelectedProject] = useState<string>('ALL');

  const filteredProjects = selectedProject === 'ALL'
    ? projects
    : projects.filter(p => p.id === selectedProject);

  // Calcular totales filtrados
  const filteredTotals = selectedProject === 'ALL'
    ? totals
    : {
        totalBudgetPC: filteredProjects.reduce((sum, p) => sum + p.budgetPC, 0),
        totalBudgetPT: filteredProjects.reduce((sum, p) => sum + p.budgetPT, 0),
        totalPaid: filteredProjects.reduce((sum, p) => sum + p.totalPaid, 0),
        totalContracts: filteredProjects.reduce((sum, p) => sum + p.totalContracts, 0),
        totalTaxes: filteredProjects.reduce((sum, p) => sum + p.totalTaxes, 0),
        totalMargin: filteredProjects.reduce((sum, p) => sum + p.netMargin, 0)
      };

  const marginHealthy = filteredTotals.totalMargin > 0;
  const overallProgress = filteredTotals.totalBudgetPC > 0
    ? (filteredTotals.totalPaid / filteredTotals.totalBudgetPC) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reporte Financiero</h1>
          <p className="text-gray-500 mt-1">Presupuesto vs Ejecutado con análisis de impuestos</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/reportes/impuestos">
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Configurar Impuestos
            </Button>
          </Link>
        </div>
      </div>

      {/* Filtro de proyecto */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Filtrar por proyecto:</label>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-80">
                <SelectValue placeholder="Seleccionar proyecto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los proyectos</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.code ? `${project.code} - ` : ''}{project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Presupuesto Total (PC)</p>
                <p className="text-2xl font-bold">{formatCurrency(filteredTotals.totalBudgetPC)}</p>
                <p className="text-xs text-gray-400">PT: {formatCurrency(filteredTotals.totalBudgetPT)}</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Calculator className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Ejecutado (Pagado)</p>
                <p className="text-2xl font-bold">{formatCurrency(filteredTotals.totalPaid)}</p>
                <p className="text-xs text-gray-400">{overallProgress.toFixed(1)}% del presupuesto</p>
              </div>
              <div className="h-12 w-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Impuestos Estimados</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(filteredTotals.totalTaxes)}</p>
              </div>
              <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
                <FileText className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={marginHealthy ? 'border-green-200' : 'border-red-200'}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Margen Neto</p>
                <p className={`text-2xl font-bold ${marginHealthy ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(filteredTotals.totalMargin)}
                </p>
              </div>
              <div className={`h-12 w-12 ${marginHealthy ? 'bg-green-100' : 'bg-red-100'} rounded-lg flex items-center justify-center`}>
                {marginHealthy ? (
                  <TrendingUp className="h-6 w-6 text-green-600" />
                ) : (
                  <TrendingDown className="h-6 w-6 text-red-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de progreso general */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Progreso de Ejecución
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>Presupuesto PSC: {formatCurrency(filteredTotals.totalBudgetPC)}</span>
              <span>Ejecutado: {formatCurrency(filteredTotals.totalPaid)}</span>
            </div>
            <Progress value={Math.min(overallProgress, 100)} className="h-4" />
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>{overallProgress.toFixed(1)}% completado</span>
              <span>Pendiente: {formatCurrency(filteredTotals.totalBudgetPC - filteredTotals.totalPaid)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detalle por proyecto */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Detalle por Proyecto
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredProjects.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No hay proyectos para mostrar</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProjects.map((project) => (
                <div key={project.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">
                          {project.code ? `${project.code} - ` : ''}{project.name}
                        </h3>
                        <Badge variant={project.status === 'IN_EXECUTION' ? 'success' : 'secondary'}>
                          {PROJECT_STATUS[project.status as ProjectStatusKey]}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500">{project.client}</p>
                    </div>
                    <Link href={`/dashboard/proyectos/${project.id}`}>
                      <Button variant="ghost" size="sm">
                        Ver <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500">Presupuesto PSC</p>
                      <p className="font-medium">{formatCurrency(project.budgetPC)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Ejecutado</p>
                      <p className="font-medium">{formatCurrency(project.totalPaid)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Impuestos</p>
                      <p className="font-medium text-red-600">{formatCurrency(project.totalTaxes)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Margen Neto</p>
                      <p className={`font-medium ${project.netMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(project.netMargin)}
                        <span className="text-xs ml-1">({project.marginPercentage.toFixed(1)}%)</span>
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Progreso</span>
                      <span>{project.progressPercentage.toFixed(1)}%</span>
                    </div>
                    <Progress 
                      value={Math.min(project.progressPercentage, 100)} 
                      className={`h-2 ${project.progressPercentage > 100 ? '[&>div]:bg-red-500' : ''}`}
                    />
                    {project.progressPercentage > 100 && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
                        <AlertTriangle className="h-3 w-3" />
                        Sobrecosto detectado
                      </div>
                    )}
                  </div>

                  {/* Capas del presupuesto */}
                  {project.layers.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-gray-500 mb-2">Desglose por Capa:</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {project.layers.slice(0, 4).map((layer) => (
                          <div key={layer.code} className="bg-gray-50 rounded p-2">
                            <p className="text-xs font-medium">{layer.code} - {layer.name}</p>
                            <p className="text-xs text-gray-600">
                              PSC: {formatCurrency(layer.totalPC)}
                            </p>
                          </div>
                        ))}
                        {project.layers.length > 4 && (
                          <div className="bg-gray-50 rounded p-2 flex items-center justify-center">
                            <p className="text-xs text-gray-500">+{project.layers.length - 4} más</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
