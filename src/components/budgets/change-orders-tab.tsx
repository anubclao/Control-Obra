"use client";

/**
 * Pestaña "Control de cambios" del Presupuesto (CC-001, CC-002…).
 * SPEC: docs/specs/budget-change-control.md (AC-11 a AC-13)
 *
 * Los totales que se muestran en el formulario son vista previa: la API los
 * recalcula con la misma función (computeChangeOrderTotals) al guardar.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, FilePlus2, Pencil, Plus, Send, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useDataStore } from "@/lib/data-store";
import { IVA_ON_UTILITY_PCT } from "@/lib/aiu-constants";
import {
  CHANGE_ORDER_ACTION_ROLES,
  CHANGE_ORDER_EDITOR_ROLES,
  CHANGE_ORDER_STATUS_LABELS,
  CHANGE_REQUEST_CHANNELS,
  CHANGE_REQUEST_CHANNEL_LABELS,
  computeChangeOrderTotals,
  isChangeOrderEditable,
  validateChangeOrderInput,
  type ChangeOrderItemInput,
} from "@/lib/budget-change-control";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type {
  AiuConfig,
  Budget,
  BudgetChangeOrder,
  ChangeOrderAction,
  ChangeOrderStatus,
  ChangeRequestChannel,
} from "@/types";

const STATUS_VARIANT: Record<ChangeOrderStatus, "secondary" | "info" | "success" | "destructive"> = {
  DRAFT: "secondary",
  SUBMITTED: "info",
  APPROVED: "success",
  REJECTED: "destructive",
};

/** Negativos en rojo y entre paréntesis, como el formato del cliente. */
function Money({ value, className }: { value: number; className?: string }) {
  if (value < 0) {
    return <span className={cn("text-red-600", className)}>({formatCurrency(Math.abs(value))})</span>;
  }
  return <span className={className}>{formatCurrency(value)}</span>;
}

type AiuPercents = { administration: number; imprevistos: number; utilidad: number };

