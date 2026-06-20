"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  FileText,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  CheckCircle2,
  Pause,
  XCircle,
  Calendar,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useContractsStore,
  CONTRACT_TYPE_LABELS,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_VARIANTS,
} from "@/lib/contracts-store";
import { useProjectsStore } from "@/lib/projects-store";
import { useProvidersStore } from "@/lib/providers-store";
import { ContractForm } from "@/components/contracts/contract-form";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Contract, ContractStatus, ContractType } from "@/types";

export default function ContratosPage() {
  const { contracts, deleteContract } = useContractsStore();
  const { getProject } = useProjectsStore();
  const { getProvider } = useProvidersStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ContractStatus>("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | ContractType>("ALL");
  const [projectFilter, setProjectFilter] = useState<string>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [deleting, setDeleting] = useState<Contract | null>(null);

  const filtered = useMemo(() => {
    return contracts.filter((c) => {
      const project = getProject(c.projectId);
      const provider = getProvider(c.providerId);
      const matchSearch =
        !search ||
        c.contractNumber.toLowerCase().includes(search.toLowerCase()) ||
        c.scopeOfWork.toLowerCase().includes(search.toLowerCase()) ||
        (project?.name.toLowerCase().includes(search.toLowerCase()) ?? false) ||
        (provider?.name.toLowerCase().includes(search.toLowerCase()) ?? false);
      const matchStatus = statusFilter === "ALL" || c.status === statusFilter;
      const matchType = typeFilter === "ALL" || c.type === typeFilter;
      const matchProject = projectFilter === "ALL" || c.projectId === projectFilter;
      return matchSearch && matchStatus && matchType && matchProject;
    });
  }, [contracts, search, statusFilter, typeFilter, projectFilter, getProject, getProvider]);

  const stats = useMemo(() => {
    const active = contracts.filter((c) => c.status === "ACTIVE").length;
    const suspended = contracts.filter((c) => c.status === "SUSPENDED").length;
    const completed = contracts.filter((c) => c.status === "COMPLETED").length;
    const totalValue = contracts.reduce((s, c) => s + c.value, 0);
    const activeValue = contracts
      .filter((c) => c.status === "ACTIVE")
      .reduce((s, c) => s + c.value, 0);
    return { active, suspended, completed, totalValue, activeValue, total: contracts.length };
  }, [contracts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Contratos</h1>
          <p className="text-sm text-muted-foreground">
            {stats.total} contratos · {stats.active} activos · {stats.suspended} suspendidos
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo contrato
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear contrato</DialogTitle>
              <DialogDescription>
                Vincula un contratista a un proyecto con condiciones y documentos
              </DialogDescription>
            </DialogHeader>
            <ContractForm onSuccess={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiMini label="Activos" value={stats.active} icon={CheckCircle2} color="text-emerald-600" />
        <KpiMini label="Suspendidos" value={stats.suspended} icon={Pause} color="text-amber-600" />
        <KpiMini label="Completados" value={stats.completed} icon={CheckCircle2} color="text-blue-600" />
        <KpiMini label="Cancelados" value={contracts.filter((c) => c.status === "CANCELLED").length} icon={XCircle} color="text-red-600" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Valor total contratado</p>
          <p className="mt-1 text-2xl font-semibold">{formatCurrency(stats.totalValue)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Valor en contratos activos</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{formatCurrency(stats.activeValue)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, alcance, proyecto o contratista…"
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
            {Array.from(new Set(contracts.map((c) => c.projectId))).map((pid) => {
              const p = getProject(pid);
              return p ? (
                <SelectItem key={pid} value={pid}>
                  {p.code}
                </SelectItem>
              ) : null;
            })}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
          <SelectTrigger className="w-full lg:w-[160px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los tipos</SelectItem>
            {Object.entries(CONTRACT_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-full lg:w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            {Object.entries(CONTRACT_STATUS_LABELS).map(([k, v]) => (
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
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No hay contratos</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {search || statusFilter !== "ALL" || typeFilter !== "ALL" || projectFilter !== "ALL"
              ? "Intenta con otros filtros"
              : "Crea el primer contrato"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const project = getProject(c.projectId);
            const provider = getProvider(c.providerId);
            return (
              <ContractRow
                key={c.id}
                contract={c}
                projectName={project?.name}
                projectCode={project?.code}
                providerName={provider?.name}
                onEdit={() => setEditing(c)}
                onDelete={() => setDeleting(c)}
              />
            );
          })}
        </div>
      )}

      {/* Modal editar */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar contrato</DialogTitle>
            <DialogDescription>{editing?.contractNumber}</DialogDescription>
          </DialogHeader>
          {editing && <ContractForm contract={editing} onSuccess={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar contrato?</DialogTitle>
            <DialogDescription>
              Se eliminará <strong>{deleting?.contractNumber}</strong> y todos sus documentos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) {
                  deleteContract(deleting.id);
                  setDeleting(null);
                }
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
        <Icon className={`h-3.5 w-3.5 ${color}`} />
        {label}
      </div>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function ContractRow({
  contract: c,
  projectName,
  projectCode,
  providerName,
  onEdit,
  onDelete,
}: {
  contract: Contract;
  projectName?: string;
  projectCode?: string;
  providerName?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const variant = CONTRACT_STATUS_VARIANTS[c.status];
  const hasAllDocs = c.documents.some((d) => d.type === "CONTRATO_FIRMADO") &&
    c.documents.some((d) => d.type === "POLIZA_CUMPLIMIENTO") &&
    c.documents.some((d) => d.type === "ACTA_INICIO");

  return (
    <div className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <FileText className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-xs text-muted-foreground">{c.contractNumber}</p>
            <Badge variant={variant}>{CONTRACT_STATUS_LABELS[c.status]}</Badge>
            <span className="text-xs text-muted-foreground">{CONTRACT_TYPE_LABELS[c.type]}</span>
            {!hasAllDocs && (
              <Badge variant="warning" className="text-[10px]">
                Docs faltantes
              </Badge>
            )}
          </div>
          {projectCode && (
            <p className="text-xs text-muted-foreground">
              {projectCode} · {projectName}
            </p>
          )}
          <Link
            href={`/tecnico/contratos/${c.id}`}
            className="mt-1 line-clamp-1 text-sm font-medium hover:underline"
          >
            {c.scopeOfWork}
          </Link>
          {providerName && (
            <p className="text-xs text-muted-foreground">Contratista: {providerName}</p>
          )}
        </div>

        <div className="hidden text-right sm:block">
          <p className="text-xs text-muted-foreground">Valor</p>
          <p className="text-lg font-semibold">{formatCurrency(c.value)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground flex items-center justify-end gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(c.startDate)} → {formatDate(c.endDate)}
          </p>
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
                href={`/tecnico/contratos/${c.id}`}
                className="flex items-center gap-2 rounded-t-md px-3 py-2 text-sm hover:bg-accent"
              >
                <Eye className="h-4 w-4" />
                Ver detalle
              </Link>
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
