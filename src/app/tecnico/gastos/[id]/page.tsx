"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Trash2,
  Send,
  Banknote,
  FileText,
  Shield,
  Calendar,
  User,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useExpensesStore,
  EXPENSE_TYPE_LABELS,
  EXPENSE_STATUS_LABELS,
  EXPENSE_STATUS_VARIANTS,
} from "@/lib/data-store";
import { useProvidersStore } from "@/lib/data-store";
import { useProjectsStore } from "@/lib/data-store";
import { useCurrentUser, useIsSuperAdmin } from "@/lib/permissions";
import { GenerateButton } from "@/components/documents/generate-button";
import { useDataStore } from "@/lib/data-store";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function ExpenseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const isSuperAdmin = useIsSuperAdmin();
  const user = useCurrentUser();
  const {
    getExpense,
    approve,
    reject,
    markPaid,
    deleteExpense,
    submitForApproval,
  } = useExpensesStore();
  const { getProvider } = useProvidersStore();
  const { getProject } = useProjectsStore();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  void Input; // placeholder to satisfy linter if Label-only usage

  const expense = getExpense(id);
  if (!expense) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/tecnico/gastos">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Gastos
          </Link>
        </Button>
        <div className="rounded-lg border border-dashed p-12 text-center">
          <h2 className="text-lg font-semibold">Gasto no encontrado</h2>
        </div>
      </div>
    );
  }

  const provider = getProvider(expense.providerId);
  const project = getProject(expense.projectId);

  function doApprove() {
    if (!user) return;
    approve(expense!.id, user.id, user.name);
  }
  function doReject() {
    if (!user || !rejectReason) return;
    reject(expense!.id, rejectReason);
    setRejectOpen(false);
    setRejectReason("");
  }
  function doSubmit() {
    if (!user) return;
    submitForApproval(expense!.id);
  }
  function doDelete() {
    deleteExpense(expense!.id);
    router.push("/tecnico/gastos");
  }

  const variant = EXPENSE_STATUS_VARIANTS[expense.status];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/tecnico/gastos">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Gastos
          </Link>
        </Button>
        <div className="flex gap-2">
          {expense.status === "DRAFT" && (
            <Button onClick={doSubmit} size="sm" variant="outline">
              <Send className="mr-2 h-4 w-4" />
              Enviar a aprobación
            </Button>
          )}
          {expense.status === "PENDING_APPROVAL" && isSuperAdmin && (
            <>
              <Button
                onClick={() => setRejectOpen(true)}
                size="sm"
                variant="outline"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Rechazar
              </Button>
              <Button onClick={doApprove} size="sm">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Aprobar (Super Admin)
              </Button>
            </>
          )}
          {expense.status === "APPROVED" && (
            <Button onClick={() => markPaid(expense.id)} size="sm">
              <Banknote className="mr-2 h-4 w-4" />
              Marcar como pagado
            </Button>
          )}
          {isSuperAdmin && (
            <Button
              onClick={() => setConfirmDelete(true)}
              size="sm"
              variant="destructive"
            >
              <Trash2 className="h-4 w-4" />
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
                {expense.expenseNumber}
              </p>
              <Badge variant={variant}>
                {EXPENSE_STATUS_LABELS[expense.status]}
              </Badge>
              {expense.hasPolizas && (
                <Badge variant="info">
                  <Shield className="mr-1 h-3 w-3" />
                  Con pólizas
                </Badge>
              )}
              {expense.advancePercent ? (
                <Badge variant="outline">
                  Anticipo {expense.advancePercent}%
                </Badge>
              ) : null}
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {expense.description}
            </h1>
            <p className="text-sm text-muted-foreground">
              {EXPENSE_TYPE_LABELS[expense.type]}
            </p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-4 sm:min-w-[220px]">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Monto
            </p>
            <p className="mt-1 text-2xl font-bold">
              {formatCurrency(expense.amount)}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(expense.date)}
            </p>
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
              Genera el formato oficial (orden de compra, orden de servicio,
              legalización, etc.) con los datos de este gasto y archívalo en la
              carpeta del proyecto en SharePoint.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GenerateButton
              entity="expenses"
              entityId={expense.id}
              currentUrl={expense.generatedDocumentUrl}
              onGenerated={() => {
                useDataStore
                  .getState()
                  .expenses.load()
                  .catch(() => {});
              }}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Proyecto + Proveedor */}
        <Card>
          <CardHeader>
            <CardTitle>Vínculos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {project && (
              <div>
                <p className="text-xs text-muted-foreground">Proyecto</p>
                <Link
                  href={`/tecnico/proyectos/${project.id}`}
                  className="font-medium hover:underline"
                >
                  {project.code} · {project.name}
                </Link>
              </div>
            )}
            {provider && (
              <div>
                <p className="text-xs text-muted-foreground">Proveedor</p>
                <Link
                  href={`/tecnico/proveedores/${provider.id}`}
                  className="font-medium hover:underline"
                >
                  {provider.personType === "JURIDICA"
                    ? ""
                    : "(Persona Natural) "}
                  {provider.name} — {provider.nit}
                </Link>
              </div>
            )}
            {expense.cotizacionAprobada !== undefined && (
              <div>
                <p className="text-xs text-muted-foreground">Cotización</p>
                <p className="font-medium">
                  {expense.cotizacionAprobada ? "✅ Aprobada" : "⏳ Pendiente"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pólizas */}
        {expense.hasPolizas && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Pólizas
              </CardTitle>
              <CardDescription>
                Notificar 15 días hábiles antes del vencimiento para renovación.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vigencia desde</span>
                <span className="font-medium">
                  {expense.polizasVigenciaDesde
                    ? formatDate(expense.polizasVigenciaDesde)
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vigencia hasta</span>
                <span className="font-medium">
                  {expense.polizasVigenciaHasta
                    ? formatDate(expense.polizasVigenciaHasta)
                    : "—"}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Auditoría */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Auditoría
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Creado por</span>
              <span className="font-medium">
                {expense.createdByName ?? "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Creado</span>
              <span className="font-medium">
                {formatDate(expense.createdAt.slice(0, 10))}
              </span>
            </div>
            {expense.approvedByName && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Aprobado por</span>
                  <span className="font-medium">{expense.approvedByName}</span>
                </div>
                {expense.approvedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Aprobado</span>
                    <span className="font-medium">
                      {formatDate(expense.approvedAt.slice(0, 10))}
                    </span>
                  </div>
                )}
              </>
            )}
            {expense.rejectedReason && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs">
                <strong>Rechazado:</strong> {expense.rejectedReason}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>Ítems del gasto</CardTitle>
          <CardDescription>
            {expense.type.startsWith("SOLICITUD") ||
            expense.type === "LEGALIZACION_GASTO"
              ? "Cada ítem debe incluir soportes (facturas, cuentas de cobro, recibos de caja)."
              : "Detalle de las actividades o productos contratados."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/30 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2">Descripción</th>
                  <th className="px-3 py-2 text-center">Unidad</th>
                  <th className="px-3 py-2 text-right">Cant.</th>
                  <th className="px-3 py-2 text-right">Vr Unit</th>
                  <th className="px-3 py-2 text-right">Vr Total</th>
                </tr>
              </thead>
              <tbody>
                {expense.items.map((it) => (
                  <tr key={it.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <p className="font-medium">{it.description}</p>
                      {it.attachments && it.attachments.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {it.attachments.map((a, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className="text-xs"
                            >
                              <FileText className="mr-1 h-3 w-3" />
                              {a}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>
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
              <tfoot>
                <tr className="border-t bg-secondary/20">
                  <td
                    colSpan={4}
                    className="px-3 py-2 text-right text-sm font-semibold"
                  >
                    Total
                  </td>
                  <td className="px-3 py-2 text-right text-base font-bold">
                    {formatCurrency(expense.amount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {expense.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{expense.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Dialog rechazar */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar gasto</DialogTitle>
            <DialogDescription>
              Indica el motivo. Solo el Super Administrador puede rechazar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo *</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ej: documentos faltantes, monto fuera de política…"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={doReject}
              disabled={!rejectReason}
            >
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar gasto?</DialogTitle>
            <DialogDescription>
              Se eliminará <strong>{expense.expenseNumber}</strong> —{" "}
              {expense.description}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={doDelete}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
