"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Building2, AlertCircle, Link2, Copy } from "lucide-react";
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
import { usePaymentsStore } from "@/lib/data-store";
import { useProjectsStore } from "@/lib/data-store";
import { useProvidersStore } from "@/lib/data-store";
import { useCutsStore } from "@/lib/data-store";
import { useAuthStore } from "@/lib/auth-store";
import { formatCurrency } from "@/lib/utils";
import type { PaymentRequest, PaymentType, PaymentPriority } from "@/types";

const paymentSchema = z.object({
  projectId: z.string().min(1, "Selecciona un proyecto"),
  providerId: z.string().optional(),
  workCutId: z.string().optional(),
  type: z.enum([
    "CORTE_OBRA",
    "ANTICIPO",
    "RETENCION",
    "SUMINISTRO",
    "SERVICIOS",
    "HONORARIOS",
    "OTROS",
  ]),
  amount: z.coerce.number().min(1, "Monto debe ser mayor a 0"),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
  requiredApprovalLevel: z.coerce.number().min(1).max(3),
  beneficiaryName: z.string().min(2),
  beneficiaryNit: z.string().min(5),
  bankName: z.string().min(2),
  accountType: z.enum(["SAVINGS", "CHECKING"]),
  accountNumber: z.string().min(4),
  dueDate: z.string().optional(),
  description: z.string().optional(),
});

type FormData = z.infer<typeof paymentSchema>;

const resolver = zodResolver(paymentSchema) as Resolver<FormData>;

interface Props {
  payment?: PaymentRequest;
  onSuccess: () => void;
}

