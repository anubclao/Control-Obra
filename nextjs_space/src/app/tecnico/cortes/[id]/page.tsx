"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Building2,
  Truck,
  Calendar,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileText,
  History,
  ListChecks,
  Plus,
  Trash2,
  Calculator,
  Save,
  ThumbsUp,
  ThumbsDown,
  Banknote,
  Mail,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ModuleExplanationCard } from "@/components/ui/module-explanation-card";
import { useAuthStore } from "@/lib/auth-store";
import {
  useCutsStore,
  useProjectsStore,
  useProvidersStore,
  CUT_STATUS_LABELS,
  CUT_STATUS_VARIANTS,
  CUT_DOCUMENT_TYPE_LABELS,
  ACTION_LABELS,
  ACTION_BUTTONS,
} from "@/lib/data-store";
import { CutForm } from "@/components/cuts/cut-form";
import { GenerateButton } from "@/components/documents/generate-button";
import { useDataStore } from "@/lib/data-store";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { WorkCut, WorkCutDocumentType, ApprovalAction } from "@/types";

export default function CutDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { getCut, performAction, load } = useCutsStore();
  const { getProject, load: loadProjects } = useProjectsStore();
  const { getProvider, load: loadProviders } = useProvidersStore();
  const { user, refresh } = useAuthStore();
  const [editOpen, setEditOpen] = useState(false);
  const [addDocOpen, setAddDocOpen] = useState(false);
  const confirmAction = useConfirm();

  useEffect(() => {
    load();
    loadProjects();
    loadProviders();
    refresh();
  }, []);

  const cut = getCut(id);

  if (!cut) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/tecnico/cortes">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver
          </Link>
        </Button>
        <div className="rounded-lg border border-dashed p-12 text-center">
          <h2 className="text-lg font-semibold">Corte no encontrado</h2>
        </div>
      </div>
    );
  }

  const project = getProject(cut.projectId);
  const provider = getProvider(cut.providerId);
  const variant = CUT_STATUS_VARIANTS[cut.status];
  const isEditable = cut.status === "DRAFT" || cut.status === "REJECTED";
  const userRole = user?.role ?? "USER";
  const availableActions: ApprovalAction[] = [
    ...(ACTION_BUTTONS[cut.status] ?? []),
  ];

  function askAction(action: ApprovalAction) {
    const isReject = action === "REJECT";
    const titles: Record<ApprovalAction, string> = {
      SUBMIT:
        cut.status === "REJECTED"
          ? "Reenviar corte a validacion"
          : "Enviar corte a validacion",
      VALIDATE: "Validar corte",
      APPROVE: "Aprobar corte",
      REJECT: "Rechazar corte",
      PAY: "Marcar corte como pagado",
    };
    const descriptions: Record<ApprovalAction, string> = {
      SUBMIT:
        "El corte pasa a SUBMITTED y queda en cola para que el supervisor lo valide.",
      VALIDATE: "Confirmas que los items y cantidades del corte son correctos.",
      APPROVE:
        "Apruebas el corte para pago. Solo Super Admin puede revertir esto.",
      REJECT:
        "Indica el motivo del rechazo. El residente podra re-editar y reenviar.",
      PAY: "Confirmas que el pago al contratista fue realizado.",
    };
    const variants: Record<
      ApprovalAction,
      "default" | "danger" | "success" | "info"
    > = {
      SUBMIT: "info",
      VALIDATE: "info",
      APPROVE: "success",
      REJECT: "danger",
      PAY: "success",
    };
    const labels: Record<ApprovalAction, string> = {
      SUBMIT: cut.status === "REJECTED" ? "Reenviar" : "Enviar",
      VALIDATE: "Validar",
      APPROVE: "Aprobar",
      REJECT: "Rechazar",
      PAY: "Marcar pagado",
    };

    confirmAction.open({
      title: titles[action],
      description: descriptions[action],
      details: (
        <ActionDetailsForm
          action={action}
          cut={cut}
          projectName={project?.name}
          providerName={provider?.name}
        />
      ),
      variant: variants[action],
      confirmText: labels[action],
      onConfirm: async () => {
        if (!user) throw new Error("No hay usuario autenticado");
        const form = document.getElementById(
          `action-form-${action}`,
        ) as HTMLFormElement | null;
        let comments = "";
        let motivo = "";
        if (form) {
          const fd = new FormData(form);
          comments = String(fd.get("comments") ?? "").trim();
          motivo = String(fd.get("motivo") ?? "").trim();
        }
        if (isReject && !motivo) {
          throw new Error("Debes indicar el motivo del rechazo");
        }
        const result = await performAction(
          cut.id,
          action,
          { id: user.id, name: user.name, role: user.role },
          comments || undefined,
          isReject ? motivo : undefined,
        );
        if (!result.ok) {
          throw new Error(result.error ?? "Error desconocido");
        }
      },
    });
  }

  return (
    <div className="space-y-6">
      <ModuleExplanationCard
        icon={Workflow}
        variant="guide"
        title="Corte de obra"
        description="Un corte es un avance periodico de obra que el contratista cobra. Pasa por un flujo formal de validacion, aprobacion y pago."
        steps={[
          {
            title: "Borrador",
            description:
              "El residente crea el corte, agrega items con cantidad ejecutada y precio unitario.",
          },
          {
            title: "Validacion",
            description:
              "El supervisor revisa cantidades y soportes. Puede aprobar o rechazar con motivo.",
          },
          {
            title: "Aprobacion",
            description: "Gerencia o Super Admin aprueba el corte para pago.",
          },
          {
            title: "Pago",
            description:
              "Tesoreria marca el corte como pagado y se genera la solicitud de pago correspondiente.",
          },
        ]}
        tips={[
          "Cada accion (submit/validate/approve/reject/pay) pide confirmacion con comentarios opcionales.",
          "El rechazo exige motivo. El residente puede re-editar y reenviar sin perder el historial.",
        ]}
      />

      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/tecnico/cortes">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Cortes
          </Link>
        </Button>
        <div className="flex gap-2">
          {isEditable && (
            <Button
              onClick={() => setEditOpen(true)}
              variant="outline"
              size="sm"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Button>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-xs text-muted-foreground">
                {cut.cutNumber}
              </p>
              <Badge variant={variant}>{CUT_STATUS_LABELS[cut.status]}</Badge>
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {cut.description}
            </h1>
            <div className="mt-3 flex flex-col gap-1.5 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-4">
              {project && (
                <p className="flex items-center gap-1.5">
                  <Building2 className="h-4 w-4" />
                  {project.code} - {project.name}
                </p>
              )}
              {provider && (
                <p className="flex items-center gap-1.5">
                  <Truck className="h-4 w-4" />
                  {provider.name}
                </p>
              )}
              <p className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {formatDate(cut.periodStart)} - {formatDate(cut.periodEnd)}
              </p>
            </div>
          </div>

          {/* Acciones de estado */}
          {availableActions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {availableActions.map((act) => (
                <Button
                  key={act}
                  variant={act === "REJECT" ? "destructive" : "default"}
                  size="sm"
                  onClick={() => askAction(act)}
                >
                  {act === "SUBMIT" && <Save className="mr-2 h-4 w-4" />}
                  {act === "VALIDATE" && (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  {act === "APPROVE" && <ThumbsUp className="mr-2 h-4 w-4" />}
                  {act === "REJECT" && <ThumbsDown className="mr-2 h-4 w-4" />}
                  {act === "PAY" && <Banknote className="mr-2 h-4 w-4" />}
                  {act === "SUBMIT"
                    ? cut.status === "REJECTED"
                      ? "Reenviar"
                      : "Guardar corte"
                    : act === "VALIDATE"
                      ? "Validar"
                      : act === "APPROVE"
                        ? "Aprobar (Super Admin)"
                        : act === "REJECT"
                          ? "Rechazar (Super Admin)"
                          : "Marcar como pagado"}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Motivo rechazo */}
        {cut.status === "REJECTED" && cut.rejectionReason && (
          <Alert variant="destructive" className="mt-4">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Motivo del rechazo</AlertTitle>
            <AlertDescription>{cut.rejectionReason}</AlertDescription>
          </Alert>
        )}

        {/* Notificacion post-aprobacion (PDF p.22) */}
        {cut.status === "APPROVED" && (
          <Alert className="mt-4 border-emerald-300 bg-emerald-50">
            <Mail className="h-4 w-4 text-emerald-700" />
            <AlertTitle className="text-emerald-900">
              Corte aprobado - listo para enviar al contratista
            </AlertTitle>
            <AlertDescription className="text-emerald-800">
              Una vez aprobado por Gerencia, se debe notificar al Residente de
              Obra y enviar el corte firmado por correo electronico al
              proveedor, indicandole que para radicar cuenta debe presentar:
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* F3: Documento generado en SharePoint */}
      {project && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Documento generado en SharePoint
            </CardTitle>
            <CardDescription>
              Genera el formato oficial de corte y memorias de obra con los
              datos de este registro y archívalo en la carpeta del proyecto en
              SharePoint.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GenerateButton
              entity="cuts"
              entityId={cut.id}
              currentUrl={cut.generatedDocumentUrl}
              onGenerated={() => {
                useDataStore
                  .getState()
                  .cuts.load()
                  .catch(() => {});
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Checklist documental (PDF p.22) */}
      {cut.status === "APPROVED" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Checklist documental para radicar cuenta
            </CardTitle>
            <CardDescription>
              El proveedor debe presentar esta documentacion al momento de
              radicar la cuenta de cobro.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {[
                "Camara de Comercio no mayor a 30 dias (si aplica)",
                "RUT actualizado (fecha de impresion)",
                "Cedula del representante legal al 150%",
                "Certificacion Bancaria actualizada",
                "Corte de obra con memorias firmado",
                "Planilla de Seguridad Social pagada y vigente",
              ].map((req, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="items" className="space-y-4">
        <TabsList>
          <TabsTrigger value="items">
            <ListChecks className="mr-1.5 h-4 w-4" />
            Items ({cut.items.length})
          </TabsTrigger>
          <TabsTrigger value="resumen">
            <Calculator className="mr-1.5 h-4 w-4" />
            Resumen
          </TabsTrigger>
          <TabsTrigger value="documentos">
            <FileText className="mr-1.5 h-4 w-4" />
            Documentos ({cut.documents.length})
          </TabsTrigger>
          <TabsTrigger value="historial">
            <History className="mr-1.5 h-4 w-4" />
            Historial ({cut.approvals.length})
          </TabsTrigger>
        </TabsList>

        {/* Items */}
        <TabsContent value="items">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-secondary/30 text-left text-xs uppercase text-muted-foreground">
                      <th className="px-3 py-2">Descripcion</th>
                      <th className="px-3 py-2 text-center">Unidad</th>
                      <th className="px-3 py-2 text-right">Cantidad</th>
                      <th className="px-3 py-2 text-right">Precio unit.</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cut.items.map((it) => (
                      <tr key={it.id} className="border-b last:border-0">
                        <td className="px-3 py-2">{it.description}</td>
                        <td className="px-3 py-2 text-center font-mono text-xs">
                          {it.unit}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {it.quantity.toLocaleString("es-CO")}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatCurrency(it.unitPrice)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {formatCurrency(it.totalPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resumen */}
        <TabsContent value="resumen">
          <Card>
            <CardHeader>
              <CardTitle>Resumen financiero</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <Row
                  label="Valor bruto"
                  value={formatCurrency(cut.grossValue)}
                />
                <Row
                  label={`Retencion (${cut.retentionPercent}%)`}
                  value={`-${formatCurrency(cut.retentionValue)}`}
                  valueClass="text-red-600"
                />
                <Row
                  label="Deduccion anticipo"
                  value={`-${formatCurrency(cut.advanceDeduction)}`}
                  valueClass="text-red-600"
                />
                <div className="flex items-center justify-between border-t pt-2 text-lg">
                  <span className="font-semibold">Valor neto a pagar</span>
                  <span className="font-bold text-emerald-600">
                    {formatCurrency(cut.netValue)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documentos */}
        <TabsContent value="documentos">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Documentos soporte</CardTitle>
                  <CardDescription>
                    Acta, factura, soportes y otros
                  </CardDescription>
                </div>
                <Button onClick={() => setAddDocOpen(true)} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {cut.documents.length === 0 ? (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Sin documentos asociados
                </p>
              ) : (
                <div className="space-y-2">
                  {cut.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <div>
                          <p className="text-sm font-medium">
                            {CUT_DOCUMENT_TYPE_LABELS[doc.type]}: {doc.fileName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Subido {formatDate(doc.uploadedAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Historial */}
        <TabsContent value="historial">
          <Card>
            <CardHeader>
              <CardTitle>Historial de aprobaciones</CardTitle>
              <CardDescription>
                Trazabilidad de cada accion sobre el corte
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cut.approvals.length === 0 ? (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Aun no hay acciones registradas
                </p>
              ) : (
                <div className="space-y-3">
                  {cut.approvals.map((a) => {
                    const aVariant =
                      a.action === "APPROVE" || a.action === "PAY"
                        ? "success"
                        : a.action === "REJECT"
                          ? "destructive"
                          : a.action === "VALIDATE"
                            ? "info"
                            : "warning";
                    return (
                      <div
                        key={a.id}
                        className="flex gap-3 rounded-md border bg-secondary/20 p-3"
                      >
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-background">
                          {a.action === "APPROVE" || a.action === "PAY" ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : a.action === "REJECT" ? (
                            <XCircle className="h-4 w-4 text-red-600" />
                          ) : a.action === "VALIDATE" ? (
                            <CheckCircle2 className="h-4 w-4 text-blue-600" />
                          ) : (
                            <Save className="h-4 w-4 text-amber-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={aVariant}>
                              {ACTION_LABELS[a.action]}
                            </Badge>
                            <p className="text-sm font-medium">{a.userName}</p>
                            <span className="text-xs text-muted-foreground">
                              ({a.userRole})
                            </span>
                          </div>
                          {a.comments && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {a.comments}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(a.createdAt).toLocaleString("es-CO")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal editar */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar corte</DialogTitle>
            <DialogDescription>{cut.cutNumber}</DialogDescription>
          </DialogHeader>
          <CutForm cut={cut} onSuccess={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>

      {confirmAction.dialog}
    </div>
  );
}

function ActionDetailsForm({
  action,
  cut,
  projectName,
  providerName,
}: {
  action: ApprovalAction;
  cut: WorkCut;
  projectName?: string;
  providerName?: string;
}) {
  const isReject = action === "REJECT";
  return (
    <form
      id={`action-form-${action}`}
      className="space-y-3"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="space-y-1 text-xs">
        <p>
          <strong>Corte:</strong> {cut.cutNumber}
        </p>
        <p>
          <strong>Proyecto:</strong> {projectName ?? "-"}
        </p>
        <p>
          <strong>Contratista:</strong> {providerName ?? "-"}
        </p>
        <p>
          <strong>Valor neto:</strong> {formatCurrency(cut.netValue)}
        </p>
        <p>
          <strong>Estado actual:</strong> {CUT_STATUS_LABELS[cut.status]}
        </p>
      </div>
      {isReject ? (
        <div>
          <Label className="mb-1.5 block">Motivo del rechazo *</Label>
          <Textarea
            name="motivo"
            placeholder="Describe que se debe corregir..."
            rows={3}
            required
          />
        </div>
      ) : (
        <div>
          <Label className="mb-1.5 block">Comentarios (opcional)</Label>
          <Textarea
            name="comments"
            placeholder="Notas para el historial..."
            rows={3}
          />
        </div>
      )}
    </form>
  );
}

function Row({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-semibold", valueClass)}>{value}</span>
    </div>
  );
}

function AddDocumentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [type, setType] = useState<WorkCutDocumentType>("ACTA");
  const [fileName, setFileName] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar documento</DialogTitle>
          <DialogDescription>
            Sube o registra un soporte para el corte
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1.5 block">Tipo de documento</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as WorkCutDocumentType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.keys(CUT_DOCUMENT_TYPE_LABELS) as WorkCutDocumentType[]
                ).map((t) => (
                  <SelectItem key={t} value={t}>
                    {CUT_DOCUMENT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">Nombre del archivo</Label>
            <Input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="acta.pdf"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              (Mock: la carga real se conectara despues)
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setFileName("");
                setType("ACTA");
                onOpenChange(false);
              }}
            >
              Agregar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