export function ChangeOrdersTab({ budget, aiuConfig }: { budget: Budget; aiuConfig?: AiuConfig }) {
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? "";
  const canEdit = (CHANGE_ORDER_EDITOR_ROLES as readonly string[]).includes(role);
  const canApprove = CHANGE_ORDER_ACTION_ROLES.APPROVE.includes(role);
  const { open: confirm, dialog: confirmDialog } = useConfirm();

  const [orders, setOrders] = useState<BudgetChangeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<BudgetChangeOrder | "new" | null>(null);
  const [rejecting, setRejecting] = useState<BudgetChangeOrder | null>(null);

  const reload = useCallback(async () => {
    try {
      setOrders(await api.get<BudgetChangeOrder[]>(`/api/budget-change-orders?budgetId=${encodeURIComponent(budget.id)}`));
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "No se pudieron cargar los controles de cambios");
    } finally {
      setLoading(false);
    }
  }, [budget.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function runAction(order: BudgetChangeOrder, action: ChangeOrderAction, rejectionReason?: string) {
    try {
      await api.patch("/api/budget-change-orders", { id: order.id, action, rejectionReason });
      await reload();
      // Aprobar cambia el Tope, el Cliente y crea una versión nueva del PT.
      if (action === "APPROVE") await (useDataStore.getState() as any).budgets.load();
    } catch (e: any) {
      setError(e?.message ?? "No se pudo completar la acción");
    }
  }

  async function remove(order: BudgetChangeOrder) {
    try {
      await api.del(`/api/budget-change-orders?id=${encodeURIComponent(order.id)}`);
      await reload();
    } catch (e: any) {
      setError(e?.message ?? "No se pudo eliminar");
    }
  }

  const approvedDirectCost = orders
    .filter((o) => o.status === "APPROVED")
    .reduce((s, o) => s + o.directCost, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Control de cambios</CardTitle>
            <CardDescription>
              Ítems que el cliente agrega o retira. Al aprobarse, su costo directo se suma al
              Presupuesto Tope y al Presupuesto Cliente, y se crea una nueva versión del PT.
            </CardDescription>
          </div>
          {canEdit && (
            <Button size="sm" onClick={() => setEditing("new")} disabled={!aiuConfig}>
              <FilePlus2 className="mr-2 h-4 w-4" />
              Nuevo control de cambios
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!aiuConfig && (
          <Alert>
            <AlertDescription>
              Configura el AIU del proyecto (pestaña AIU) antes de crear controles de cambios.
            </AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : orders.length === 0 ? (
          <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            No hay controles de cambios registrados.
          </p>
        ) : (
          <>
            {orders.map((o) => {
              const open = expanded === o.id;
              return (
                <div key={o.id} className="rounded-md border">
                  <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      className="flex min-w-0 items-center gap-2 text-left"
                      onClick={() => setExpanded(open ? null : o.id)}
                    >
                      <ChevronRight className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-90")} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold">{o.number}</span>
                          <Badge variant={STATUS_VARIANT[o.status]}>{CHANGE_ORDER_STATUS_LABELS[o.status]}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(o.issueDate)} · {CHANGE_REQUEST_CHANNEL_LABELS[o.requestChannel]}
                            {o.requestChannel === "OTROS" && o.requestChannelOther ? ` (${o.requestChannelOther})` : ""}
                          </span>
                        </div>
                        <p className="truncate text-sm">{o.description}</p>
                      </div>
                    </button>
                    <div className="flex items-center gap-4 pl-6 sm:pl-0">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Costo directo</p>
                        <Money value={o.directCost} className="text-sm font-semibold" />
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Total obra</p>
                        <Money value={o.total} className="text-sm font-semibold" />
                      </div>
                    </div>
                  </div>

                  {open && (
                    <div className="space-y-3 border-t p-3">
                      {o.status === "REJECTED" && o.rejectionReason && (
                        <Alert variant="destructive">
                          <AlertDescription>Rechazado: {o.rejectionReason}</AlertDescription>
                        </Alert>
                      )}
                      <ChangeOrderDetail items={o.items} aiu={o.aiuSnapshot} />
                      <div className="flex flex-wrap justify-end gap-2">
                        {canEdit && isChangeOrderEditable(o.status) && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                confirm({
                                  title: `Eliminar ${o.number}`,
                                  description: "El número no se reutilizará.",
                                  variant: "danger",
                                  confirmText: "Eliminar",
                                  onConfirm: () => remove(o),
                                })
                              }
                            >
                              <Trash2 className="mr-1 h-4 w-4" /> Eliminar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditing(o)}>
                              <Pencil className="mr-1 h-4 w-4" /> Editar
                            </Button>
                            <Button size="sm" onClick={() => runAction(o, "SUBMIT")}>
                              <Send className="mr-1 h-4 w-4" />
                              {o.status === "REJECTED" ? "Reenviar" : "Enviar a aprobación"}
                            </Button>
                          </>
                        )}
                        {canApprove && o.status === "SUBMITTED" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setRejecting(o)}>
                              <XCircle className="mr-1 h-4 w-4" /> Rechazar
                            </Button>
                            <Button
                              size="sm"
                              onClick={() =>
                                confirm({
                                  title: `Aprobar ${o.number}`,
                                  description: `Se sumarán ${formatCurrency(o.directCost)} (costo directo) al Presupuesto Tope y al Cliente, y se creará una nueva versión del PT.`,
                                  variant: "success",
                                  confirmText: "Aprobar",
                                  onConfirm: () => runAction(o, "APPROVE"),
                                })
                              }
                            >
                              <CheckCircle2 className="mr-1 h-4 w-4" /> Aprobar
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="flex justify-end rounded-md border bg-secondary/40 p-3 text-sm">
              <span className="mr-3 text-muted-foreground">Costo directo aprobado</span>
              <Money value={approvedDirectCost} className="font-semibold" />
            </div>
          </>
        )}
      </CardContent>

      {editing && (
        <ChangeOrderDialog
          budget={budget}
          order={editing === "new" ? null : editing}
          aiu={
            editing === "new"
              ? aiuConfig
              : editing.aiuSnapshot
          }
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
          }}
        />
      )}

      <RejectDialog
        order={rejecting}
        onClose={() => setRejecting(null)}
        onReject={async (reason) => {
          if (!rejecting) return;
          await runAction(rejecting, "REJECT", reason);
          setRejecting(null);
        }}
      />
      {confirmDialog}
    </Card>
  );
}

// ─────────────────────────── Detalle (ítems + liquidación) ───────────────────────────

function ChangeOrderDetail({ items, aiu }: { items: ChangeOrderItemInput[]; aiu: AiuPercents }) {
  const t = useMemo(() => computeChangeOrderTotals(items, aiu), [items, aiu]);
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-1 pr-2">Ítem</th>
              <th className="py-1 pr-2">Actividad</th>
              <th className="py-1 pr-2">Und</th>
              <th className="py-1 pr-2 text-right">Cant</th>
              <th className="py-1 pr-2 text-right">Vr unitario</th>
              <th className="py-1 pr-2 text-right">Vr total</th>
              <th className="py-1 text-right">% Incid.</th>
            </tr>
          </thead>
          <tbody>
            {t.items.map((it, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-1 pr-2 font-mono text-xs">{it.itemCode || it.chapterCode || "—"}</td>
                <td className="py-1 pr-2">{it.description}</td>
                <td className="py-1 pr-2">{it.unit}</td>
                <td className="py-1 pr-2 text-right">{it.quantity}</td>
                <td className="py-1 pr-2 text-right"><Money value={it.unitPrice} /></td>
                <td className="py-1 pr-2 text-right"><Money value={it.totalPrice} /></td>
                <td className={cn("py-1 text-right", it.incidencePct < 0 && "text-red-600")}>
                  {it.incidencePct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Liquidation totals={t} aiu={aiu} />
    </div>
  );
}

function Liquidation({
  totals,
  aiu,
}: {
  totals: { directCost: number; administration: number; imprevistos: number; utilidad: number; iva: number; total: number };
  aiu: AiuPercents;
}) {
  const rows: Array<[string, number]> = [
    [`Administración ${aiu.administration}%`, totals.administration],
    [`Imprevistos ${aiu.imprevistos}%`, totals.imprevistos],
    [`Utilidad ${aiu.utilidad}%`, totals.utilidad],
    [`IVA ${IVA_ON_UTILITY_PCT}% sobre utilidad`, totals.iva],
  ];
  return (
    <div className="ml-auto max-w-sm space-y-1 rounded-md border p-3 text-sm">
      <div className="flex justify-between font-medium">
        <span>Total costos directos</span>
        <Money value={totals.directCost} />
      </div>
      {rows.map(([label, v]) => (
        <div key={label} className="flex justify-between text-muted-foreground">
          <span>{label}</span>
          <Money value={v} />
        </div>
      ))}
      <div className="flex justify-between border-t pt-1 font-semibold">
        <span>Total obra</span>
        <Money value={totals.total} />
      </div>
    </div>
  );
}

// ─────────────────────────────── Formulario ───────────────────────────────

type Row = {
  chapterCode: string;
  itemCode: string;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
};

const emptyRow = (): Row => ({ chapterCode: "", itemCode: "", description: "", unit: "UND", quantity: "1", unitPrice: "0" });

function ChangeOrderDialog({
  budget,
  order,
  aiu,
  onClose,
  onSaved,
}: {
  budget: Budget;
  order: BudgetChangeOrder | null;
  aiu?: AiuPercents;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [issueDate, setIssueDate] = useState(
    order ? String(order.issueDate).slice(0, 10) : new Date().toISOString().slice(0, 10),
  );
  const [channel, setChannel] = useState<ChangeRequestChannel | "">(order?.requestChannel ?? "");
  const [channelOther, setChannelOther] = useState(order?.requestChannelOther ?? "");
  const [description, setDescription] = useState(order?.description ?? "");
  const [advisorName, setAdvisorName] = useState(
    order?.advisorName ?? budget.commercialTerms?.commercialAdvisor?.name ?? "",
  );
  const [rows, setRows] = useState<Row[]>(
    order?.items.length
      ? order.items.map((it) => ({
          chapterCode: it.chapterCode ?? "",
          itemCode: it.itemCode ?? "",
          description: it.description,
          unit: it.unit,
          quantity: String(it.quantity),
          unitPrice: String(it.unitPrice),
        }))
      : [emptyRow()],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const budgetItems = useMemo(
    () =>
      budget.layers.flatMap((l) =>
        l.items.map((it) => ({ key: it.id, chapterCode: l.code, layerName: l.name, item: it })),
      ),
    [budget.layers],
  );

  const items: ChangeOrderItemInput[] = rows.map((r) => ({
    chapterCode: r.chapterCode.trim() || undefined,
    itemCode: r.itemCode.trim() || undefined,
    description: r.description.trim(),
    unit: r.unit.trim() || "UND",
    quantity: Number(r.quantity),
    unitPrice: Number(r.unitPrice),
  }));
  const totals = aiu ? computeChangeOrderTotals(items, aiu) : null;

  function setRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addFromBudget(key: string) {
    const found = budgetItems.find((b) => b.key === key);
    if (!found) return;
    setRows((rs) => [
      ...rs.filter((r) => r.description.trim() || Number(r.unitPrice) !== 0),
      {
        chapterCode: found.chapterCode,
        itemCode: "",
        description: found.item.description,
        unit: found.item.unit,
        quantity: "1",
        unitPrice: String(found.item.unitPrice),
      },
    ]);
  }

  async function save() {
    const payload = {
      budgetId: budget.id,
      issueDate,
      requestChannel: channel,
      requestChannelOther: channel === "OTROS" ? channelOther : undefined,
      description,
      advisorName: advisorName || undefined,
      items,
    };
    const v = validateChangeOrderInput(payload);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (order) await api.put("/api/budget-change-orders", { id: order.id, ...payload });
      else await api.post("/api/budget-change-orders", payload);
      await onSaved();
    } catch (e: any) {
      setError(e?.message ?? "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{order ? `Editar ${order.number}` : "Nuevo control de cambios"}</DialogTitle>
          <DialogDescription>
            Valores positivos agregan obra; negativos (ej. −636000) la retiran o descuentan.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Fecha de emisión *</Label>
            <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Medio por el cual se realizó la solicitud *</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as ChangeRequestChannel)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona…" />
              </SelectTrigger>
              <SelectContent>
                {CHANGE_REQUEST_CHANNELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CHANGE_REQUEST_CHANNEL_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {channel === "OTROS" && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>¿Cuál? *</Label>
              <Input value={channelOther} onChange={(e) => setChannelOther(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Descripción / obra *</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Asesor</Label>
            <Input value={advisorName} onChange={(e) => setAdvisorName(e.target.value)} />
          </div>
          {budgetItems.length > 0 && (
            <div className="space-y-1.5">
              <Label>Agregar desde el presupuesto</Label>
              <Select value="" onValueChange={addFromBudget}>
                <SelectTrigger>
                  <SelectValue placeholder="Copiar un ítem del Tope…" />
                </SelectTrigger>
                <SelectContent>
                  {budgetItems.map((b) => (
                    <SelectItem key={b.key} value={b.key}>
                      {b.chapterCode} · {b.item.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="hidden grid-cols-[4rem_4rem_1fr_4rem_5rem_7rem_2rem] gap-2 text-xs text-muted-foreground sm:grid">
            <span>Cap.</span>
            <span>Ítem</span>
            <span>Actividad</span>
            <span>Und</span>
            <span>Cant</span>
            <span>Vr unitario</span>
            <span />
          </div>
          {rows.map((r, i) => (
            <div
              key={i}
              className="grid grid-cols-2 gap-2 rounded-md border p-2 sm:grid-cols-[4rem_4rem_1fr_4rem_5rem_7rem_2rem] sm:border-0 sm:p-0"
            >
              <Input placeholder="Cap." value={r.chapterCode} onChange={(e) => setRow(i, { chapterCode: e.target.value })} />
              <Input placeholder="Ítem" value={r.itemCode} onChange={(e) => setRow(i, { itemCode: e.target.value })} />
              <Input
                className="col-span-2 sm:col-span-1"
                placeholder="Actividad"
                value={r.description}
                onChange={(e) => setRow(i, { description: e.target.value })}
              />
              <Input placeholder="Und" value={r.unit} onChange={(e) => setRow(i, { unit: e.target.value })} />
              <Input type="number" step="any" inputMode="decimal" value={r.quantity} onChange={(e) => setRow(i, { quantity: e.target.value })} />
              <Input type="number" step="any" inputMode="decimal" value={r.unitPrice} onChange={(e) => setRow(i, { unitPrice: e.target.value })} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                disabled={rows.length === 1}
                onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, emptyRow()])}>
            <Plus className="mr-1 h-4 w-4" /> Agregar ítem
          </Button>
        </div>

        {totals && aiu && <Liquidation totals={totals} aiu={aiu} />}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar borrador"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({
  order,
  onClose,
  onReject,
}: {
  order: BudgetChangeOrder | null;
  onClose: () => void;
  onReject: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rechazar {order?.number}</DialogTitle>
          <DialogDescription>El motivo es obligatorio y quedará visible para quien lo creó.</DialogDescription>
        </DialogHeader>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo del rechazo" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={!reason.trim()}
            onClick={async () => {
              await onReject(reason.trim());
              setReason("");
            }}
          >
            Rechazar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
