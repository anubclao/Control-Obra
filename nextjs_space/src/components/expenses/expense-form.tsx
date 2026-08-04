"use client";

import { useState } from "react";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
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
import {
  useExpensesStore,
  EXPENSE_TYPE_LABELS,
  categoryFor,
} from "@/lib/expenses-store";
import { useProvidersStore } from "@/lib/providers-store";
import { useProjectsStore } from "@/lib/projects-store";
import { useCurrentUser } from "@/lib/permissions";
import { formatCurrency } from "@/lib/utils";
import type { ExpenseType } from "@/types";

const itemSchema = z.object({
  description: z.string().min(2),
  quantity: z.coerce.number().min(0.001),
  unit: z.string().min(1),
  unitPrice: z.coerce.number().min(0),
});

const schema = z.object({
  projectId: z.string().min(1, "Selecciona un proyecto"),
  providerId: z.string().min(1, "Selecciona un proveedor"),
  type: z.enum([
    "CONTRATO_OBRA_CIVIL_POLIZAS",
    "CONTRATO_OBRA_CIVIL_SIN_POLIZAS",
    "PRESTACION_SERVICIOS",
    "LABORAL_OBRA",
    "LABORAL_TERMINO_INDEFINIDO",
    "LABORAL_TERMINO_DEFINIDO",
    "ORDEN_SERVICIO_POLIZAS",
    "ORDEN_SERVICIO_SIN_POLIZAS",
    "ORDEN_COMPRA_POLIZAS",
    "ORDEN_COMPRA_SIN_POLIZAS",
    "SOLICITUD_RECURSO",
    "SOLICITUD_REINTEGRO",
    "LEGALIZACION_GASTO",
  ]),
  description: z.string().min(3),
  date: z.string().min(1),
  amount: z.coerce.number().min(0).optional(),
  advancePercent: z.coerce.number().min(0).max(100).optional(),
  hasPolizas: z.boolean().optional(),
  polizasVigenciaDesde: z.string().optional(),
  polizasVigenciaHasta: z.string().optional(),
  cotizacionAprobada: z.boolean().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, "Agrega al menos un ítem"),
});

type FormData = z.infer<typeof schema>;

const resolver = zodResolver(schema) as Resolver<FormData>;

interface Props {
  onSuccess: () => void;
}

