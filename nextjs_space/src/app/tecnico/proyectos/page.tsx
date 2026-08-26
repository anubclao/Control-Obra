"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Plus, Search, MapPin, Building2, Calendar as CalendarIcon,
  TrendingUp, MoreVertical, Eye, Pencil, Trash2, FolderKanban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ModuleExplanationCard } from "@/components/ui/module-explanation-card";
import { useProjectsStore, PROJECT_STATUS_LABELS, PROJECT_STATUS_VARIANTS } from "@/lib/data-store";
import { ProjectForm } from "@/components/projects/project-form";
import { useIsSuperAdmin } from "@/lib/permissions";
import { formatCurrency, formatDate, formatPercent, cn } from "@/lib/utils";
import type { Project, ProjectStatus } from "@/types";

export default function ProyectosPage() {
  const { projects, deleteProject, load } = useProjectsStore();
  const isSuperAdmin = useIsSuperAdmin();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ProjectStatus>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const confirmDel = useConfirm();

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => projects.filter((p) => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.client.toLowerCase().includes(search.toLowerCase());
    return matchSearch && (statusFilter === "ALL" || p.status === statusFilter);
  }), [projects, search, statusFilter]);

  const stats = useMemo(() => {
    const active = projects.filter((p) => p.status === "IN_EXECUTION").length;
    const planning = projects.filter((p) => p.status === "IN_PLANNING").length;
    const completed = projects.filter((p) => p.status === "COMPLETED").length;
    const totalBudget = projects.reduce((s, p) => s + p.totalBudget, 0);
    const totalExecuted = projects.reduce((s, p) => s + p.executedAmount, 0);
    return { active, planning, completed, totalBudget, totalExecuted };
  }, [projects]);

  function askDelete(p: Project) {
    if (!isSuperAdmin) return;
    confirmDel.open({
      title: "Eliminar proyecto?",
      description: "Vas a eliminar el proyecto. Esta accion NO se puede deshacer y borra en cascada cortes, contratos y bitacoras asociados.",
      details: (
        <div className="space-y-1 text-xs">
          <p><strong>Codigo:</strong> {p.code}</p>
          <p><strong>Cliente:</strong> {p.client}</p>
          <p><strong>Presupuesto:</strong> {formatCurrency(p.totalBudget)}</p>
        </div>
      ),
      variant: "danger",
      confirmText: "Eliminar proyecto",
      onConfirm: async () => { await deleteProject(p.id); },
    });
  }

  return (
    <div className="space-y-6">
      <ModuleExplanationCard
        icon={FolderKanban}
        variant="guide"
        title="Proyectos"
        description="Centraliza cada obra. Cada proyecto agrupa presupuesto, contratos, cortes, bitacoras y reportes."
        steps={[
          { title: "Crea el proyecto", description: "Asigna codigo, cliente, ubicacion, fechas y presupuesto total autorizado." },
          { title: "Carga el presupuesto (PT)", description: "Ve a Presupuestos para importar o digitar capitulos, subcapitulos e items." },
          { title: "Vincula contratistas", description: "Crea el contrato desde Contratos o PSC. Los contratistas generan cortes sobre el presupuesto." },
          { title: "Monitorea avance", description: "El equipo de obra registra cortes, bitacoras y avance diario." },
        ]}
        tips={["Solo ADMIN puede eliminar proyectos. La eliminacion es en cascada.", "El estado del proyecto se deriva del avance real, no se cambia a mano."]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Proyectos</h1>
          <p className="text-sm text-muted-foreground">{projects.length} proyectos - {stats.active} activos - {stats.planning} en planificacion</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Nuevo proyecto</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crear nuevo proyecto</DialogTitle>
              <DialogDescription>Completa la informacion basica. Despues podras agregar presupuesto, contratistas y cortes.</DialogDescription>
            </DialogHeader>
            <ProjectForm onSuccess={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Activos</p><p className="mt-1 text-2xl font-semibold">{stats.active}</p></div>
        <div className="rounded-lg border bg-card p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Planificacion</p><p className="mt-1 text-2xl font-semibold">{stats.planning}</p></div>
        <div className="rounded-lg border bg-card p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Completados</p><p className="mt-1 text-2xl font-semibold">{stats.completed}</p></div>
        <div className="rounded-lg border bg-card p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Presupuesto total</p><p className="mt-1 text-lg font-semibold">{formatCurrency(stats.totalBudget)}</p></div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nombre, codigo o cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            {Object.entries(PROJECT_STATUS_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No hay proyectos</h3>
          <p className="mt-1 text-sm text-muted-foreground">{search || statusFilter !== "ALL" ? "Intenta con otros filtros" : "Crea el primer proyecto para empezar"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} isSuperAdmin={isSuperAdmin}
              onEdit={() => setEditingProject(project)} onDelete={() => askDelete(project)} />
          ))}
        </div>
      )}

      <Dialog open={!!editingProject} onOpenChange={(o) => !o && setEditingProject(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Editar proyecto</DialogTitle><DialogDescription>{editingProject?.code}</DialogDescription></DialogHeader>
          {editingProject && <ProjectForm project={editingProject} onSuccess={() => setEditingProject(null)} />}
        </DialogContent>
      </Dialog>

      {confirmDel.dialog}
    </div>
  );
}

