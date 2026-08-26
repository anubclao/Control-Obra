"use client";

import {
  useForm,
  useFieldArray,
  useWatch,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useMemo } from "react";
import { Plus, Trash2, Calculator, AlertCircle } from "lucide-react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useCutsStore } from "@/lib/data-store";
import { useProjectsStore } from "@/lib/data-store";
import { useProvidersStore } from "@/lib/data-store";
import { useAuthStore } from "@/lib/auth-store";
import { formatCurrency } from "@/lib/utils";
import type { WorkCut, WorkCutItem } from "@/types";

const itemSchema = z.object({
  description: z.string().min(2),
  unit: z.string().min(1),
  quantity: z.coerce.number().min(0),
  unitPrice: z.coerce.number().min(0),
  budgetItemCode: z.string().optional(),
});

const cutSchema = z.object({
  projectId: z.string().min(1, "Selecciona un proyecto"),
  providerId: z.string().min(1, "Selecciona un proveedor"),
  description: z.string().min(3),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  items: z.array(itemSchema).min(1, "Agrega al menos un ítem"),
  retentionPercent: z.coerce.number().min(0).max(100),
  advanceDeduction: z.coerce.number().min(0),
});

type CutFormData = z.infer<typeof cutSchema>;

const resolver = zodResolver(cutSchema) as Resolver<CutFormData>;

interface Props {
  cut?: WorkCut;
  onSuccess: () => void;
}