export function ExpenseForm({ onSuccess }: Props) {
  const { addExpense } = useExpensesStore();
  const { providers } = useProvidersStore();
  const { projects } = useProjectsStore();
  const user = useCurrentUser();
  // FIX Bug #20: derivar el flag de "cotización aprobada" del form state,
  // no usar un state separado que se desincroniza.
  // (Eliminado `showCotizacionWarning` y `setShowCotizacionWarning`.)

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver,
    defaultValues: {
      projectId: "",
      providerId: "",
      type: "CONTRATO_OBRA_CIVIL_POLIZAS",
      description: "",
      date: new Date().toISOString().slice(0, 10),
      advancePercent: 0,
      hasPolizas: true,
      polizasVigenciaDesde: "",
      polizasVigenciaHasta: "",
      cotizacionAprobada: false,
      notes: "",
      items: [{ description: "", quantity: 1, unit: "GL", unitPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = watch("items");
  const type = watch("type");
  const hasPolizas = watch("hasPolizas");
  const cat = categoryFor(type as ExpenseType);

  const computedAmount = items.reduce(
    (s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
    0,
  );

  function onSubmit(data: FormData) {
    addExpense({
      ...data,
      amount: computedAmount,
      // FIX Bug #14: usar IDs únicos estables en lugar de `ni${i}`
      // (el índice colisiona al agregar/eliminar items)
      items: data.items.map((it) => ({
        id: `ei${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        description: it.description,
        quantity: Number(it.quantity),
        unit: it.unit,
        unitPrice: Number(it.unitPrice),
        totalPrice: Number(it.quantity) * Number(it.unitPrice),
      })),
      createdBy: user?.id ?? "u-unknown",
      createdByName: user?.name ?? "Sistema",
    });
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* 1. Tipo + Categoría */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>Tipo de gasto *</Label>
          <Select
            value={type}
            onValueChange={(v) => setValue("type", v as ExpenseType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                Object.entries(EXPENSE_TYPE_LABELS) as [ExpenseType, string][]
              ).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            Categoría: <strong>{cat}</strong>
          </p>
        </div>
        <div>
          <Label>Fecha *</Label>
          <Input type="date" {...register("date")} />
        </div>
      </div>

      {/* 2. Proyecto + Proveedor */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>Proyecto *</Label>
          <Select
            value={watch("projectId")}
            onValueChange={(v) => setValue("projectId", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.code} · {p.name}
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
          <Label>Proveedor *</Label>
          <Select
            value={watch("providerId")}
            onValueChange={(v) => setValue("providerId", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona" />
            </SelectTrigger>
            <SelectContent>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.personType === "JURIDICA" ? p.name : `(Nat) ${p.name}`}
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
      </div>

      <div>
        <Label>Descripción *</Label>
        <Input
          {...register("description")}
          placeholder="Ej: Estructura pisos 7-12"
        />
        {errors.description && (
          <p className="mt-1 text-xs text-destructive">
            {errors.description.message}
          </p>
        )}
      </div>

      {/* 3. Campos específicos según tipo (PDF p.8-9) */}
      {(cat === "contrato" ||
        cat === "orden_servicio" ||
        cat === "orden_compra") && (
        <div className="space-y-3 rounded-md border bg-secondary/20 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Configuración del documento
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Anticipo (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                {...register("advancePercent")}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="polizas"
                checked={!!hasPolizas}
                onChange={(e) => setValue("hasPolizas", e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="polizas">Aplica pólizas</Label>
            </div>
          </div>
          {hasPolizas && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vigencia pólizas desde</Label>
                <Input type="date" {...register("polizasVigenciaDesde")} />
              </div>
              <div>
                <Label>Vigencia pólizas hasta</Label>
                <Input type="date" {...register("polizasVigenciaHasta")} />
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="cotiz"
              checked={!!watch("cotizacionAprobada")}
              onChange={(e) => {
                setValue("cotizacionAprobada", e.target.checked);
              }}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="cotiz">Cotización aprobada</Label>
          </div>
          {!watch("cotizacionAprobada") && (
            <p className="text-xs text-amber-700">
              ⚠️ Sin cotización aprobada el documento no debería enviarse a
              aprobación.
            </p>
          )}
        </div>
      )}

      {/* 4. Items (PDF p.13: en cada item se cargan soportes) */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>Ítems *</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({ description: "", quantity: 1, unit: "GL", unitPrice: 0 })
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Agregar ítem
          </Button>
        </div>
        <div className="space-y-2">
          {fields.map((field, idx) => (
            <div key={field.id} className="rounded-md border bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium">Ítem {idx + 1}</p>
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(idx)}
                    className="h-7 w-7"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                <div className="sm:col-span-5">
                  <Input
                    {...register(`items.${idx}.description`)}
                    placeholder="Descripción"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Input {...register(`items.${idx}.unit`)} placeholder="UN" />
                </div>
                <div className="sm:col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    {...register(`items.${idx}.quantity`)}
                    placeholder="Cant"
                  />
                </div>
                <div className="sm:col-span-3">
                  <Input
                    type="number"
                    step="1000"
                    {...register(`items.${idx}.unitPrice`)}
                    placeholder="Vr Unit"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-end rounded-md border bg-secondary/40 p-2 text-sm">
          Total:{" "}
          <strong className="ml-2">{formatCurrency(computedAmount)}</strong>
        </div>
      </div>

      {/* 5. Notas */}
      <div>
        <Label>Notas</Label>
        <Textarea
          {...register("notes")}
          placeholder="Observaciones internas…"
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          Crear gasto
        </Button>
      </div>
    </form>
  );
}
