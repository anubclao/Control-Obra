"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Wallet,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Banknote,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ModuleExplanationCard } from "@/components/ui/module-explanation-card";
import {
  usePaymentsStore,
  useProjectsStore,
  useProvidersStore,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_VARIANTS,
  PAYMENT_TYPE_LABELS,
  PAYMENT_PRIORITY_LABELS,
  PAYMENT_PRIORITY_VARIANTS,
} from "@/lib/data-store";
import { PaymentForm } from "@/components/payments/payment-form";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { PaymentRequest, PaymentStatus, PaymentPriority } from "@/types";

export default function PagosPage() {
  const { payments, deletePayment, load } = usePaymentsStore();
  const { projects, getProject, load: loadProjects } = useProjectsStore();
  const { getProvider, load: loadProviders } = useProvidersStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | PaymentStatus>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | PaymentPriority>("ALL");
  const [projectFilter, setProjectFilter] = useState<string>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentRequest | null>(null);
  const confirmDel = useConfirm();

  useEffect(() => {
    load();
    loadProjects();
    loadProviders();
  }, []);

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      const project = getProject(p.projectId);
      const matchSearch =
        !search ||
        p.requestNumber.toLowerCase().includes(search.toLowerCase()) ||
        p.beneficiaryName.toLowerCase().includes(search.toLowerCase()) ||
        (project?.name.toLowerCase().includes(search.toLowerCase()) ?? false);
      const matchStatus = statusFilter === "ALL" || p.status === statusFilter;
      const matchPriority = priorityFilter === "ALL" || p.priority === priorityFilter;
      const matchProject = projectFilter === "ALL" || p.projectId === projectFilter;
      return matchSearch && matchStatus && matchPriority && matchProject;
    });
  }, [payments, search, statusFilter, priorityFilter, projectFilter, getProject]);

  const stats = useMemo(() => {
    const pending = payments.filter((p) => p.status === "PENDING").length;
    const inApproval = payments.filter(
      (p) => p.status === "APPROVED_LEVEL_1" || p.status === "APPROVED_LEVEL_2"
    ).length;
    const approved = payments.filter((p) => p.status === "APPROVED").length;
    const paid = payments.filter((p) => p.status === "PAID").length;
    const pendingAmount = payments
      .filter((p) => ["PENDING", "APPROVED_LEVEL_1", "APPROVED_LEVEL_2"].includes(p.status))
      .reduce((s, p) => s + p.amount, 0);
    const paidAmount = payments.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amount, 0);
    return { pending, inApproval, approved, paid, pendingAmount, paidAmount };
  }, [payments]);

  function askDelete(p: PaymentRequest) {
    const project = getProject(p.projectId);
    confirmDel.open({
      title: "Eliminar solicitud de pago?",
      description: "Vas a eliminar la solicitud y su historial. Esta accion NO se puede deshacer.",
      details: (
        <div className="space-y-1 text-xs">
          <p><strong>Numero:</strong> {p.requestNumber}</p>
          <p><strong>Beneficiario:</strong> {p.beneficiaryName}</p>
          <p><strong>Tipo:</strong> {PAYMENT_TYPE_LABELS[p.type] ?? p.type}</p>
          <p><strong>Proyecto:</strong> {project?.code ?? "-"} - {project?.name ?? "-"}</p>
          <p><strong>Monto:</strong> {formatCurrency(p.amount)}</p>
          <p><strong>Estado:</strong> {PAYMENT_STATUS_LABELS[p.status]}</p>
        </div>
      ),
      variant: "danger",
      confirmText: "Eliminar solicitud",
      onConfirm: async () => { await deletePayment(p.id); },
    });
  }

  return (
    <div className="space-y-6">
      <ModuleExplanationCard
        icon={CreditCard}
        variant="guide"
        title="Pagos"
        description="Solicitudes de pago a contratistas y proveedores. Pasan por un flujo de aprobacion multinivel antes del desembolso."
        steps={[
          { title: "Crea la solicitud", description: "Define beneficiario, monto, tipo, prioridad y datos bancarios." },
          { title: "Aprobacion N1 + N2", description: "Pasa por dos niveles de aprobacion: residente/administrativo y gerencia." },
          { title: "Aprobacion final", description: "Gerencia/Super Admin aprueban para que quede lista para pago." },
          { title: "Pago", description: "Tesoreria registra el pago real y la solicitud pasa a PAID." },
        ]}
        tips={[
          "Solo se pueden editar solicitudes en estado PENDING.",
          "Una solicitud PAGADA no se elimina desde aqui (queda como registro contable).",
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Pagos</h1>
          <p className="text-sm text-muted-foreground">
            {payments.length} solicitudes - {stats.pending} pendientes - {stats.paid} pagados
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nueva solicitud
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear solicitud de pago</DialogTitle>
              <DialogDescription>
                Define el beneficiario, monto y datos bancarios
              </DialogDescription>
            </DialogHeader>
            <PaymentForm onSuccess={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiMini label="Pendientes" value={stats.pending} icon={Clock} color="text-amber-600" />
        <KpiMini label="En aprobacion" value={stats.inApproval} icon={AlertCircle} color="text-blue-600" />
        <KpiMini label="Aprobados" value={stats.approved} icon={CheckCircle2} color="text-emerald-600" />
        <KpiMini label="Pagados" value={stats.paid} icon={Banknote} color="text-emerald-700" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Por pagar (en flujo)</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">{formatCurrency(stats.pendingAmount)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total pagado</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{formatCurrency(stats.paidAmount)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por numero, beneficiario o proyecto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-full lg:w-[200px]">
            <SelectValue placeholder="Proyecto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los proyectos</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-full lg:w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as typeof priorityFilter)}>
          <SelectTrigger className="w-full lg:w-[160px]">
            <SelectValue placeholder="Prioridad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas</SelectItem>
            {Object.entries(PAYMENT_PRIORITY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Wallet className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No hay solicitudes</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {search || statusFilter !== "ALL" || priorityFilter !== "ALL" || projectFilter !== "ALL"
              ? "Intenta con otros filtros"
              : "Crea la primera solicitud de pago"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const project = getProject(p.projectId);
            const provider = p.providerId ? getProvider(p.providerId) : undefined;
            return (
              <PaymentRow
                key={p.id}
                payment={p}
                projectName={project?.name}
                projectCode={project?.code}
                providerName={provider?.name}
                onEdit={() => setEditing(p)}
                onDelete={() => askDelete(p)}
              />
            );
          })}
        </div>
      )}

      {/* Modal editar */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar solicitud de pago</DialogTitle>
            <DialogDescription>{editing?.requestNumber}</DialogDescription>
          </DialogHeader>
          {editing && <PaymentForm payment={editing} onSuccess={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

      {confirmDel.dialog}
    </div>
  );
}

function KpiMini({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5", color)} />
        {label}
      </div>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function PaymentRow({
  payment: p,
  projectName,
  projectCode,
  providerName,
  onEdit,
  onDelete,
}: {
  payment: PaymentRequest;
  projectName?: string;
  projectCode?: string;
  providerName?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const variant = PAYMENT_STATUS_VARIANTS[p.status];
  const priorityVariant = PAYMENT_PRIORITY_VARIANTS[p.priority];
  const isEditable = p.status === "PENDING";

  return (
    <div className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Wallet className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-xs text-muted-foreground">{p.requestNumber}</p>
            <Badge variant={variant}>{PAYMENT_STATUS_LABELS[p.status]}</Badge>
            <Badge variant={priorityVariant}>{PAYMENT_PRIORITY_LABELS[p.priority]}</Badge>
            <span className="text-xs text-muted-foreground">
              {PAYMENT_TYPE_LABELS[p.type] ?? p.type}
            </span>
          </div>
          <Link href={`/administrativo/pagos/${p.id}`} className="mt-0.5 block font-medium hover:underline">
            {p.beneficiaryName}
          </Link>
          <p className="text-xs text-muted-foreground">
            {projectCode} - {projectName}
            {providerName ? ` - ${providerName}` : ""}
            {p.dueDate ? ` - Vence: ${formatDate(p.dueDate)}` : ""}
          </p>
        </div>

        <div className="hidden text-right sm:block">
          <p className="text-xs text-muted-foreground">Monto</p>
          <p className="text-lg font-semibold">{formatCurrency(p.amount)}</p>
          {p.workCutId && (
            <p className="mt-0.5 text-xs text-muted-foreground">de corte {p.workCutId}</p>
          )}
        </div>

        <div className="relative">
          <Button variant="ghost" size="icon" onClick={() => setMenuOpen(!menuOpen)} className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
          {menuOpen && (
            <div
              className="absolute right-0 z-10 mt-1 w-40 rounded-md border bg-card shadow-lg"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <Link
                href={`/administrativo/pagos/${p.id}`}
                className="flex items-center gap-2 rounded-t-md px-3 py-2 text-sm hover:bg-accent"
              >
                <Eye className="h-4 w-4" />
                Ver detalle
              </Link>
              {isEditable && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </button>
              )}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="flex w-full items-center gap-2 rounded-b-md px-3 py-2 text-sm text-destructive hover:bg-accent"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}