'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Calendar,
  FolderKanban,
  ChevronRight,
  TrendingUp,
  Clock,
  BarChart3,
  CalendarDays,
  Plus
} from 'lucide-react';
import { PROJECT_STATUS } from '@/lib/constants';
import { formatShortDate, formatCurrency } from '@/lib/format';

interface Project {
  id: string;
  code?: string | null;
  name: string;
  client: string;
  status: string;
  startDate: Date | string;
  estimatedEndDate: Date | string;
  budget?: {
    id: string;
    totalPC: number;
    totalPT: number;
  } | null;
  dailyProgress: Array<{
    id: string;
    date: Date | string;
    personnelCount: number;
    entries: Array<{
      quantityToday: number;
    }>;
  }>;
}

interface ProgramacionClientProps {
  projects: Project[];
  userRole: string;
}

export default function ProgramacionClient({ projects, userRole }: ProgramacionClientProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-7 w-7" />
            Programación y Avance
          </h1>
          <p className="text-gray-500 mt-1">Seguimiento diario del avance de obra</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Proyectos</p>
                <p className="text-2xl font-bold">{projects.length}</p>
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
                <p className="text-2xl font-bold text-green-600">
                  {projects.filter(p => p.budget).length}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Registros Hoy</p>
                <p className="text-2xl font-bold text-orange-600">
                  {projects.filter(p => 
                    p.dailyProgress.some(dp => 
                      new Date(dp.date).toDateString() === new Date().toDateString()
                    )
                  ).length}
                </p>
              </div>
              <CalendarDays className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Personal Hoy</p>
                <p className="text-2xl font-bold text-purple-600">
                  {projects.reduce((sum, p) => {
                    const today = p.dailyProgress.find(dp => 
                      new Date(dp.date).toDateString() === new Date().toDateString()
                    );
                    return sum + (today?.personnelCount || 0);
                  }, 0)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Proyectos con Presupuesto</CardTitle>
          <CardDescription>
            Seleccione un proyecto para ver o registrar avance diario
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
                const hasProgressToday = lastProgress && 
                  new Date(lastProgress.date).toDateString() === new Date().toDateString();
                
                return (
                  <Link key={project.id} href={`/dashboard/programacion/${project.id}`}>
                    <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {project.code && (
                              <span className="font-mono text-sm text-gray-500">
                                {project.code}
                              </span>
                            )}
                            <Badge variant={project.status === 'IN_EXECUTION' ? 'success' : 'secondary'}>
                              {PROJECT_STATUS[project.status as keyof typeof PROJECT_STATUS] || project.status}
                            </Badge>
                            {hasProgressToday && (
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                Actualizado hoy
                              </Badge>
                            )}
                          </div>
                          <p className="font-semibold mt-1">{project.name}</p>
                          <p className="text-sm text-gray-500">{project.client}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right hidden sm:block">
                            {project.budget ? (
                              <>
                                <p className="text-sm text-gray-500">
                                  Presupuesto: {formatCurrency(project.budget.totalPC)}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {project.dailyProgress.length} registros de avance
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
    </div>
  );
}
