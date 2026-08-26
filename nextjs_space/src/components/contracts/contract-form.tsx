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
import { useContractsStore, CONTRACT_TYPE_LABELS } from "@/lib/data-store";
import { useProjectsStore } from "@/lib/data-store";
import { useProvidersStore } from "@/lib/data-store";
import { useAuthStore } from "@/lib/auth-store";
import type { Contract, ContractType } from "@/types";

const contractSchema = z.object({
  projectId: z.string().min(1, "Selecciona un proyecto"),
  providerId: z.string().min(1, "Selecciona un proveedor"),
  type: z.enum(["OBRA", "SUMINISTRO", "SERVICIOS", "CONSULTORIA"]),
  value: z.coerce.number().min(1, "El valor debe ser mayor a 0"),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED", "SUSPENDED"]),
  scopeOfWork: z.string().min(5, "Describe el alcance del contrato"),
  retentionPercent: z.coerce.number().min(0).max(100),
  advancePercent: z.coerce.number().min(0).max(100),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof contractSchema>;

const resolver = zodResolver(contractSchema) as Resolver<FormData>;

interface Props {
  contract?: Contract;
  onSuccess: () => void;
}

export function ContractForm({ contract, onSuccess }: Props) {
  const { addContract, updateContract } = useContractsStore();
  const { projects } = useProjectsStore();
  const { providers } = useProvidersStore();
  const { user } = useAuthStore();
  const isEditing = !!contract;

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver,
    defaultValues: contract
      ? {
          projectId: contract.projectId,
          providerId: contract.providerId,
          type: contract.type,
          value: contract.value,
          startDate: contract.startDate,
          endDate: contract.endDate,
          status: contract.status,
          scopeOfWork: contract.scopeOfWork,
          retentionPercent: contract.retentionPercent,
          advancePercent: contract.advancePercent,
          notes: contract.notes ?? "",
        }
      : {
          projectId: "",
          providerId: "",
          type: "OBRA" as ContractType,
          value: 0,
          startDate: new Date().toISOString().slice(0, 10),
          endDate: "",
          status: "DRAFT",
          scopeOfWork: "",
          retentionPercent: 10,
          advancePercent: 0,
          notes: "",
        },
  });

  useEffect(() => {
    if (contract) reset(contract as unknown as FormData);
  }, [contract, reset]);

  const value = watch("value");
  const retention = watch("retentionPercent");
  const advance = watch("advancePercent");
  const retentionAmount = (value * (retention ?? 0)) / 100;
  const advanceAmount = (value * (advance ?? 0)) / 100;

  function onSubmit(data: FormData) {
    if (contract) {
      updateContract(contract.id, {
        ...data,
        notes: data.notes || undefined,
      });
    } else {
      addContract({
        ...data,
        notes: data.notes || undefined,
        createdBy: user?.id ?? "unknown",
      } as Omit<Contract, "id" | "contractNumber" | "documents" | "createdAt">);
    }
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block">Proyecto *</Label>
          <Select
            value={watch("projectId")}
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
          <Label className="mb-1.5 block">Contratista *</Label>
          <Select
            value={watch("providerId")}
            onValueChange={(v) =>
              setValue("providerId", v, { shouldValidate: true })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona contratista" />
            </SelectTrigger>
            <SelectContent>
              {providers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name.slice(0, 40)} – {c.nit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.providerId && (
            <p className="mt-1 text-xs text-destructive">
              {errors.providerId.message}
            </p>
          )}
        </div>

        <div>
          <Label className="mb-1.5 block">Tipo *</Label>
          <Select
            value={watch("type")}
            onValueChange={(v) =>
              setValue("type", v as ContractType, { shouldValidate: true })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CONTRACT_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-1.5 block">Estado *</Label>
          <Select
            value={watch("status")}
            onValueChange={(v) =>
              setValue("status", v as Contract["status"], {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DRAFT">Borrador</SelectItem>
              <SelectItem value="ACTIVE">Activo</SelectItem>
              <SelectItem value="SUSPENDED">Suspendido</SelectItem>
              <SelectItem value="COMPLETED">Completado</SelectItem>
              <SelectItem value="CANCELLED">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-1.5 block">Valor del contrato (COP) *</Label>
          <Input type="number" min="0" step="1000000" {...register("value")} />
          {errors.value && (
            <p className="mt-1 text-xs text-destructive">
              {errors.value.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="mb-1.5 block">Inicio *</Label>
            <Input type="date" {...register("startDate")} />
            {errors.startDate && (
              <p className="mt-1 text-xs text-destructive">
                {errors.startDate.message}
              </p>
            )}
          </div>
          <div>
            <Label className="mb-1.5 block">Fin *</Label>
            <Input type="date" {...register("endDate")} />
            {errors.endDate && (
              <p className="mt-1 text-xs text-destructive">
                {errors.endDate.message}
              </p>
            )}
          </div>
        </div>

        <div>
          <Label className="mb-1.5 block">Retención (%)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.1"
            {...register("retentionPercent")}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {new Intl.NumberFormat("es-CO", {
              style: "currency",
              currency: "COP",
              maximumFractionDigits: 0,
            }).format(retentionAmount)}
          </p>
        </div>

        <div>
          <Label className="mb-1.5 block">Anticipo (%)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.1"
            {...register("advancePercent")}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {new Intl.NumberFormat("es-CO", {
              style: "currency",
              currency: "COP",
              maximumFractionDigits: 0,
            }).format(advanceAmount)}
          </p>
        </div>

        <div className="sm:col-span-2">
          <Label className="mb-1.5 block">Alcance del contrato *</Label>
          <Textarea
            {...register("scopeOfWork")}
            placeholder="Detalla el alcance, entregables, condiciones especiales…"
            rows={3}
          />
          {errors.scopeOfWork && (
            <p className="mt-1 text-xs text-destructive">
              {errors.scopeOfWork.message}
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <Label className="mb-1.5 block">Notas</Label>
          <Textarea {...register("notes")} rows={2} />
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isEditing ? "Guardar cambios" : "Crear contrato"}
        </Button>
      </div>
    </form>
  );
}