export function PaymentForm({ payment, onSuccess }: Props) {
  const { addPayment, updatePayment, getPayment } = usePaymentsStore();
  const { projects } = useProjectsStore();
  const { providers, getProvider } = useProvidersStore();
  const { cuts, getCut } = useCutsStore();
  const { user } = useAuthStore();
  // P2 plan 2026-10-01 (fase 6.3): si el form se abrio con
  // ?replaces=<id>, copiamos los datos de la solicitud rechazada
  // y mandamos `replacesRequestId` al crear. Asi el usuario no
  // tiene que reescribir todo a mano.
  const search = useSearchParams();
  const replacesId = search?.get("replaces") ?? null;
  const replacesFrom = replacesId ? getPayment(replacesId) : undefined;
  const replacesRequestId = replacesId ?? undefined;
  const replacesHinted = useRef(false);
  const isEditing = !!payment;
  const isEditable = !payment || payment.status === "PENDING";

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver,
    defaultValues: payment
      ? {
          projectId: payment.projectId,
          providerId: payment.providerId ?? "",
          workCutId: payment.workCutId ?? "",
          type: payment.type,
          amount: payment.amount,
          priority: payment.priority,
          requiredApprovalLevel: payment.requiredApprovalLevel,
          beneficiaryName: payment.beneficiaryName,
          beneficiaryNit: payment.beneficiaryNit,
          bankName: payment.bankName,
          accountType: payment.accountType,
          accountNumber: payment.accountNumber,
          dueDate: payment.dueDate ?? "",
          description: payment.description ?? "",
        }
      : {
          projectId: "",
          providerId: "",
          workCutId: "",
          type: "CORTE_OBRA" as PaymentType,
          amount: 0,
          priority: "NORMAL" as PaymentPriority,
          requiredApprovalLevel: 2,
          beneficiaryName: "",
          beneficiaryNit: "",
          bankName: "",
          accountType: "CHECKING",
          accountNumber: "",
          dueDate: "",
          description: "",
        },
  });

  useEffect(() => {
    if (payment) reset(payment as unknown as FormData);
  }, [payment, reset]);

  // P2 plan 2026-10-01 (fase 6.3): si llegamos con ?replaces=<id>,
  // pre-rellenamos el form con los datos de la solicitud original.
  // Solo se aplica cuando NO estamos editando (modo crear) y la
  // solicitud original esta en REJECTED (la ruta POST lo revalidara).
  useEffect(() => {
    if (payment || replacesHinted.current) return;
    if (!replacesFrom) return;
    if (replacesFrom.status !== "REJECTED") return;
    replacesHinted.current = true;
    setValue("projectId", replacesFrom.projectId);
    setValue("providerId", replacesFrom.providerId ?? "");
    setValue("workCutId", replacesFrom.workCutId ?? "");
    setValue("type", replacesFrom.type);
    setValue("amount", replacesFrom.amount);
    setValue("priority", replacesFrom.priority);
    setValue("requiredApprovalLevel", replacesFrom.requiredApprovalLevel);
    setValue("beneficiaryName", replacesFrom.beneficiaryName);
    setValue("beneficiaryNit", replacesFrom.beneficiaryNit);
    setValue("bankName", replacesFrom.bankName);
    setValue("accountType", replacesFrom.accountType);
    setValue("accountNumber", replacesFrom.accountNumber);
    setValue("dueDate", replacesFrom.dueDate ?? "");
    setValue(
      "description",
      (replacesFrom.description ?? "") +
        (replacesFrom.rejectionReason
          ? `\n[Reemplaza a ${replacesFrom.requestNumber}: ${replacesFrom.rejectionReason}]`
          : ""),
    );
  }, [replacesFrom, payment, setValue]);

  const projectId = watch("projectId");
  const providerId = watch("providerId");
  const type = watch("type");

  // Si selecciona un contratista, autocompleta datos bancarios
  function applyProvider(cId: string) {
    setValue("providerId", cId === "__none" ? "" : cId);
    if (!payment) {
      const c = getProvider(cId);
      if (c) {
        setValue("beneficiaryName", c.name);
        setValue("beneficiaryNit", c.nit);
      }
    }
  }

  // Si selecciona un corte, autocompleta monto y datos
  function applyWorkCut(cutId: string) {
    setValue("workCutId", cutId);
    if (!payment) {
      const cut = getCut(cutId);
      if (cut) {
        setValue("projectId", cut.projectId);
        setValue("providerId", cut.providerId);
        setValue("amount", cut.netValue);
        setValue("type", "CORTE_OBRA");
        const c = getProvider(cut.providerId);
        if (c) {
          setValue("beneficiaryName", c.name);
          setValue("beneficiaryNit", c.nit);
        }
      }
    }
  }

  function onSubmit(data: FormData) {
    const payload = {
      ...data,
      providerId: data.providerId || undefined,
      workCutId: data.workCutId || undefined,
      dueDate: data.dueDate || undefined,
      description: data.description || undefined,
    };

    if (payment) {
      updatePayment(payment.id, payload as Partial<PaymentRequest>);
    } else {
      addPayment({
        ...payload,
        // P2 plan 2026-10-01 (fase 6.3): si veníamos de ?replaces=...
        // vinculamos la nueva solicitud a la original rechazada.
        replacesRequestId,
        createdBy: user?.id ?? "unknown",
      } as Omit<
        PaymentRequest,
        | "id"
        | "requestNumber"
        | "approvals"
        | "status"
        | "currentApprovalLevel"
        | "createdAt"
      >);
    }
    onSuccess();
  }

  if (!isEditable) {
    return (
      <Alert variant="warning">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No editable</AlertTitle>
        <AlertDescription>
          Esta solicitud está en estado {payment?.status}. No se puede editar.
        </AlertDescription>
      </Alert>
    );
  }

  // Cortes aprobados del proyecto
  const approvedCuts = cuts.filter(
    (c) =>
      c.status === "APPROVED" && (projectId ? c.projectId === projectId : true),
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Atajo: vincular a un corte aprobado */}
      {!payment && approvedCuts.length > 0 && (
        <div className="rounded-md border border-dashed border-blue-500/50 bg-blue-50 p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-blue-900">
            <Link2 className="h-3.5 w-3.5" />
            ¿Viene de un corte aprobado?
          </div>
          <Select onValueChange={applyWorkCut}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Selecciona un corte para autocompletar" />
            </SelectTrigger>
            <SelectContent>
              {approvedCuts.map((c) => {
                const project = projects.find((p) => p.id === c.projectId);
                const contractor = getProvider(c.providerId);
                return (
                  <SelectItem key={c.id} value={c.id}>
                    {c.cutNumber} — {contractor?.name.slice(0, 30)} (
                    {formatCurrency(c.netValue)})
                    {project ? ` — ${project.code}` : ""}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}

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
          <Label className="mb-1.5 block">Proveedor (opcional)</Label>
          <Select value={providerId} onValueChange={applyProvider}>
            <SelectTrigger>
              <SelectValue placeholder="Sin contratista" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Sin contratista</SelectItem>
              {providers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name.slice(0, 40)} – {c.nit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-1.5 block">Tipo *</Label>
          <Select
            value={type}
            onValueChange={(v) =>
              setValue("type", v as PaymentType, { shouldValidate: true })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                ["CORTE_OBRA", "Corte de obra"],
                ["ANTICIPO", "Anticipo"],
                ["RETENCION", "Retención"],
                ["SUMINISTRO", "Suministro"],
                ["SERVICIOS", "Servicios"],
                ["HONORARIOS", "Honorarios"],
                ["OTROS", "Otros"],
              ].map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-1.5 block">Monto (COP) *</Label>
          <Input type="number" min="0" step="1000" {...register("amount")} />
          {errors.amount && (
            <p className="mt-1 text-xs text-destructive">
              {errors.amount.message}
            </p>
          )}
        </div>

        <div>
          <Label className="mb-1.5 block">Prioridad</Label>
          <Select
            value={watch("priority")}
            onValueChange={(v) => setValue("priority", v as PaymentPriority)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">Baja</SelectItem>
              <SelectItem value="NORMAL">Normal</SelectItem>
              <SelectItem value="HIGH">Alta</SelectItem>
              <SelectItem value="URGENT">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-1.5 block">Niveles de aprobación</Label>
          <Select
            value={String(watch("requiredApprovalLevel"))}
            onValueChange={(v) =>
              setValue("requiredApprovalLevel", Number(v) as 1 | 2 | 3)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 nivel (Director)</SelectItem>
              <SelectItem value="2">2 niveles (Director + Gerente)</SelectItem>
              <SelectItem value="3">
                3 niveles (Director + Gerente + Admin)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-1.5 block">Fecha límite</Label>
          <Input type="date" {...register("dueDate")} />
        </div>
      </div>

      {/* Datos bancarios */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">
            Datos bancarios del beneficiario
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block">Nombre del beneficiario *</Label>
            <Input
              {...register("beneficiaryName")}
              placeholder="Razón social"
            />
            {errors.beneficiaryName && (
              <p className="mt-1 text-xs text-destructive">
                {errors.beneficiaryName.message}
              </p>
            )}
          </div>
          <div>
            <Label className="mb-1.5 block">NIT / Cédula *</Label>
            <Input
              {...register("beneficiaryNit")}
              placeholder="900.123.456-7"
            />
            {errors.beneficiaryNit && (
              <p className="mt-1 text-xs text-destructive">
                {errors.beneficiaryNit.message}
              </p>
            )}
          </div>
          <div>
            <Label className="mb-1.5 block">Banco *</Label>
            <Input {...register("bankName")} placeholder="Bancolombia" />
            {errors.bankName && (
              <p className="mt-1 text-xs text-destructive">
                {errors.bankName.message}
              </p>
            )}
          </div>
          <div>
            <Label className="mb-1.5 block">Tipo de cuenta</Label>
            <Select
              value={watch("accountType")}
              onValueChange={(v) =>
                setValue("accountType", v as "SAVINGS" | "CHECKING")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CHECKING">Corriente</SelectItem>
                <SelectItem value="SAVINGS">Ahorros</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block">Número de cuenta *</Label>
            <Input {...register("accountNumber")} placeholder="123-456789-00" />
            {errors.accountNumber && (
              <p className="mt-1 text-xs text-destructive">
                {errors.accountNumber.message}
              </p>
            )}
          </div>
        </div>
      </div>

      <div>
        <Label className="mb-1.5 block">Descripción / notas</Label>
        <Textarea
          {...register("description")}
          placeholder="Detalle del pago, contexto, motivo…"
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isEditing ? "Guardar cambios" : "Crear solicitud"}
        </Button>
      </div>
    </form>
  );
}
