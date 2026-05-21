'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import HistorialAvanceContratista from '@/components/dashboard-contratista-history';
import {
  ArrowLeft,
  Calendar,
  Plus,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { formatShortDate, formatCurrency } from '@/lib/format';
import NewProgressDialog from './new-progress-dialog';

interface ItemSummary {
  id: string;
  itemNumber: string;
  description: string;
  unit: string;
  totalQuantity: number;
  totalExecuted: number;
  remaining: number;
  progressPercentage: number;
  layerCode: string;
  layerName: string;
}

interface DailyProgress {
  id: string;
  date: Date | string;
  generalNotes?: string | null;
  createdBy: {
    name: string;
  };
  entries: Array<{
    quantityToday: number;
  }>;
}

interface Layer {
  id: string;
  code: string;
  name: string;
  items: Array<{
    id: string;
    itemNumber: string;
    description: string;
    unit: string;
    quantity: number;
    totalPC: number;
  }>;
}

interface Project {
  id: string;
  code?: string | null;
  name: string;
  client: string;
  status: string;
  budget?: {
    id: string;
    totalPC: number;
    layers: Layer[];
  } | null;
  dailyProgress: DailyProgress[];
}

interface Contractor {
  id: string;
  name: string;
}

interface ProjectProgressClientProps {
  project: Project;
  itemsSummary: ItemSummary[];
  overallProgress: number;
  canCreateProgress: boolean;
  contractors: Contractor[];
}

export default function ProjectProgressClient({ 
  project, 
  itemsSummary, 
  overallProgress, 
  canCreateProgress,
  contractors
}: ProjectProgressClientProps) {
  const router = useRouter();
  const [showNewDialog, setShowNewDialog] = useState(false);

  const todayStr = new Date().toDateString();

  // Stats
  const completedItems = itemsSummary.filter(i => i.progressPercentage >= 100).length;
  const inProgressItems = itemsSummary.filter(i => i.progressPercentage > 0 && i.progressPercentage < 100).length;
  const pendingItems = itemsSummary.filter(i => i.progressPercentage === 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/cortes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              {project.code && (
                <span className="font-mono text-sm text-gray-500">{project.code}</span>
              )}
              <h1 className="text-2xl font-bold">{project.name}</h1>
            </div>
            <p className="text-gray-500">{project.client}</p>
          </div>
        </div>

      </div>

      {!project.budget && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-800">Sin Presupuesto del Proyecto</p>
                <p className="text-sm text-yellow-700">
                  El seguimiento general por proyecto requiere presupuesto base, pero el historial de contratista se mantiene disponible con su presupuesto independiente.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {project.budget && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="col-span-2">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium text-gray-500">Avance General</p>
                  <span className="text-2xl font-bold text-blue-600">
                    {overallProgress.toFixed(1)}%
                  </span>
                </div>
                <Progress value={overallProgress} className="h-3" />
                <p className="text-xs text-gray-400">
                  Basado en valor PC: {formatCurrency(project.budget.totalPC)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Completados</p>
                  <p className="text-2xl font-bold text-green-600">{completedItems}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">En Progreso</p>
                  <p className="text-2xl font-bold text-blue-600">{inProgressItems}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Pendientes</p>
                  <p className="text-2xl font-bold text-gray-600">{pendingItems}</p>
                </div>
                <Clock className="h-8 w-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="contratista-history" className="space-y-4">
        <TabsList>
          <TabsTrigger value="progress" disabled={!project.budget}>Historial de Avance</TabsTrigger>
          <TabsTrigger value="contratista-history">Avance por Ítem Contratista</TabsTrigger>
        </TabsList>

        {/* Historial de Avances */}
        {project.budget && (
          <TabsContent value="progress">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Registros de Avance ({project.dailyProgress.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {project.dailyProgress.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500">No hay registros de avance</p>
                    {canCreateProgress && (
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => setShowNewDialog(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Registrar Primer Avance
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {project.dailyProgress.map((dp) => {
                      const isToday = new Date(dp.date).toDateString() === todayStr;
                      return (
                        <Link key={dp.id} href={`/dashboard/programacion/${project.id}/${dp.id}`}>
                          <div className={`border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                            isToday ? 'border-blue-200 bg-blue-50' : ''
                          }`}>
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-gray-400" />
                                  <span className="font-semibold">
                                    {formatShortDate(dp.date)}
                                  </span>
                                  {isToday && (
                                    <Badge variant="default">Hoy</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500 mt-1">
                                  {dp.entries.length} actividades registradas
                                </p>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right text-sm">
                                  <p className="text-xs text-gray-400">
                                    Por: {dp.createdBy.name}
                                  </p>
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
        )}

        {/* Historial avance Contratista (independiente del presupuesto base del proyecto) */}
        <TabsContent value="contratista-history">
          <HistorialAvanceContratista projectId={project.id} />
        </TabsContent>
      </Tabs>

      {/* Dialog para nuevo avance */}
      {project.budget && (
        <NewProgressDialog
          open={showNewDialog}
          onOpenChange={setShowNewDialog}
          projectId={project.id}
          layers={project.budget.layers}
          contractors={contractors}
          onSuccess={() => {
            setShowNewDialog(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
