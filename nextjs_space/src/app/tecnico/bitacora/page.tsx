"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  BookOpen,
  Calendar as CalendarIcon,
  Users,
  AlertTriangle,
  Camera,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
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
import { useLogsStore, WEATHER_LABELS, WEATHER_ICONS } from "@/lib/logs-store";
import { useProjectsStore } from "@/lib/projects-store";
import { LogForm } from "@/components/logs/log-form";
import { formatDate, cn } from "@/lib/utils";
import type { WorkLog, WeatherCondition } from "@/types";

export default function BitacoraPage() {
  const { logs, deleteLog } = useLogsStore();
  const { projects, getProject } = useProjectsStore();
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("ALL");
  const [weatherFilter, setWeatherFilter] = useState<"ALL" | WeatherCondition>(
    "ALL",
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<WorkLog | null>(null);
  const [deleting, setDeleting] = useState<WorkLog | null>(null);

  const filtered = useMemo(() => {
    return [...logs]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((l) => {
        const project = getProject(l.projectId);
        const matchSearch =
          !search ||
          l.activities.toLowerCase().includes(search.toLowerCase()) ||
          (project?.name.toLowerCase().includes(search.toLowerCase()) ?? false);
        const matchProject =
          projectFilter === "ALL" || l.projectId === projectFilter;
        const matchWeather =
          weatherFilter === "ALL" || l.weather === weatherFilter;
        return matchSearch && matchProject && matchWeather;
      });
  }, [logs, search, projectFilter, weatherFilter, getProject]);

  const stats = useMemo(() => {
    const last7Days = logs.filter((l) => {
      // FIX Bug #25: tratar l.date como fecha local (no UTC).
      // new Date("2026-06-12") = 2026-06-12T00:00:00 UTC, lo que en zonas UTC+
      // puede dar un día de más.
      const [y, m, d] = l.date.split("-").map(Number);
      const logDate = new Date(y, m - 1, d);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diffDays = Math.round(
        (today.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      return diffDays <= 7;
    });
    const totalWorkers = logs.reduce((s, l) => s + l.workersCount, 0);
    const withIncidents = logs.filter(
      (l) => l.incidents && l.incidents.trim(),
    ).length;
    const totalPhotos = logs.reduce((s, l) => s + l.photos.length, 0);
    return {
      total: logs.length,
      last7Days: last7Days.length,
      avgWorkers: logs.length > 0 ? Math.round(totalWorkers / logs.length) : 0,
      withIncidents,
      totalPhotos,
    };
  }, [logs]);

  // Agrupar por fecha
  const grouped = useMemo(() => {
    const map = new Map<string, WorkLog[]>();
    filtered.forEach((l) => {
      if (!map.has(l.date)) map.set(l.date, []);
      map.get(l.date)!.push(l);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Bitácora de Obra
          </h1>
          <p className="text-sm text-muted-foreground">
            {stats.total} registros · {stats.last7Days} esta semana ·{" "}
            {stats.avgWorkers} trabajadores promedio
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nueva entrada
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registrar bitácora</DialogTitle>
              <DialogDescription>
                Captura las actividades, clima y novedades del día en obra
              </DialogDescription>
            </DialogHeader>
            <LogForm onSuccess={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiMini
          label="Total registros"
          value={stats.total}
          icon={BookOpen}
          color="text-blue-600"
        />
        <KpiMini
          label="Esta semana"
          value={stats.last7Days}
          icon={CalendarIcon}
          color="text-emerald-600"
        />
        <KpiMini
          label="Con incidentes"
          value={stats.withIncidents}
          icon={AlertTriangle}
          color="text-amber-600"
        />
        <KpiMini
          label="Fotos totales"
          value={stats.totalPhotos}
          icon={Camera}
          color="text-violet-600"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar en actividades o proyectos…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Proyecto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los proyectos</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.code} – {p.name.slice(0, 30)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={weatherFilter}
          onValueChange={(v) => setWeatherFilter(v as typeof weatherFilter)}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Clima" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los climas</SelectItem>
            {Object.entries(WEATHER_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {WEATHER_ICONS[k as WeatherCondition]} {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista agrupada por fecha */}
      {grouped.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No hay entradas</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {search || projectFilter !== "ALL" || weatherFilter !== "ALL"
              ? "Intenta con otros filtros"
              : "Registra la primera entrada de bitácora"}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, dayLogs]) => (
            <div key={date}>
              <div className="mb-2 flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {formatDate(date)}
                </h2>
                <span className="text-xs text-muted-foreground">
                  ({dayLogs.length} entradas)
                </span>
              </div>
              <div className="space-y-2">
                {dayLogs.map((log) => {
                  const project = getProject(log.projectId);
                  return (
                    <LogCard
                      key={log.id}
                      log={log}
                      projectName={project?.name}
                      projectCode={project?.code}
                      onEdit={() => setEditing(log)}
                      onDelete={() => setDeleting(log)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal editar */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar bitácora</DialogTitle>
            <DialogDescription>
              {editing && formatDate(editing.date)}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <LogForm log={editing} onSuccess={() => setEditing(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar entrada?</DialogTitle>
            <DialogDescription>
              Se eliminará la bitácora de{" "}
              {deleting && formatDate(deleting.date)} y todas sus fotos.
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
                  deleteLog(deleting.id);
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
        <Icon className={cn("h-3.5 w-3.5", color)} />
        {label}
      </div>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function LogCard({
  log,
  projectName,
  projectCode,
  onEdit,
  onDelete,
}: {
  log: WorkLog;
  projectName?: string;
  projectCode?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const hasIncidents = log.incidents && log.incidents.trim().length > 0;
  const weatherEmoji = WEATHER_ICONS[log.weather];

  return (
    <div className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 flex-col items-center justify-center rounded-md bg-primary/10 text-primary">
          <span className="text-lg leading-none">{weatherEmoji}</span>
          {log.temperature !== undefined && (
            <span className="text-[10px] text-muted-foreground">
              {log.temperature}°
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {projectCode && (
              <p className="font-mono text-xs text-muted-foreground">
                {projectCode}
              </p>
            )}
            <Badge variant="outline">{WEATHER_LABELS[log.weather]}</Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />
              {log.workersCount} trabajadores
            </span>
            {log.photos.length > 0 && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Camera className="h-3 w-3" />
                {log.photos.length}
              </span>
            )}
            {hasIncidents && (
              <Badge variant="warning" className="text-[10px]">
                Incidentes
              </Badge>
            )}
          </div>
          {projectName && (
            <p className="text-xs text-muted-foreground">{projectName}</p>
          )}
          <Link
            href={`/tecnico/bitacora/${log.id}`}
            className="mt-1 line-clamp-2 text-sm font-medium hover:underline"
          >
            {log.activities}
          </Link>
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
              <Link
                href={`/tecnico/bitacora/${log.id}`}
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
