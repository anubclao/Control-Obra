"use client";

import { useState, useMemo } from "react";
import {
  Plus,
  FileSpreadsheet,
  Search,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Pencil,
  MoreVertical,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useQuotationsStore,
  QUOTATION_STATUS_LABELS,
  QUOTATION_STATUS_VARIANTS,
} from "@/lib/data-store";
import { useClientsStore } from "@/lib/data-store";
import { useAuthStore } from "@/lib/auth-store";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { Quotation, QuotationItem, QuotationStatus } from "@/types";

import { useConfirm } from "@/components/ui/confirm-dialog";
import { ModuleExplanationCard } from "@/components/ui/module-explanation-card";
import { KpiMini } from "@/components/ui/kpi-card";
import { PanelState } from "@/components/ui/panel-state";
import { PaginationControl } from "@/components/ui/pagination-control";
export default function CotizacionesPage() {
  const {
    quotations,
    deleteQuotation,
    setStatus,
    loadPage,
    loading: quotationsLoading,
    error: quotationsError,
    pagination: quotationsPagination,
  } = useQuotationsStore();
  const { getClient } = useClientsStore();
  const { user } = useAuthStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | QuotationStatus>(
    "ALL",
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [viewing, setViewing] = useState<Quotation | null>(null);
  const [editing, setEditing] = useState<Quotation | null>(null);

  const filtered = useMemo(() => {
    return quotations.filter((q) => {
      const client = getClient(q.clientId);
      const matchSearch =
        !search ||
        q.quotationNumber.toLowerCase().includes(search.toLowerCase()) ||
        q.title.toLowerCase().includes(search.toLowerCase()) ||
        (client?.companyName.toLowerCase().includes(search.toLowerCase()) ??
          false);
      const matchStatus = statusFilter === "ALL" || q.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [quotations, search, statusFilter, getClient]);

  const stats = useMemo(() => {
    const open = quotations.filter((q) =>
      ["DRAFT", "SENT", "VIEWED"].includes(q.status),
    );
    const accepted = quotations.filter((q) => q.status === "ACCEPTED");
    const rejected = quotations.filter((q) => q.status === "REJECTED");
    const totalValue = quotations.reduce((s, q) => s + q.total, 0);
    const openValue = open.reduce((s, q) => s + q.total, 0);
    const acceptedValue = accepted.reduce((s, q) => s + q.total, 0);
    return {
      total: quotations.length,
      open: open.length,
      accepted: accepted.length,
      rejected: rejected.length,
      totalValue,
      openValue,
      acceptedValue,
    };
  }, [quotations]);

  return (
    <div className="space-y-6">
      <ModuleExplanationCard
        icon={FileSpreadsheet}
        variant="guide"
        title="Cotizaciones"
        description="Cotizaciones con items, IVA, descuentos."
        steps={[
          {
            title: "Elige cliente",
            description: "De la cartera o crea uno nuevo.",
          },
          {
            title: "Agrega items",
            description: "Unidad, cantidad y precio unitario.",
          },
          { title: "Envia al cliente", description: "Cambia a SENT." },
        ]}
        tips={["ACCEPTED se convierte en Proyecto desde Reportes."]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Cotizaciones
          </h1>
          <p className="text-sm text-muted-foreground">
            {stats.total} cotizaciones · {stats.open} abiertas ·{" "}
            {formatCurrency(stats.totalValue)} en total
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nueva cotización
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear cotización</DialogTitle>
              <DialogDescription>
                Detalla los ítems, descuentos e impuestos
              </DialogDescription>
            </DialogHeader>
            <QuotationForm
              onSuccess={() => setCreateOpen(false)}
              createdBy={user?.id ?? "unknown"}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi
          label="Abiertas"
          value={stats.open}
          icon={Clock}
          color="text-blue-600"
        />
        <Kpi
          label="Aceptadas"
          value={stats.accepted}
          icon={CheckCircle2}
          color="text-emerald-600"
        />
        <Kpi
          label="Rechazadas"
          value={stats.rejected}
          icon={XCircle}
          color="text-red-600"
        />
        <Kpi
          label="Total emitido"
          value={formatCurrency(stats.totalValue)}
          icon={FileSpreadsheet}
          color="text-violet-600"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, título o cliente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            {Object.entries(QUOTATION_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <PanelState
        loading={quotationsLoading && quotations.length === 0}
        error={quotations.length === 0 ? quotationsError : null}
        onRetry={() => useQuotationsStore().load()}
        isEmpty={filtered.length === 0}
        emptyTitle="Sin cotizaciones"
        emptyDescription="Crea tu primera cotizacion desde el boton superior."
        emptyIcon={FileSpreadsheet}
        skeletonRows={3}
      >
        <div className="space-y-2">
          {filtered.map((q) => {
            const client = getClient(q.clientId);
            return (
              <QuotationRow
                key={q.id}
                quotation={q}
                clientName={client?.companyName}
                onView={() => setViewing(q)}
                onEdit={() => setEditing(q)}
                onDelete={() => deleteQuotation(q.id)}
                onSend={() => setStatus(q.id, "SENT")}
              />
            );
          })}
        </div>
      </PanelState>

      {quotationsPagination && (
        <PaginationControl
          page={quotationsPagination.page}
          totalPages={quotationsPagination.totalPages}
          total={quotationsPagination.total}
          limit={quotationsPagination.limit}
          loading={quotationsLoading}
          onPageChange={(p) => loadPage(p, quotationsPagination.limit)}
          noun="cotizaciones"
        />
      )}

      {/* Modal ver detalle */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {viewing && (
            <QuotationDetail
              quotation={viewing}
              onClose={() => setViewing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal editar */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar cotización</DialogTitle>
            <DialogDescription>{editing?.quotationNumber}</DialogDescription>
          </DialogHeader>
          {editing && (
            <QuotationForm
              quotation={editing}
              onSuccess={() => setEditing(null)}
              createdBy={user?.id ?? "unknown"}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  // Wrapper compatible con la version previa; reusa `KpiMini` para
  // tener el mismo look. Cast a `LucideIcon` (ForwardRefExoticComponent)
  // porque KpiMini exige el tipo estricto de lucide-react.
  const Lucide = Icon as unknown as Parameters<typeof KpiMini>[0]["icon"];
  return <KpiMini label={label} value={value} icon={Lucide} color={color} />;
}

function QuotationRow({
  quotation: q,
  clientName,
  onView,
  onEdit,
  onDelete,
  onSend,
}: {
  quotation: Quotation;
  clientName?: string;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSend: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const variant = QUOTATION_STATUS_VARIANTS[q.status];
  const isExpired =
    new Date(q.validUntil) < new Date() &&
    q.status !== "ACCEPTED" &&
    q.status !== "CANCELLED" &&
    q.status !== "REJECTED";

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm",
        isExpired && "border-amber-300 bg-amber-50/30",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <FileSpreadsheet className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-xs text-muted-foreground">
              {q.quotationNumber}
            </p>
            <Badge variant={variant}>{QUOTATION_STATUS_LABELS[q.status]}</Badge>
            {isExpired && <Badge variant="warning">Vencida</Badge>}
          </div>
          <p className="mt-0.5 text-sm font-medium">{q.title}</p>
          <p className="text-xs text-muted-foreground">
            {clientName ? `${clientName} · ` : ""}Vence{" "}
            {formatDate(q.validUntil)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">{formatCurrency(q.total)}</p>
          <p className="text-xs text-muted-foreground">
            {q.items.length} ítems
          </p>
        </div>
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMenuOpen(!menuOpen)}
            className="h-8 w-8"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
          {menuOpen && (
            <div
              className="absolute right-0 z-10 mt-1 w-40 rounded-md border bg-card shadow-lg"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onView();
                }}
                className="flex w-full items-center gap-2 rounded-t-md px-3 py-2 text-sm hover:bg-accent"
              >
                <Eye className="h-4 w-4" /> Ver detalle
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
              >
                <Pencil className="h-4 w-4" /> Editar
              </button>
              {q.status === "DRAFT" && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onSend();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                >
                  <Send className="h-4 w-4" /> Enviar
                </button>
              )}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="flex w-full items-center gap-2 rounded-b-md px-3 py-2 text-sm text-destructive hover:bg-accent"
              >
                <Trash2 className="h-4 w-4" /> Eliminar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuotationForm({
  quotation,
  onSuccess,
  createdBy,
}: {
  quotation?: Quotation;
  onSuccess: () => void;
  createdBy?: string;
}) {
  const { addQuotation, updateQuotation } = useQuotationsStore();
  const { clients } = useClientsStore();
  const isEditing = !!quotation;

  const [clientId, setClientId] = useState(quotation?.clientId ?? "");
  const [title, setTitle] = useState(quotation?.title ?? "");
  const [description, setDescription] = useState(quotation?.description ?? "");
  const [validUntil, setValidUntil] = useState(
    quotation?.validUntil ??
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
  );
  const [items, setItems] = useState<QuotationItem[]>(
    quotation?.items ?? [
      {
        id: "new1",
        description: "",
        unit: "M2",
        quantity: 0,
        unitPrice: 0,
        totalPrice: 0,
      },
    ],
  );
  const [discountPercent, setDiscountPercent] = useState(
    quotation?.discountPercent ?? 0,
  );
  const [ivaPercent, setIvaPercent] = useState(quotation?.ivaPercent ?? 19);
  const [paymentTerms, setPaymentTerms] = useState(
    quotation?.paymentTerms ?? "",
  );
  const [deliveryTerms, setDeliveryTerms] = useState(
    quotation?.deliveryTerms ?? "",
  );
  const [warranty, setWarranty] = useState(quotation?.warranty ?? "");
  const [observations, setObservations] = useState(
    quotation?.observations ?? "",
  );
  const [status, setStatus] = useState<QuotationStatus>(
    quotation?.status ?? "DRAFT",
  );

  const subtotal = items.reduce((s, it) => s + it.totalPrice, 0);
  const discountAmount = Math.round(subtotal * (discountPercent / 100));
  const base = subtotal - discountAmount;
  const ivaAmount = Math.round(base * (ivaPercent / 100));
  const total = base + ivaAmount;

  function updateItem(
    idx: number,
    field: keyof QuotationItem,
    value: string | number,
  ) {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const updated = { ...it, [field]: value };
        if (field === "quantity" || field === "unitPrice") {
          updated.totalPrice =
            Number(updated.quantity || 0) * Number(updated.unitPrice || 0);
        }
        return updated;
      }),
    );
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        id: `new${Date.now()}`,
        description: "",
        unit: "GL",
        quantity: 0,
        unitPrice: 0,
        totalPrice: 0,
      },
    ]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      clientId,
      title,
      description: description || undefined,
      status,
      items,
      discountPercent,
      ivaPercent,
      validUntil,
      paymentTerms: paymentTerms || undefined,
      deliveryTerms: deliveryTerms || undefined,
      warranty: warranty || undefined,
      observations: observations || undefined,
    };
    if (quotation) {
      updateQuotation(quotation.id, data as Partial<Quotation>);
    } else {
      addQuotation({
        ...data,
        createdBy,
      });
    }
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block">Cliente *</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona cliente" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.companyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block">Válida hasta *</Label>
          <Input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            required
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="mb-1.5 block">Título *</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="mb-1.5 block">Descripción</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      {/* Items */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Ítems</h3>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Ítem
          </Button>
        </div>
        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={it.id} className="rounded-md border bg-secondary/30 p-3">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-12 sm:col-span-5">
                  <Input
                    value={it.description}
                    onChange={(e) =>
                      updateItem(idx, "description", e.target.value)
                    }
                    placeholder="Descripción"
                  />
                </div>
                <div className="col-span-3 sm:col-span-1">
                  <Input
                    value={it.unit}
                    onChange={(e) => updateItem(idx, "unit", e.target.value)}
                    placeholder="M2"
                  />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={it.quantity}
                    onChange={(e) =>
                      updateItem(
                        idx,
                        "quantity",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    placeholder="Cant."
                  />
                </div>
                <div className="col-span-5 sm:col-span-2">
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={it.unitPrice}
                    onChange={(e) =>
                      updateItem(
                        idx,
                        "unitPrice",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    placeholder="P. Unit."
                  />
                </div>
                <div className="col-span-9 col-start-1 flex items-center justify-between rounded border bg-background px-3 py-1.5 text-sm sm:col-span-2 sm:col-start-auto">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-semibold">
                    {formatCurrency(it.totalPrice)}
                  </span>
                </div>
                {items.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(idx)}
                    className="col-span-3 h-9 w-full sm:col-span-1 sm:w-9"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Descuentos e IVA */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 block">Descuento (%)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={discountPercent}
            onChange={(e) =>
              setDiscountPercent(parseFloat(e.target.value) || 0)
            }
          />
        </div>
        <div>
          <Label className="mb-1.5 block">IVA (%)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={ivaPercent}
            onChange={(e) => setIvaPercent(parseFloat(e.target.value) || 0)}
          />
        </div>
      </div>

      {/* Resumen */}
      <div className="rounded-lg border bg-secondary/40 p-4">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-semibold">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Descuento ({discountPercent}%)
            </span>
            <span className="font-semibold text-red-600">
              −{formatCurrency(discountAmount)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">IVA ({ivaPercent}%)</span>
            <span className="font-semibold text-red-600">
              +{formatCurrency(ivaAmount)}
            </span>
          </div>
          <div className="flex justify-between border-t pt-1.5 text-lg">
            <span className="font-semibold">Total</span>
            <span className="font-bold text-emerald-600">
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block">Condiciones de pago</Label>
          <Input
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            placeholder="30% anticipo, 40% avance, 30% entrega"
          />
        </div>
        <div>
          <Label className="mb-1.5 block">Plazo de entrega</Label>
          <Input
            value={deliveryTerms}
            onChange={(e) => setDeliveryTerms(e.target.value)}
            placeholder="18 meses"
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="mb-1.5 block">Garantía</Label>
          <Input
            value={warranty}
            onChange={(e) => setWarranty(e.target.value)}
            placeholder="5 años estructura, 1 año acabados"
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="mb-1.5 block">Observaciones</Label>
          <Textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      <div className="flex justify-between gap-2 border-t pt-4">
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as QuotationStatus)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(QUOTATION_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onSuccess}>
            Cancelar
          </Button>
          <Button type="submit">
            {isEditing ? "Guardar" : "Crear cotización"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function QuotationDetail({
  quotation: q,
  onClose,
}: {
  quotation: Quotation;
  onClose: () => void;
}) {
  const { getClient } = useClientsStore();
  const { acceptQuotation, setStatus } = useQuotationsStore();
  const client = getClient(q.clientId);

  function handleAccept() {
    acceptQuotation(q.id);
    onClose();
  }
  function handleReject() {
    setStatus(q.id, "REJECTED");
    onClose();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{q.title}</DialogTitle>
        <DialogDescription>
          {q.quotationNumber} · {client?.companyName} · Vence{" "}
          {formatDate(q.validUntil)}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {q.description && (
          <p className="rounded-md bg-secondary/40 p-3 text-sm">
            {q.description}
          </p>
        )}

        {/* Tabla de items */}
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary/30 text-left text-xs uppercase text-muted-foreground">
                <th className="px-3 py-2">Descripción</th>
                <th className="px-3 py-2 text-center">Unidad</th>
                <th className="px-3 py-2 text-right">Cantidad</th>
                <th className="px-3 py-2 text-right">P. Unit.</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {q.items.map((it) => (
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

        {/* Totales */}
        <div className="rounded-md border bg-secondary/40 p-3">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(q.subtotal)}</span>
            </div>
            {q.discountPercent > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Descuento ({q.discountPercent}%)
                </span>
                <span className="text-red-600">
                  −{formatCurrency(q.discountAmount)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                IVA ({q.ivaPercent}%)
              </span>
              <span className="text-red-600">
                +{formatCurrency(q.ivaAmount)}
              </span>
            </div>
            <div className="flex justify-between border-t pt-1 text-lg">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-emerald-600">
                {formatCurrency(q.total)}
              </span>
            </div>
          </div>
        </div>

        {/* Condiciones */}
        {(q.paymentTerms || q.deliveryTerms || q.warranty) && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
            {q.paymentTerms && (
              <div>
                <p className="text-xs text-muted-foreground">Pago</p>
                <p>{q.paymentTerms}</p>
              </div>
            )}
            {q.deliveryTerms && (
              <div>
                <p className="text-xs text-muted-foreground">Entrega</p>
                <p>{q.deliveryTerms}</p>
              </div>
            )}
            {q.warranty && (
              <div>
                <p className="text-xs text-muted-foreground">Garantía</p>
                <p>{q.warranty}</p>
              </div>
            )}
          </div>
        )}

        {q.observations && (
          <p className="rounded-md border bg-amber-50 p-3 text-sm text-amber-900">
            <strong>Observaciones:</strong> {q.observations}
          </p>
        )}

        {/* Acciones de estado */}
        {(q.status === "DRAFT" ||
          q.status === "SENT" ||
          q.status === "VIEWED") && (
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="destructive" onClick={handleReject}>
              <XCircle className="mr-2 h-4 w-4" />
              Rechazar
            </Button>
            <Button onClick={handleAccept}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Aceptar
            </Button>
          </div>
        )}

        {q.status === "ACCEPTED" && q.convertedToProjectId && (
          <p className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
            ✓ Aceptada y convertida en proyecto
          </p>
        )}
      </div>
    </>
  );
}
