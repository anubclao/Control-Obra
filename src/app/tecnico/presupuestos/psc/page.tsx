"use client";

import { useState, useMemo } from "react";
import {
  Plus,
  Search,
  Truck,
  FileText,
  Calendar,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  CheckCircle2,
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
  usePSCsStore,
  PSC_STATUS_LABELS,
  PSC_STATUS_VARIANTS,
} from "@/lib/pscs-store";
import { useProjectsStore } from "@/lib/projects-store";
import { useProvidersStore } from "@/lib/providers-store";
import { useBudgetStore } from "@/lib/budgets-store";
import { PSCForm } from "@/components/pscs/psc-form";
import { PSCDetail } from "@/components/pscs/psc-detail";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import type { PSC, PSCStatus } from "@/types";

export default function PSCPage() {
  const { pscs, deletePSC } = usePSCsStore();
  const { projects, getProject } = useProjectsStore();
  const { getProvider } = useProvidersStore();
  const { getBudgetByProject } = useBudgetStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | PSCStatus>("ALL");
  const [projectFilter, setProjectFilter] = useState<string>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PSC | null>(null);
  const [viewing, setViewing] = useState<PSC | null>(null);
  const [deleting, setDeleting] = useState<PSC | null>(null);

  const filtered = useMemo(() => {
    return pscs.filter((p) => {
      const project = getProject(p.projectId);
      const provider = getProvider(p.providerId);
      const matchSearch =
        !search ||
        p.pscNumber.toLowerCase().includes(search.toLowerCase()) ||
        p.notes?.toLowerCase().includes(search.toLowerCase()) ||
        (project?.name.toLowerCase().includes(search.toLowerCase()) ?? false) ||
        (provider?.name.toLowerCase().includes(search.toLowerCase()) ?? false);
      const matchStatus = statusFilter === "ALL" || p.status === statusFilter;
      const matchProject = projectFilter === "ALL" || p.projectId === projectFilter;
      return matchSearch && matchStatus && matchProject;
    });
  }, [pscs, search, statusFilter, projectFilter, getProject, getProvider]);

  const stats = useMemo(() => {
    const active = pscs.filter((p) => p.status === "ACTIVE").length;
    const totalContratado = pscs
      .filter((p) => p.status !== "CANCELLED")
      .reduce((s, p) => s + p.totalValue, 0);
    const totalEjecutado = pscs.reduce(
      (s, p) => s + p.items.reduce((sum, it) => sum + it.executedAmount, 0),
      0
    );
    return {
      total: pscs.length,
      active,
      totalContratado,
      totalEjecutado,
      executionPercent: totalContratado > 0 ? (totalEjecutado / totalContratado) * 100 : 0,
    };
  }, [pscs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">PSC</h1>
          <p className="text-sm text-muted-foreground">
            Presupuestos Proveedor — espejo del PT asignado a cada proveedor
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo PSC
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear PSC</DialogTitle>
              <DialogDescription>
                Selecciona los ítems del PT que cubrirá este contratista
              </DialogDescription>
            </DialogHeader>
            <PSCForm onSuccess={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Total" value={stats.total} icon={FileText} color="text-blue-600" />
        <Kpi label="Activos" value={stats.active} icon={CheckCircle2} color="text-emerald-600" />
        <Kpi
          label="Total contratado"
          value={formatCurrency(stats.totalContratado)}
          icon={Truck}
          color="text-violet-600"
        />
        <Kpi label="% Ejecutado" value={formatPercent(stats.executionPercent)} icon={Calendar} color="text-amber-600" />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, contratista o proyecto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Proyecto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los proyectos</SelectItem>
            {projects
              .filter((p) => getBudgetByProject(p.id))
              .map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.code}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            {Object.entries(PSC_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No hay PSC</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {search || statusFilter !== "ALL" || projectFilter !== "ALL"
              ? "Intenta con otros filtros"
              : "Crea el primer PSC"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((psc) => {
            const project = getProject(psc.projectId);
            const provider = getProvider(psc.providerId);
            const executed = psc.items.reduce((s, it) => s + it.executedAmount, 0);
            const percent = psc.totalValue > 0 ? (executed / psc.totalValue) * 100 : 0;
            return (
              <PSCRow
                key={psc.id}
                psc={psc}
                projectName={project?.name}
                projectCode={project?.code}
                providerName={provider?.name}
                executed={executed}
                percent={percent}
                onView={() => setViewing(psc)}
                onEdit={() => setEditing(psc)}
                onDelete={() => setDeleting(psc)}
              />
            );
          })}
        </div>
      )}

      {/* Modal ver */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {viewing && <PSCDetail psc={viewing} onClose={() => setViewing(null)} />}
        </DialogContent>
      </Dialog>

      {/* Modal editar */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar PSC</DialogTitle>
            <DialogDescription>{editing?.pscNumber}</DialogDescription>
          </DialogHeader>
          {editing && <PSCForm psc={editing} onSuccess={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar PSC?</DialogTitle>
            <DialogDescription>
              Se eliminará <strong>{deleting?.pscNumber}</strong>.
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
                  deletePSC(deleting.id);
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

function PSCRow({
  psc,
  projectName,
  projectCode,
  providerName,
  executed,
  percent,
  onView,
  onEdit,
  onDelete,
}: {
  psc: PSC;
  projectName?: string;
  projectCode?: string;
  providerName?: string;
  executed: number;
  percent: number;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const variant = PSC_STATUS_VARIANTS[psc.status];

  return (
    <div className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Truck className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-xs text-muted-foreground">{psc.pscNumber}</p>
            <Badge variant={variant}>{PSC_STATUS_LABELS[psc.status]}</Badge>
            {projectCode && (
              <span className="text-xs text-muted-foreground">{projectCode}</span>
            )}
          </div>
          <p className="mt-0.5 text-sm font-medium">{providerName}</p>
          <p className="text-xs text-muted-foreground">{projectName}</p>
          {psc.notes && (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
              {psc.notes}
            </p>
          )}

          {/* Mini barra de avance */}
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  "h-full",
                  percent >= 90 ? "bg-emerald-500" : percent >= 30 ? "bg-primary" : "bg-amber-500"
                )}
                style={{ width: `${Math.min(percent, 100)}%` }}
              />
            </div>
            <span className="text-xs font-medium">{formatPercent(percent)}</span>
          </div>
        </div>

        <div className="hidden text-right sm:block">
          <p className="text-xs text-muted-foreground">Contratado</p>
          <p className="text-lg font-semibold">{formatCurrency(psc.totalValue)}</p>
          <p className="text-xs text-emerald-600">Ejecutado: {formatCurrency(executed)}</p>
          <p className="text-xs text-muted-foreground">{psc.items.length} items</p>
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
              <button
                onClick={() => { setMenuOpen(false); onView(); }}
                className="flex w-full items-center gap-2 rounded-t-md px-3 py-2 text-sm hover:bg-accent"
              >
                <Eye className="h-4 w-4" /> Ver detalle
              </button>
              <button
                onClick={() => { setMenuOpen(false); onEdit(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
              >
                <Pencil className="h-4 w-4" /> Editar
              </button>
              <button
                onClick={() => { setMenuOpen(false); onDelete(); }}
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
