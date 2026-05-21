"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Calendar,
  Plus,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Layers,
} from "lucide-react";
import { formatShortDate, formatCurrency } from "@/lib/format";

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

interface ContractorProgressListClientProps {
  contract: any;
  itemsSummary: ItemSummary[];
  overallProgress: number;
  userRole: string;
}

export function ContractorProgressListClient({
  contract,
  itemsSummary,
  overallProgress,
  userRole,
}: ContractorProgressListClientProps) {
  const router = useRouter();

  // Agrupar items por capa
  const itemsByLayer: Record<string, ItemSummary[]> = {};
  itemsSummary.forEach(item => {
    if (!itemsByLayer[item.layerCode]) {
      itemsByLayer[item.layerCode] = [];
    }
    itemsByLayer[item.layerCode].push(item);
  });

  // Stats
  const completedItems = itemsSummary.filter(i => i.progressPercentage >= 100).length;
  const inProgressItems = itemsSummary.filter(i => i.progressPercentage > 0 && i.progressPercentage < 100).length;
  const pendingItems = itemsSummary.filter(i => i.progressPercentage === 0).length;

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return "bg-green-500";
    if (percentage >= 50) return "bg-blue-500";
    if (percentage > 0) return "bg-yellow-500";
    return "bg-gray-200";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/planeacion/contratos/${contract.id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{contract.contractNumber}</h1>
              <Badge variant="outline">Avances</Badge>
            </div>
            <p className="text-gray-500">{contract.contractor.name}</p>
          </div>
        </div>
        {["ADMIN", "GERENTE", "DIRECTOR"].includes(userRole) && (
          <Button onClick={() => router.push(`/dashboard/planeacion/contratos/${contract.id}/avances/nuevo`)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Avance
          </Button>
        )}
      </div>

      {!contract.budget ? (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-800">Sin Presupuesto</p>
                <p className="text-sm text-yellow-700">
                  No hay presupuesto asignado al contratista.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Cards */}
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
                    Basado en valor PC: {formatCurrency(contract.budget.totalPC)}
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

          <Tabs defaultValue="progress" className="space-y-4">
            <TabsList>
              <TabsTrigger value="progress">Historial de Avance</TabsTrigger>
              <TabsTrigger value="items">Avance por Ítem</TabsTrigger>
            </TabsList>

            {/* Historial de Avances */}
            <TabsContent value="progress">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Registros de Avance ({contract.dailyProgress.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {contract.dailyProgress.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-500">No hay registros de avance</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {contract.dailyProgress.map((dp: any) => (
                        <Link key={dp.id} href={`/dashboard/planeacion/contratos/${contract.id}/avances/${dp.id}`}>
                          <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-gray-400" />
                                  <span className="font-semibold">
                                    {formatShortDate(dp.date)}
                                  </span>
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
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Avance por Ítem */}
            <TabsContent value="items">
              <div className="space-y-4">
                {Object.entries(itemsByLayer).map(([layerCode, items]) => (
                  <Card key={layerCode}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Layers className="h-5 w-5" />
                        {layerCode} - {items[0]?.layerName}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {items.map((item) => (
                          <div key={item.id} className="border rounded-lg p-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">
                                  {item.itemNumber} - {item.description}
                                </p>
                                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                  <span>
                                    Ejecutado: {item.totalExecuted.toFixed(2)} / {item.totalQuantity.toFixed(2)} {item.unit}
                                  </span>
                                  <span>
                                    Pendiente: {item.remaining.toFixed(2)} {item.unit}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <Badge variant={
                                  item.progressPercentage >= 100 ? "success" :
                                  item.progressPercentage >= 50 ? "default" :
                                  item.progressPercentage > 0 ? "warning" : "secondary"
                                }>
                                  {item.progressPercentage.toFixed(1)}%
                                </Badge>
                              </div>
                            </div>
                            <Progress 
                              value={item.progressPercentage} 
                              className={`h-2 mt-2 ${getProgressColor(item.progressPercentage)}`}
                            />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