export function CutForm({ cut, onSuccess }: Props) {
  const { addCut, updateCut } = useCutsStore();
  const { getProject, projects } = useProjectsStore();
  const { providers } = useProvidersStore();
  const { user } = useAuthStore();
  const isEditing = !!cut;
  const isEditable =
    !cut || cut.status === "DRAFT" || cut.status === "REJECTED";

  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CutFormData>({
    resolver,
    defaultValues: cut
      ? {
          projectId: cut.projectId,
          providerId: cut.providerId,
          description: cut.description,
          periodStart: cut.periodStart,
          periodEnd: cut.periodEnd,
          items: cut.items.map((it) => ({
            description: it.description,
            unit: it.unit,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            budgetItemCode: it.budgetItemCode ?? "",
          })),
          retentionPercent: cut.retentionPercent,
          advanceDeduction: cut.advanceDeduction,
        }
      : {
          projectId: "",
          providerId: "",
          description: "",
          periodStart: new Date().toISOString().slice(0, 10),
          periodEnd: new Date().toISOString().slice(0, 10),
          items: [
            {
              description: "",
              unit: "M2",
              quantity: 0,
              unitPrice: 0,
              budgetItemCode: "",
            },
          ],
          retentionPercent: 10,
          advanceDeduction: 0,
        },
  });

  useEffect(() => {
    if (cut) reset(cut as unknown as CutFormData);
  }, [cut, reset]);

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = useWatch({ control, name: "items" });
  const retentionPercent = useWatch({ control, name: "retentionPercent" });
  const advanceDeduction = useWatch({ control, name: "advanceDeduction" });
  const projectIdValue = useWatch({ control, name: "projectId" });
  const providerIdValue = useWatch({ control, name: "providerId" });

  const totals = useMemo(() => {
    const itemsArr = (items ?? []) as Array<{
      quantity: number;
      unitPrice: number;
    }>;
    const gross = itemsArr.reduce(
      (sum, it) => sum + (it.quantity || 0) * (it.unitPrice || 0),
      0,
    );
    const retentionValue = Math.round(gross * ((retentionPercent || 0) / 100));
    const net = gross - retentionValue - (Number(advanceDeduction) || 0);
    return { gross, retentionValue, net };
  }, [items, retentionPercent, advanceDeduction]);

  function onSubmit(data: CutFormData) {
    const computedItems: WorkCutItem[] = data.items.map((it, idx) => ({
      id: cut?.items[idx]?.id ?? `wi${Date.now()}${idx}`,
      description: it.description,
      unit: it.unit,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      totalPrice: it.quantity * it.unitPrice,
      budgetItemCode: it.budgetItemCode || undefined,
    }));

    const project = getProject(data.projectId);

    if (cut) {
      updateCut(cut.id, {
        projectId: data.projectId,
        providerId: data.providerId,
        description: data.description,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        items: computedItems,
        grossValue: totals.gross,
        retentionPercent: data.retentionPercent,
        retentionValue: totals.retentionValue,
        advanceDeduction: data.advanceDeduction,
        netValue: totals.net,
      });
    } else {
      addCut(
        {
          projectId: data.projectId,
          providerId: data.providerId,
          description: data.description,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          items: computedItems,
          grossValue: totals.gross,
          retentionPercent: data.retentionPercent,
          retentionValue: totals.retentionValue,
          advanceDeduction: data.advanceDeduction,
          netValue: totals.net,
          status: "DRAFT",
          createdBy: user?.id ?? "unknown",
        },
        project?.code ?? "PRY-NEW",
      );
    }
    onSuccess();
  }

  if (!isEditable) {
    return (
      <Alert variant="warning">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No editable</AlertTitle>
        <AlertDescription>
          Este corte está en estado {cut?.status} y no se puede editar.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block">Proyecto *</Label>
          <Select
            value={projectIdValue}
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
                  {p.code} – {p.name.slice(0, 35)}
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
          <Label className="mb-1.5 block">Proveedor *</Label>
          <Select
            value={providerIdValue}
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

        <div className="sm:col-span-2">
          <Label className="mb-1.5 block">Descripción *</Label>
          <Textarea
            {...register("description")}
            placeholder="Resumen del avance ejecutado en este período"
            rows={2}
          />
          {errors.description && (
            <p className="mt-1 text-xs text-destructive">
              {errors.description.message}
            </p>
          )}
        </div>

        <div>
          <Label className="mb-1.5 block">Período desde *</Label>
          <Input type="date" {...register("periodStart")} />
          {errors.periodStart && (
            <p className="mt-1 text-xs text-destructive">
              {errors.periodStart.message}
            </p>
          )}
        </div>
        <div>
          <Label className="mb-1.5 block">Período hasta *</Label>
          <Input type="date" {...register("periodEnd")} />
          {errors.periodEnd && (
            <p className="mt-1 text-xs text-destructive">
              {errors.periodEnd.message}
            </p>
          )}
        </div>
      </div>

      {/* Ítems */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Ítems ejecutados</h3>
            <p className="text-xs text-muted-foreground">
              Detalla cada ítem con cantidad, unidad y precio unitario
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({
                description: "",
                unit: "M2",
                quantity: 0,
                unitPrice: 0,
                budgetItemCode: "",
              })
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Ítem
          </Button>
        </div>

        <div className="space-y-2">
          {fields.map((f, idx) => {
            const q = (items?.[idx]?.quantity as number) || 0;
            const p = (items?.[idx]?.unitPrice as number) || 0;
            const total = q * p;
            return (
              <div key={f.id} className="rounded-md border bg-secondary/30 p-3">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-12 sm:col-span-5">
                    <Input
                      {...register(`items.${idx}.description`)}
                      placeholder="Descripción del ítem"
                    />
                    {errors.items?.[idx]?.description && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.items[idx]?.description?.message}
                      </p>
                    )}
                  </div>
                  <div className="col-span-3 sm:col-span-1">
                    <Input
                      {...register(`items.${idx}.unit`)}
                      placeholder="M2"
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      {...register(`items.${idx}.quantity`)}
                      placeholder="0"
                    />
                  </div>
                  <div className="col-span-5 sm:col-span-2">
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      {...register(`items.${idx}.unitPrice`)}
                      placeholder="0"
                    />
                  </div>
                  <div className="col-span-7 col-start-1 flex items-center justify-between rounded border bg-background px-3 py-1.5 text-sm sm:col-span-2 sm:col-start-auto">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-semibold">
                      {formatCurrency(total)}
                    </span>
                  </div>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(idx)}
                      className="col-span-12 h-9 w-full sm:col-span-1 sm:w-9"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {errors.items &&
          typeof errors.items === "object" &&
          "message" in errors.items && (
            <p className="mt-1 text-xs text-destructive">
              {errors.items.message}
            </p>
          )}
      </div>

      {/* Descuentos */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block">Retención (%)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.1"
            {...register("retentionPercent")}
          />
        </div>
        <div>
          <Label className="mb-1.5 block">Deducción anticipo (COP)</Label>
          <Input
            type="number"
            min="0"
            step="1000"
            {...register("advanceDeduction")}
          />
        </div>
      </div>

      {/* Totales */}
      <div className="rounded-lg border bg-secondary/40 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Calculator className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Resumen financiero</p>
        </div>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Valor bruto</span>
            <span className="font-semibold">
              {formatCurrency(totals.gross)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              (-) Retención ({retentionPercent}%)
            </span>
            <span className="font-semibold text-red-600">
              −{formatCurrency(totals.retentionValue)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">(-) Anticipo</span>
            <span className="font-semibold text-red-600">
              −{formatCurrency(Number(advanceDeduction) || 0)}
            </span>
          </div>
          <div className="flex justify-between border-t pt-1.5 text-base">
            <span className="font-semibold">Valor neto a pagar</span>
            <span className="font-bold text-emerald-600">
              {formatCurrency(totals.net)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isEditing ? "Guardar cambios" : "Crear corte"}
        </Button>
      </div>
    </form>
  );
}