function ProjectCard({
  project, isSuperAdmin, onEdit, onDelete,
}: { project: Project; isSuperAdmin: boolean; onEdit: () => void; onDelete: () => void }) {
  const percent = project.totalBudget > 0 ? (project.executedAmount / project.totalBudget) * 100 : 0;
  const variant = PROJECT_STATUS_VARIANTS[project.status];
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="group rounded-lg border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-mono text-xs text-muted-foreground">{project.code}</p>
            <Badge variant={variant}>{PROJECT_STATUS_LABELS[project.status]}</Badge>
          </div>
          <Link href={`/tecnico/proyectos/${project.id}`} className="mt-1 block text-lg font-semibold hover:underline">
            {project.name}
          </Link>
          <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
            <p className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{project.client}</p>
            <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{project.location}</p>
            <p className="flex items-center gap-1.5"><CalendarIcon className="h-3.5 w-3.5" />{formatDate(project.startDate)} - {formatDate(project.estimatedEndDate)}</p>
          </div>
        </div>
        {isSuperAdmin && (
          <div className="relative">
            <Button variant="ghost" size="icon" onClick={() => setMenuOpen(!menuOpen)} className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
            {menuOpen && (
              <div className="absolute right-0 z-10 mt-1 w-40 rounded-md border bg-card shadow-lg" onMouseLeave={() => setMenuOpen(false)}>
                <Link href={`/tecnico/proyectos/${project.id}`} className="flex items-center gap-2 rounded-t-md px-3 py-2 text-sm hover:bg-accent">
                  <Eye className="h-4 w-4" /> Ver detalle
                </Link>
                <button onClick={() => { setMenuOpen(false); onEdit(); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent">
                  <Pencil className="h-4 w-4" /> Editar
                </button>
                <button onClick={() => { setMenuOpen(false); onDelete(); }} className="flex w-full items-center gap-2 rounded-b-md px-3 py-2 text-sm text-destructive hover:bg-accent">
                  <Trash2 className="h-4 w-4" /> Eliminar
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" /> Avance</span>
          <span className="font-semibold">{formatPercent(percent)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-secondary">
          <div className={cn("h-full transition-all", percent >= 90 ? "bg-emerald-500" : percent >= 30 ? "bg-primary" : "bg-amber-500")}
            style={{ width: `${Math.min(percent, 100)}%` }} />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatCurrency(project.executedAmount)}</span>
          <span>{formatCurrency(project.totalBudget)}</span>
        </div>
      </div>
    </div>
  );
}
