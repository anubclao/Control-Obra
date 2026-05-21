"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  Calendar,
  User,
  Cloud,
  CloudRain,
  Sun,
  Users,
  BookOpen,
  X,
} from "lucide-react";
import { formatDate } from "@/lib/format";

type WorkLogData = any;

type Props = {
  workLog: WorkLogData;
  userRole: string;
  userId: string;
  canEdit: boolean;
};

export default function BitacoraDetailsClient({
  workLog,
  userRole,
  userId,
  canEdit,
}: Props) {
  const router = useRouter();
  const [selectedPhoto, setSelectedPhoto] = useState<any>(null);

  const getWeatherIcon = (weather: string) => {
    const weatherLower = weather?.toLowerCase?.() ?? "";
    if (weatherLower?.includes?.("sol"))
      return <Sun className="w-6 h-6 text-yellow-500" />;
    if (weatherLower?.includes?.("lluv"))
      return <CloudRain className="w-6 h-6 text-blue-500" />;
    return <Cloud className="w-6 h-6 text-gray-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/bitacora">
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">
              Bitácora - {workLog?.project?.name}
            </h1>
          </div>
          <p className="text-gray-600 mt-1">{formatDate(workLog?.date)}</p>
        </div>
      </div>

      {/* Información Principal */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Información de la Entrada</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-blue-600 mt-1" />
              <div>
                <p className="text-sm text-gray-600">Fecha</p>
                <p className="font-semibold">{formatDate(workLog?.date)}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              {getWeatherIcon(workLog?.weather ?? "")}
              <div>
                <p className="text-sm text-gray-600">Clima</p>
                <p className="font-semibold">{workLog?.weather}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-purple-600 mt-1" />
              <div>
                <p className="text-sm text-gray-600">Personal</p>
                <p className="font-semibold">{workLog?.personnel}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-green-600 mt-1" />
              <div>
                <p className="text-sm text-gray-600">Registrado por</p>
                <p className="font-semibold">{workLog?.createdBy?.name}</p>
              </div>
            </div>

            {workLog?.contractor && (
              <div className="flex items-start gap-3">
                <BookOpen className="w-5 h-5 text-orange-600 mt-1" />
                <div>
                  <p className="text-sm text-gray-600">Subcontratista</p>
                  <p className="font-semibold">{workLog?.contractor?.name}</p>
                </div>
              </div>
            )}
          </div>

          <Separator className="my-4" />

          <div>
            <p className="text-sm text-gray-600 mb-2">Actividades Realizadas</p>
            <p className="text-gray-900 whitespace-pre-wrap">
              {workLog?.activities}
            </p>
          </div>

          {workLog?.observations && (
            <>
              <Separator className="my-4" />
              <div>
                <p className="text-sm text-gray-600 mb-2">Observaciones</p>
                <p className="text-gray-900 whitespace-pre-wrap">
                  {workLog?.observations}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Galería de Fotos */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Galería de Fotos ({workLog?.photos?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {workLog?.photos?.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No hay fotos adjuntas</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {workLog?.photos?.map?.((photo: any) => (
                <div
                  key={photo?.id}
                  onClick={() => setSelectedPhoto(photo)}
                  className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group border hover:border-blue-500 transition-all"
                >
                  <div className="relative w-full h-full bg-gray-200">
                    <Image
                      src={`/api/download?path=${photo?.cloudStoragePath}&isPublic=${photo?.isPublic}`}
                      alt={photo?.description || photo?.fileName}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform"
                      sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                    />
                  </div>
                  {photo?.description && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs p-2 truncate">
                      {photo?.description}
                    </div>
                  )}
                </div>
              )) ?? []}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lightbox para vista completa de fotos */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white hover:bg-opacity-20"
            onClick={() => setSelectedPhoto(null)}
          >
            <X className="w-6 h-6" />
          </Button>
          <div className="max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden">
              <Image
                src={`/api/download?path=${selectedPhoto?.cloudStoragePath}&isPublic=${selectedPhoto?.isPublic}`}
                alt={selectedPhoto?.description || selectedPhoto?.fileName}
                fill
                className="object-contain"
                sizes="90vw"
              />
            </div>
            {selectedPhoto?.description && (
              <div className="mt-4 text-center text-white">
                <p className="text-lg">{selectedPhoto?.description}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
