"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Scissors,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Building2,
  Truck,
  ClipboardList,
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
import { ConfirmDialog, useConfirm } from "@/components/ui/confirm-dialog";
import { ModuleExplanationCard } from "@/components/ui/module-explanation-card";
import { useCutsStore, useProjectsStore, useProvidersStore } from "@/lib/data-store";
import { useAuthStore } from "@/lib/auth-store";
import { CUT_STATUS_LABELS, CUT_STATUS_VARIANTS } from "@/lib/data-store";
import { useIsSuperAdmin } from "@/lib/permissions";
import { CutForm } from "@/components/cuts/cut-form";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { WorkCut, WorkCutStatus } from "@/types";

export default function CortesPage() {
  const { cuts, deleteCut, load: loadCuts } = useCutsStore();
  const { projects, getProject, load: loadProjects } = useProjectsStore();
  const { providers, getProvider, load: loadProviders } = useProvidersStore();
  const { user } = useAuthStore();
  const isSuperAdmin = useIsSuperAdmin();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | WorkCutStatus>("ALL");
  const [projectFilter, setProjectFilter] = useState<string>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<WorkCut | null>(null);
  const [deleting, setDeleting] = useState<WorkCut | null>(null);
  const confirmDel = useConfirm();

  useEffect(() => {
    loadCuts();
    loadProjects();
    loadProviders();
  }, []);

  const projectCuts = useMemo(() => {
    if (projectFilter === "ALL") return cuts;
    return cuts.filter((c) => c.projectId === projectFilter);
  }, [cuts, projectFilter]);

  const groupedByProvider = useMemo(() => {
    const groups: Record<string, { providerName: string; cuts: WorkCut[]; gross: number; net: number }> = {};
    for (const c of projectCuts) {
      const provider = getProvider(c.providerId);
      if (!groups[c.providerId]) {
        groups[c.providerId] = {
          providerName: provider?.name ?? "(Proveedor no encontrado)",
          cuts: [], gross: 0, net: 0,
        };
      }
      groups[c.providerId].cuts.push(c);
      groups[c.providerId].gross += c.grossValue;
      groups[c.providerId].net += c.netValue;
    }
    return Object.entries(groups);
  }, [projectCuts, getProvider]);

  const filtered = useMemo(() => {
    return projectCuts.filter((c) => {
      const project = getProject(c.projectId);
      const provider = getProvider(c.providerId);
      const matchSearch =
        !search ||
        c.cutNumber.toLowerCase().includes(search.toLowerCase()) ||
        c.description.toLowerCase().includes(search.toLowerCase()) ||
        (project?.name.toLowerCase().includes(search.toLowerCase()) ?? false) ||
        (provider?.name.toLowerCase().includes(search.toLowerCase()) ?? false);
      const matchStatus = statusFilter === "ALL" || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [projectCuts, search, statusFilter, getProject, getProvider]);

  const stats = useMemo(() => {
    const gross = projectCuts.reduce((s, c) => s + c.grossValue, 0);
    const net = projectCuts.reduce((s, c) => s + c.netValue, 0);
    return {
      total: projectCuts.length, gross, net,
      draft: projectCuts.filter((c) => c.status === "DRAFT").length,
      submitted: projectCuts.filter((c) => c.status === "SUBMITTED").length,
      validated: projectCuts.filter((c) => c.status === "VALIDATED").length,
      approved: projectCuts.filter((c) => c.status === "APPROVED").length,
      rejected: projectCuts.filter((c) => c.status === "REJECTED").length,
      paid: projectCuts.filter((c) => c.status === "PAID").length,
    };
  }, [projectCuts]);

  function openDeleteConfirm(c: WorkCut) {
    if (!isSuperAdmin) return;
    confirmDel.open({
      title: "¿Eliminar este corte?",
      description: `El corte ${c.cutNumber} se eliminará permanentemente. Esta acción NO se puede deshacer.`,
      details: (
        <div className="space-y-1 text-xs">
          <p><strong>Proyecto:</strong> {getProject(c.projectId)?.name}</p>
          <p><strong>Proveedor:</strong> {getProvider(c.providerId)?.name}</p>
          <p><strong>Valor neto:</strong> {formatCurrency(c.netValue)}</p>
        </div>
      ),
      variant: "danger",
      confirmText: "Eliminar corte",
      onConfirm: async () => {
        await deleteCut(c.id);
        setDeleting(null);
      },
    });
    setDeleting(c);
  }

  return (
    <div className="space-y-6">
      <ModuleExplanationCard
        icon={ClipboardList}
        variant="guide"
        title="Cortes de Obra"
        description="Registra el avance ejecutado por el contratista en cada período. Pasa por validación, aprobación y pago."
        steps={[
          {
            title: "Crea el corte",
            description: "Define proyecto, contratista, período y los ítems ejecutados con sus cantidades.",
          },
          {
            title: "Envía a validación",
            description: "El residente envía → Director valida → Admin aprueba → Tesorería paga.",
          },
          {
            title: "Vincula al pago",
            description: "Cuando el corte está APROBADO, Tesorería puede generar la solicitud de pago asociada.",
          },
        ]}
        warnings={[
          "Solo puedes eliminar cortes en estado DRAFT o REJECTED.",
          "El rechazo REQUIERE un motivo; el contratista debe corregir y reenviar.",
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Cortes de Obra</h1>
          <p className="text-sm text-muted-foreground">
            {projectFilter === "ALL"
              ? `${stats.total} cortes · Vista general`
              : `Agrupado por proveedor · ${getProject(projectFilter)?.name ?? ""}`}
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Nuevo corte
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear corte de obra</DialogTitle>
              <DialogDescription>
                Define el período, ítems ejecutados y descuentos. El valor se calcula de las actividades.
              </DialogDescription>
            </DialogHeader>
            <CutForm onSuccess={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <KpiMini label="Borrador" value={stats.draft} icon={FileText} color="text-muted-foreground" />
        <KpiMini label="Enviados" value={stats.submitted} icon={Clock} color="text-amber-600" />
        <KpiMini label="Validados" value={stats.validated} icon={CheckCircle2} color="text-blue-600" />
        <KpiMini label="Aprobados" value={stats.approved} icon={CheckCircle2} color="text-emerald-600" />
        <KpiMini label="Rechazados" value={stats.rejected} icon={XCircle} color="text-red-600" />
        <KpiMini label="Pagados" value={stats.paid} icon={CheckCircle2} color="text-emerald-700" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Valor bruto</p>
          <p className="mt-1 text-2xl font-semibold">{formatCurrency(stats.gross)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Valor neto</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{formatCurrency(stats.net)}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, descripción o proveedor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-full sm:w-[240px]">
            <Building2 className="mr-1 h-3.5 w-3.5" />
            <SelectValue placeholder="Proyecto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los proyectos</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.code} · {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            {Object.entries(CUT_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Scissors className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No hay cortes</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {projectFilter !== "ALL"
              ? "Selecciona otro proyecto o crea el primer corte para este."
              : search || statusFilter !== "ALL"
              ? "Intenta con otros filtros"
              : "Crea el primer corte de obra"}
          </p>
        </div>
      ) : projectFilter === "ALL" ? (
        <div className="space-y-2">
          {filtered.map((c) => (
            <CutRow
              key={c.id} cut={c}
              projectName={getProject(c.projectId)?.name}
              projectCode={getProject(c.projectId)?.code}
              providerName={getProvider(c.providerId)?.name}
              isSuperAdmin={isSuperAdmin}
              onEdit={() => setEditing(c)}
              onDelete={() => openDeleteConfirm(c)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByProvider
            .filter(([, g]) => g.cuts.some((c) => filtered.includes(c)))
            .map(([providerId, group]) => (
              <CardWrapper key={providerId}>
                <div className="flex items-center justify-between border-b bg-secondary/30 p-3">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <p className="font-semibold">{group.providerName}</p>
                    <Badge variant="outline">{group.cuts.length} corte{group.cuts.length === 1 ? "" : "s"}</Badge>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold">{formatCurrency(group.net)}</p>
                    <p className="text-xs text-muted-foreground">Neto acumulado</p>
                  </div>
                </div>
                <div className="divide-y">
                  {group.cuts.filter((c) => filtered.includes(c)).map((c) => (
                    <CutRow
                      key={c.id} cut={c}
                      projectName={getProject(c.projectId)?.name}
                      projectCode={getProject(c.projectId)?.code}
                      providerName={getProvider(c.providerId)?.name}
                      isSuperAdmin={isSuperAdmin}
                      onEdit={() => setEditing(c)}
                      onDelete={() => openDeleteConfirm(c)}
                    />
                  ))}
                </div>
              </CardWrapper>
            ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar corte</DialogTitle>
            <DialogDescription>{editing?.cutNumber}</DialogDescription>
          </DialogHeader>
          {editing && <CutForm cut={editing} onSuccess={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

      {confirmDel.dialog}
    </div>
  );
}

function CardWrapper({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border bg-card overflow-hidden">{children}</div>;
}

function KpiMini({
  label, value, icon: Icon, color,
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

function CutRow({
  cut: c, projectName, projectCode, providerName, isSuperAdmin, onEdit, onDelete,
}: {
  cut: WorkCut;
  projectName?: string;
  projectCode?: string;
  providerName?: string;
  isSuperAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const variant = CUT_STATUS_VARIANTS[c.status];
  const isEditable = c.status === "DRAFT" || c.status === "REJECTED";

  return (
    <div className="p-3 transition-shadow hover:bg-accent/30">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Scissors className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-xs text-muted-foreground">{c.cutNumber}</p>
            <Badge variant={variant}>{CUT_STATUS_LABELS[c.status]}</Badge>
            <span className="text-xs text-muted-foreground">
              {formatDate(c.periodStart)} → {formatDate(c.periodEnd)}
            </span>
          </div>
          <Link href={`/tecnico/cortes/${c.id}`} className="mt-0.5 block font-medium hover:underline">
            {c.description}
          </Link>
          <p className="text-xs text-muted-foreground">
            {projectCode} · {projectName}
            {providerName ? ` · ${providerName}` : ""}
          </p>
        </div>

        <div className="hidden text-right sm:block">
          <p className="text-xs text-muted-foreground">Bruto</p>
          <p className="font-semibold">{formatCurrency(c.grossValue)}</p>
          <p className="mt-1 text-xs text-emerald-600">Neto: {formatCurrency(c.netValue)}</p>
        </div>

        <div className="relative">
          <Button variant="ghost" size="icon" onClick={() => setMenuOpen(!menuOpen)} className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
          {menuOpen && (
            <div
              className="absolute right-0 z-10 mt-1 w-48 rounded-md border bg-card shadow-lg"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <Link
                href={`/tecnico/cortes/${c.id}`}
                className="flex items-center gap-2 rounded-t-md px-3 py-2 text-sm hover:bg-accent"
              >
                <Eye className="h-4 w-4" /> Ver detalle
              </Link>
              {isEditable && (
                <button
                  onClick={() => { setMenuOpen(false); onEdit(); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                >
                  <Pencil className="h-4 w-4" /> Editar
                </button>
              )}
              {isSuperAdmin && (
                <button
                  onClick={() => { setMenuOpen(false); onDelete(); }}
                  className="flex w-full items-center gap-2 rounded-b-md px-3 py-2 text-sm text-destructive hover:bg-accent"
                >
                  <Trash2 className="h-4 w-4" /> Eliminar
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
