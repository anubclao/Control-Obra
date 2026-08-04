"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState } from "react";
import { Camera, X, Plus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLogsStore, WEATHER_LABELS } from "@/lib/logs-store";
import { useProjectsStore } from "@/lib/projects-store";
import { useAuthStore } from "@/lib/auth-store";
import type { WorkLog, WeatherCondition } from "@/types";

const logSchema = z.object({
  projectId: z.string().min(1, "Selecciona un proyecto"),
  date: z.string().min(1, "Selecciona una fecha"),
  weather: z.enum([
    "SOLEADO",
    "NUBLADO",
    "LLUVIOSO",
    "TORMENTA",
    "VIENTO",
    "NIEBLA",
    "OTRO",
  ]),
  temperature: z.coerce.number().min(-10).max(50).optional().or(z.literal("")),
  workersCount: z.coerce.number().min(0),
  activities: z.string().min(3, "Describe al menos una actividad"),
  incidents: z.string().optional(),
  materials: z.string().optional(),
  observations: z.string().optional(),
});

type FormData = z.infer<typeof logSchema>;

const resolver = zodResolver(logSchema) as Resolver<FormData>;

interface Props {
  log?: WorkLog;
  onSuccess: () => void;
}

export function LogForm({ log, onSuccess }: Props) {
  const { addLog, updateLog, addPhoto, removePhoto } = useLogsStore();
  const { projects } = useProjectsStore();
  const { user } = useAuthStore();
  const isEditing = !!log;

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver,
    defaultValues: log
      ? {
          projectId: log.projectId,
          date: log.date,
          weather: log.weather,
          temperature: log.temperature ?? "",
          workersCount: log.workersCount,
          activities: log.activities,
          incidents: log.incidents ?? "",
          materials: log.materials ?? "",
          observations: log.observations ?? "",
        }
      : {
          projectId: "",
          date: new Date().toISOString().slice(0, 10),
          weather: "SOLEADO" as WeatherCondition,
          temperature: "",
          workersCount: 0,
          activities: "",
          incidents: "",
          materials: "",
          observations: "",
        },
  });

  useEffect(() => {
    if (log) reset(log as unknown as FormData);
  }, [log, reset]);

  const projectId = watch("projectId");
  const weather = watch("weather");

  const [photoInput, setPhotoInput] = useState("");
  const [photoCaption, setPhotoCaption] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  function onSubmit(data: FormData) {
    setSubmitError(null);
    if (log) {
      updateLog(log.id, {
        ...data,
        temperature:
          data.temperature === "" ? undefined : Number(data.temperature),
      });
      onSuccess();
      return;
    }

    const result = addLog({
      projectId: data.projectId,
      date: data.date,
      weather: data.weather,
      temperature:
        data.temperature === "" ? undefined : Number(data.temperature),
      workersCount: data.workersCount,
      activities: data.activities,
      incidents: data.incidents || undefined,
      materials: data.materials || undefined,
      observations: data.observations || undefined,
      createdBy: user?.id ?? "unknown",
      createdByName: user?.name ?? "Usuario",
    });
    if (!result.ok) {
      // FIX Bug #16: usar Alert component en vez de alert() nativo
      setSubmitError(result.error ?? "Error al guardar la bitácora");
      return;
    }
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block">Proyecto *</Label>
          <Select
            value={projectId}
            onValueChange={(v) =>
              setValue("projectId", v, { shouldValidate: true })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona proyecto" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.code} – {p.name.slice(0, 30)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.projectId && (
            <p className="mt-1 text-xs text-destructive">
              {errors.projectId.message}
            </p>
          )}
        </div>

        <div>
          <Label className="mb-1.5 block">Fecha *</Label>
          <Input type="date" {...register("date")} />
          {errors.date && (
            <p className="mt-1 text-xs text-destructive">
              {errors.date.message}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Una sola bitácora por proyecto por día
          </p>
        </div>

        <div>
          <Label className="mb-1.5 block">Clima *</Label>
          <Select
            value={weather}
            onValueChange={(v) =>
              setValue("weather", v as WeatherCondition, {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(WEATHER_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-1.5 block">Temperatura (°C)</Label>
          <Input
            type="number"
            step="0.1"
            min="-10"
            max="50"
            {...register("temperature")}
            placeholder="24"
          />
        </div>

        <div>
          <Label className="mb-1.5 block">Trabajadores en obra *</Label>
          <Input
            type="number"
            min="0"
            {...register("workersCount")}
            placeholder="0"
          />
          {errors.workersCount && (
            <p className="mt-1 text-xs text-destructive">
              {errors.workersCount.message}
            </p>
          )}
        </div>
      </div>

      <div>
        <Label className="mb-1.5 block">Actividades del día *</Label>
        <Textarea
          {...register("activities")}
          placeholder="Detalla las actividades realizadas, avance de obra, equipos usados…"
          rows={3}
        />
        {errors.activities && (
          <p className="mt-1 text-xs text-destructive">
            {errors.activities.message}
          </p>
        )}
      </div>

      <div>
        <Label className="mb-1.5 block">Incidentes / novedades</Label>
        <Textarea
          {...register("incidents")}
          placeholder="Accidentes, paros, problemas climáticos, ausentismo…"
          rows={2}
        />
      </div>

      <div>
        <Label className="mb-1.5 block">
          Materiales recibidos / consumidos
        </Label>
        <Textarea
          {...register("materials")}
          placeholder="Ingresos, consumos, stock relevante…"
          rows={2}
        />
      </div>

      <div>
        <Label className="mb-1.5 block">Observaciones</Label>
        <Textarea
          {...register("observations")}
          placeholder="Comentarios adicionales, coordinación con otras cuadrillas…"
          rows={2}
        />
      </div>

      {/* Fotos (solo si está editando) */}
      {isEditing && (
        <div>
          <Label className="mb-1.5 block">Galería de fotos</Label>
          {log.photos.length > 0 && (
            <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {log.photos.map((p) => (
                <div
                  key={p.id}
                  className="group relative aspect-square overflow-hidden rounded-md border bg-secondary/30"
                >
                  <div className="flex h-full items-center justify-center">
                    <Camera className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1.5 text-xs text-white">
                    <p className="truncate">{p.caption || p.fileName}</p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={() => removePhoto(log.id, p.id)}
                    className="absolute right-1 top-1 h-6 w-6 opacity-0 group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="rounded-md border border-dashed p-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={photoInput}
                onChange={(e) => setPhotoInput(e.target.value)}
                placeholder="foto_obra.jpg"
                className="flex-1"
              />
              <Input
                value={photoCaption}
                onChange={(e) => setPhotoCaption(e.target.value)}
                placeholder="Caption (opcional)"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (photoInput.trim()) {
                    addPhoto(log.id, {
                      fileName: photoInput.trim(),
                      caption: photoCaption.trim() || undefined,
                    });
                    setPhotoInput("");
                    setPhotoCaption("");
                  }
                }}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Agregar
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              (Mock: la carga real se conectará después)
            </p>
          </div>
        </div>
      )}

      {submitError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No se pudo guardar</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isEditing ? "Guardar cambios" : "Registrar bitácora"}
        </Button>
      </div>
    </form>
  );
}
