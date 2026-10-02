"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjectsStore, PROJECT_STATUS_LABELS } from "@/lib/data-store";
import type { Project, ProjectStatus } from "@/types";

const projectSchema = z.object({
  code: z.string()
    .min(2, "Mínimo 2 caracteres")
    .max(40, "Máximo 40 caracteres")
    .regex(/^[A-Za-z0-9_-]+$/, "Solo letras, números, guion y guion bajo"),
  name: z.string().min(3, "Mínimo 3 caracteres").max(120),
  client: z.string().min(2, "Mínimo 2 caracteres"),
  location: z.string().min(2, "Mínimo 2 caracteres"),
  startDate: z.string().min(1, "Requerido"),
  estimatedEndDate: z.string().min(1, "Requerido"),
  totalBudget: z.coerce.number().min(0, "Debe ser mayor o igual a 0"),
  status: z.enum(["IN_PLANNING", "IN_EXECUTION", "PAUSED", "COMPLETED"]),
  description: z.string().max(500).optional(),
});

type ProjectFormData = z.infer<typeof projectSchema>;

const projectResolver = zodResolver(projectSchema) as Resolver<ProjectFormData>;

interface ProjectFormProps {
  project?: Project;
  onSuccess: () => void;
}

export function ProjectForm({ project, onSuccess }: ProjectFormProps) {
  const { addProject, updateProject } = useProjectsStore();
  const isEditing = !!project;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormData>({
    resolver: projectResolver,
    defaultValues: project
      ? {
          code: project.code,
          name: project.name,
          client: project.client,
          location: project.location,
          startDate: project.startDate,
          estimatedEndDate: project.estimatedEndDate,
          totalBudget: project.totalBudget,
          status: project.status,
          description: project.description ?? "",
        }
      : {
          code: "",
          name: "",
          client: "",
          location: "",
          startDate: new Date().toISOString().slice(0, 10),
          estimatedEndDate: "",
          totalBudget: 0,
          status: "IN_PLANNING" as ProjectStatus,
          description: "",
        },
  });

  useEffect(() => {
    if (project)
      reset({
        code: project.code,
        name: project.name,
        client: project.client,
        location: project.location,
        startDate: project.startDate,
        estimatedEndDate: project.estimatedEndDate,
        totalBudget: project.totalBudget,
        status: project.status,
        description: project.description ?? "",
      });
  }, [project, reset]);

  const status = watch("status");
  const storeError = useProjectsStore().error;

  async function onSubmit(data: ProjectFormData) {
    if (project) {
      // updateProject devuelve false si falló; el mensaje queda en storeError.
      const ok = await updateProject(project.id, data);
      if (ok) onSuccess();
    } else {
      const created = await addProject({
        ...data,
        description: data.description ?? "",
      });
      if (created) onSuccess();
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="name">Nombre del proyecto *</Label>
          <Input
            id="name"
            {...register("name")}
            placeholder="Ej: Edificio Residencial Mirador"
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="code">
            Codigo unico *
            {isEditing && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                (no se puede modificar)
              </span>
            )}
          </Label>
          <Input
            id="code"
            {...register("code")}
            placeholder="PROY-001"
            disabled={isEditing}
            readOnly={isEditing}
            className={isEditing ? "font-mono opacity-70" : "font-mono"}
          />
          {errors.code && (
            <p className="text-xs text-destructive">{errors.code.message}</p>
          )}
          {!isEditing && (
            <p className="text-xs text-muted-foreground">
              Identificador corto y unico (letras, numeros, guion y guion bajo). Lo veras en listados y reportes.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="client">Cliente *</Label>
          <Input
            id="client"
            {...register("client")}
            placeholder="Razón social"
          />
          {errors.client && (
            <p className="text-xs text-destructive">{errors.client.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="location">Ubicación *</Label>
          <Input
            id="location"
            {...register("location")}
            placeholder="Ciudad, Colombia"
          />
          {errors.location && (
            <p className="text-xs text-destructive">
              {errors.location.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="startDate">Fecha de inicio *</Label>
          <Input id="startDate" type="date" {...register("startDate")} />
          {errors.startDate && (
            <p className="text-xs text-destructive">
              {errors.startDate.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="estimatedEndDate">Fecha estimada de fin *</Label>
          <Input
            id="estimatedEndDate"
            type="date"
            {...register("estimatedEndDate")}
          />
          {errors.estimatedEndDate && (
            <p className="text-xs text-destructive">
              {errors.estimatedEndDate.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="totalBudget">Presupuesto total (COP) *</Label>
          <Input
            id="totalBudget"
            type="number"
            inputMode="numeric"
            min="0"
            step="any"
            {...register("totalBudget")}
          />
          {errors.totalBudget && (
            <p className="text-xs text-destructive">
              {errors.totalBudget.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="status">Estado *</Label>
          <Select
            value={status}
            onValueChange={(v) => setValue("status", v as ProjectStatus)}
            disabled
          >
            <SelectTrigger id="status" disabled className="opacity-70">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PROJECT_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            El estado del proyecto no se puede modificar manualmente.
          </p>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="description">Descripción</Label>
          <Textarea
            id="description"
            {...register("description")}
            placeholder="Detalles del proyecto, alcance, observaciones…"
            rows={3}
          />
          {errors.description && (
            <p className="text-xs text-destructive">
              {errors.description.message}
            </p>
          )}
        </div>
      </div>

      {storeError ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {storeError}
        </div>
      ) : null}

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? isEditing
              ? "Guardando…"
              : "Creando…"
            : isEditing
              ? "Guardar cambios"
              : "Crear proyecto"}
        </Button>
      </div>
    </form>
  );
}
