"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  BookOpen,
  Calendar,
  User,
  Image as ImageIcon,
  Cloud,
  CloudRain,
  Sun,
} from "lucide-react";
import { formatDate } from "@/lib/format";

type WorkLogData = any;

type Props = {
  workLogs: WorkLogData[];
  userRole: string;
};

export default function BitacoraClient({ workLogs, userRole }: Props) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  // Filtrar bitácoras
  const filteredLogs = workLogs?.filter?.((log) => {
    const matchesSearch =
      log?.project?.name?.toLowerCase?.()?.includes?.(searchTerm?.toLowerCase?.() ?? "") ||
      log?.activities?.toLowerCase?.()?.includes?.(searchTerm?.toLowerCase?.() ?? "") ||
      log?.contractor?.name?.toLowerCase?.()?.includes?.(searchTerm?.toLowerCase?.() ?? "");
    const matchesDate = !dateFilter || new Date(log?.date).toISOString().split("T")?.[0] === dateFilter;
    return matchesSearch && matchesDate;
  }) ?? [];

  const getWeatherIcon = (weather: string) => {
    const weatherLower = weather?.toLowerCase?.() ?? "";
    if (weatherLower?.includes?.("sol")) return <Sun className="w-4 h-4 text-yellow-500" />;
    if (weatherLower?.includes?.("lluv")) return <CloudRain className="w-4 h-4 text-blue-500" />;
    return <Cloud className="w-4 h-4 text-gray-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bitácora de Obra</h1>
          <p className="text-gray-600 mt-1">Registro diario de actividades</p>
        </div>
        <Link href="/dashboard/bitacora/nueva">
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Entrada
          </Button>
        </Link>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Entradas</p>
                <p className="text-2xl font-bold text-gray-900">{workLogs?.length ?? 0}</p>
              </div>
              <BookOpen className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Fotos Totales</p>
                <p className="text-2xl font-bold text-gray-900">
                  {workLogs?.reduce?.((sum, log) => sum + (log?._count?.photos ?? 0), 0) ?? 0}
                </p>
              </div>
              <ImageIcon className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Este Mes</p>
                <p className="text-2xl font-bold text-gray-900">
                  {workLogs?.filter?.(
                    (log) =>
                      new Date(log?.date).getMonth() === new Date().getMonth() &&
                      new Date(log?.date).getFullYear() === new Date().getFullYear()
                  )?.length ?? 0}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-green-600" />
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
                placeholder="Buscar por proyecto, actividades o subcontratista..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e?.target?.value ?? "")}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 items-center">
              <Calendar className="w-4 h-4 text-gray-500" />
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e?.target?.value ?? "")}
                className="w-auto"
              />
              {dateFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDateFilter("")}
                >
                  Limpiar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline de Bitácoras */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Entradas de Bitácora ({filteredLogs?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredLogs?.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No se encontraron entradas de bitácora
              </p>
            ) : (
              filteredLogs?.map?.((log) => (
                <div
                  key={log?.id}
                  onClick={() => router.push(`/dashboard/bitacora/${log?.id}`)}
                  className="p-4 border-l-4 border-blue-600 bg-white rounded-r-lg shadow-sm hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant="outline" className="font-semibold">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(log?.date)}
                        </Badge>
                        <div className="flex items-center gap-1">
                          {getWeatherIcon(log?.weather ?? "")}
                          <span className="text-xs text-gray-600">{log?.weather}</span>
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {log?.project?.name}
                      </h3>
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {log?.activities}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {log?._count?.photos > 0 && (
                        <Badge variant="secondary">
                          <ImageIcon className="w-3 h-3 mr-1" />
                          {log?._count?.photos}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {log?.createdBy?.name}
                    </div>
                    {log?.contractor && (
                      <div className="flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        {log?.contractor?.name}
                      </div>
                    )}
                    <div>
                      Personal: {log?.personnel}
                    </div>
                  </div>

                  {log?.observations && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs text-gray-600 italic line-clamp-1">
                        Observaciones: {log?.observations}
                      </p>
                    </div>
                  )}
                </div>
              )) ?? []
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
