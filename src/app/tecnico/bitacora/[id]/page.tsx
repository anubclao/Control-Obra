"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Calendar as CalendarIcon,
  Users,
  Camera,
  AlertTriangle,
  Package,
  Wrench,
  FileText,
  Cloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLogsStore, WEATHER_LABELS, WEATHER_ICONS } from "@/lib/data-store";
import { useProjectsStore } from "@/lib/data-store";
import { GenerateButton } from "@/components/documents/generate-button";
import { useDataStore } from "@/lib/data-store";
import { formatDate } from "@/lib/utils";

export default function LogDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { getLog } = useLogsStore();
  const { getProject } = useProjectsStore();

  const log = getLog(id);

  if (!log) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/tecnico/bitacora">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver
          </Link>
        </Button>
        <div className="rounded-lg border border-dashed p-12 text-center">
          <h2 className="text-lg font-semibold">Bitácora no encontrada</h2>
        </div>
      </div>
    );
  }

  const project = getProject(log.projectId);
  const weatherEmoji = WEATHER_ICONS[log.weather];
  const hasIncidents = log.incidents && log.incidents.trim();
  const hasMaterials = log.materials && log.materials.trim();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/tecnico/bitacora">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Bitácora
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/tecnico/bitacora?edit=${log.id}`}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{formatDate(log.date)}</Badge>
              <Badge variant="secondary" className="flex items-center gap-1">
                <span>{weatherEmoji}</span>
                {WEATHER_LABELS[log.weather]}
              </Badge>
              {hasIncidents && <Badge variant="warning">Incidentes</Badge>}
            </div>
            {project && (
              <p className="mt-1 text-sm text-muted-foreground">
                {project.code} · {project.name}
              </p>
            )}
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Bitácora del {formatDate(log.date)}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Registrada por {log.createdByName}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[260px]">
            <div className="rounded-md bg-secondary/40 p-3">
              <p className="text-xs text-muted-foreground">Trabajadores</p>
              <p className="mt-0.5 text-2xl font-semibold">
                {log.workersCount}
              </p>
            </div>
            <div className="rounded-md bg-secondary/40 p-3">
              <p className="text-xs text-muted-foreground">Temperatura</p>
              <p className="mt-0.5 text-2xl font-semibold">
                {log.temperature !== undefined ? `${log.temperature}°` : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* F3: Documento generado en SharePoint */}
      {project && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Documento generado en SharePoint
            </CardTitle>
            <CardDescription>
              Genera el formato de ausencia laboral a partir de esta bitácora y
              archívalo en la carpeta del proyecto en SharePoint.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GenerateButton
              entity="workLogs"
              entityId={log.id}
              currentUrl={log.generatedDocumentUrl}
              onGenerated={() => {
                useDataStore
                  .getState()
                  .workLogs.load()
                  .catch(() => {});
              }}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Actividades */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              Actividades del día
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {log.activities}
            </p>
          </CardContent>
        </Card>

        {/* Info lateral */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row
              icon={CalendarIcon}
              label="Fecha"
              value={formatDate(log.date)}
            />
            <Row
              icon={Cloud}
              label="Clima"
              value={WEATHER_LABELS[log.weather]}
            />
            <Row
              icon={Users}
              label="Trabajadores"
              value={log.workersCount.toString()}
            />
            <Row
              icon={Camera}
              label="Fotos"
              value={log.photos.length.toString()}
            />
            {log.temperature !== undefined && (
              <Row
                icon={Cloud}
                label="Temperatura"
                value={`${log.temperature}°C`}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Incidentes */}
      {hasIncidents && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              Incidentes y novedades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {log.incidents}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Materiales */}
      {hasMaterials && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Materiales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {log.materials}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Observaciones */}
      {log.observations && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Observaciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {log.observations}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Galería */}
      {log.photos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-muted-foreground" />
              Galería ({log.photos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {log.photos.map((p) => (
                <div
                  key={p.id}
                  className="group relative aspect-square overflow-hidden rounded-md border bg-secondary/30"
                >
                  <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground">
                    <Camera className="h-8 w-8" />
                    <span className="text-xs">{p.fileName}</span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-black/70 p-2 text-xs text-white">
                    {p.caption && (
                      <p className="truncate font-medium">{p.caption}</p>
                    )}
                    <p className="text-[10px] opacity-70">{p.uploadedAt}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
