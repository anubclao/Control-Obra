"use client";

import { useState, useMemo } from "react";
import {
  Plus,
  Users,
  Mail,
  Copy,
  CheckCircle2,
  Clock,
  XCircle,
  Ban,
  Trash2,
  Send,
  Calendar,
  KeyRound, UserCog} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useInvitationsStore } from "@/lib/data-store";
import { useProjectsStore } from "@/lib/data-store";
import { useIsSuperAdmin } from "@/lib/permissions";
import { useAuthStore } from "@/lib/auth-store";
import { formatDate } from "@/lib/utils";
import type { Role, Area, Invitation } from "@/types";

import { useConfirm } from "@/components/ui/confirm-dialog";
import { ModuleExplanationCard } from "@/components/ui/module-explanation-card";
export default function UsuariosPage() {
  const { invitations, cancelInvitation, deleteInvitation } = useInvitationsStore();
  const { projects } = useProjectsStore();
  const { user } = useAuthStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const stats = useMemo(() => {
    const pending = invitations.filter((i) => i.status === "PENDING").length;
    const accepted = invitations.filter((i) => i.status === "ACCEPTED").length;
    const expired = invitations.filter((i) => i.status === "EXPIRED").length;
    return { pending, accepted, expired, total: invitations.length, activeUsers: [].length };
  }, [invitations]);

  return (
    <div className="space-y-6">

      <ModuleExplanationCard
        icon={UserCog}
        variant="guide"
        title="Administracion de Usuarios"
        description="Gestiona usuarios e invitaciones."
        steps={[
            { title: "Crear invitacion", description: "Codigo, email, rol y area." },
            { title: "Compartir codigo", description: "Usuario acepta desde login." },
            { title: "Asignar proyecto", description: "Restringir a un proyecto." },
          ]}
          warnings={[
            "Solo ADMIN puede crear invitaciones.",
          ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Usuarios e Invitaciones</h1>
          <p className="text-sm text-muted-foreground">
            {[].length} usuarios · {stats.pending} invitaciones pendientes
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setCreatedCode(null); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nueva invitación
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear invitación</DialogTitle>
              <DialogDescription>
                Genera un código único que el invitado usará para registrarse
              </DialogDescription>
            </DialogHeader>
            {createdCode ? (
              <div className="space-y-3">
                <div className="rounded-md border-2 border-dashed border-emerald-500 bg-emerald-50 p-6 text-center">
                  <KeyRound className="mx-auto h-8 w-8 text-emerald-600" />
                  <p className="mt-2 text-xs text-muted-foreground">Código generado</p>
                  <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-emerald-700">
                    {createdCode}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => navigator.clipboard.writeText(createdCode)}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar código
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Comparte este código con el invitado. Caduca el {(() => {
                    const inv = invitations.find((i) => i.code === createdCode);
                    return inv ? formatDate(inv.expiresAt) : "";
                  })()}
                </p>
                <DialogFooter>
                  <Button onClick={() => { setCreateOpen(false); setCreatedCode(null); }}>
                    Listo
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <InvitationForm
                onCreated={(code) => setCreatedCode(code)}
                createdBy={user?.id ?? "unknown"}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Usuarios activos" value={stats.activeUsers} icon={Users} color="text-blue-600" />
        <Kpi label="Invitaciones pendientes" value={stats.pending} icon={Send} color="text-amber-600" />
        <Kpi label="Aceptadas" value={stats.accepted} icon={CheckCircle2} color="text-emerald-600" />
        <Kpi label="Vencidas" value={stats.expired} icon={XCircle} color="text-red-600" />
      </div>

      {/* Invitaciones */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Invitaciones
        </h2>
        {invitations.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <Mail className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Sin invitaciones</h3>
          </div>
        ) : (
          <div className="space-y-2">
            {invitations.map((inv) => (
              <InvitationRow
                key={inv.id}
                inv={inv}
                projectName={
                  inv.projectId
                    ? projects.find((p) => p.id === inv.projectId)?.name
                    : undefined
                }
                onCancel={() => cancelInvitation(inv.id)}
                onDelete={() => deleteInvitation(inv.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Usuarios */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Usuarios del sistema
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[].map((u) => (
            <div key={u.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <span className="text-sm font-semibold">{u.name.charAt(0)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline">{u.role}</Badge>
                <Badge variant="secondary">{u.area}</Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
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

function InvitationRow({
  inv,
  projectName,
  onCancel,
  onDelete,
}: {
  inv: Invitation;
  projectName?: string;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const statusConfig = {
    PENDING: { label: "Pendiente", variant: "warning" as const, icon: Clock, color: "text-amber-600" },
    ACCEPTED: { label: "Aceptada", variant: "success" as const, icon: CheckCircle2, color: "text-emerald-600" },
    EXPIRED: { label: "Vencida", variant: "destructive" as const, icon: XCircle, color: "text-red-600" },
    CANCELLED: { label: "Cancelada", variant: "default" as const, icon: Ban, color: "text-muted-foreground" },
  }[inv.status];

  const StatusIcon = statusConfig.icon;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-secondary ${statusConfig.color}`}>
          <StatusIcon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-base font-bold tracking-wider">{inv.code}</p>
            <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            <Badge variant="outline">{inv.role}</Badge>
            {inv.area && <Badge variant="secondary">{inv.area}</Badge>}
          </div>
          <p className="mt-1 text-sm">
            <Mail className="mr-1 inline h-3 w-3" />
            {inv.email}
            {projectName ? ` · ${projectName}` : ""}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
            <Calendar className="h-3 w-3" />
            Creado {formatDate(inv.createdAt)}
            {inv.acceptedAt ? ` · Aceptado ${formatDate(inv.acceptedAt)}` : ` · Expira ${formatDate(inv.expiresAt)}`}
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigator.clipboard.writeText(inv.code)}
            title="Copiar código"
          >
            <Copy className="h-4 w-4" />
          </Button>
          {inv.status === "PENDING" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancel}
              title="Cancelar invitación"
            >
              <Ban className="h-4 w-4 text-amber-600" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            title="Eliminar invitación"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function InvitationForm({
  onCreated,
  createdBy,
}: {
  onCreated: (code: string) => void;
  createdBy: string;
}) {
  const { createInvitation } = useInvitationsStore();
  const { projects } = useProjectsStore();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("USER");
  const [area, setArea] = useState<Area | "">("");
  const [projectId, setProjectId] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [maxUses, setMaxUses] = useState(1);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const inv = createInvitation({
      email,
      role,
      area: area || undefined,
      projectId: projectId || undefined,
      maxUses,
      expiresInDays,
      createdBy,
    });
    onCreated(inv.code);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label className="mb-1.5 block">Email del invitado *</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nuevo@controlobra.com" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 block">Rol *</Label>
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["ADMIN", "GERENTE", "DIRECTOR", "RESIDENTE", "CONTABILIDAD", "TESORERIA", "HSEQ", "USER"] as Role[]).map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block">Área</Label>
          <Select value={area} onValueChange={(v) => setArea(v as Area)}>
            <SelectTrigger><SelectValue placeholder="Sin área" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tecnico">Técnico</SelectItem>
              <SelectItem value="administrativo">Administrativo</SelectItem>
              <SelectItem value="ventas">Ventas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="mb-1.5 block">Proyecto específico (opcional)</Label>
        <Select
          value={projectId}
          onValueChange={(v) => setProjectId(v === "__none" ? "" : v)}
        >
          <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">Todos los proyectos</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.code} – {p.name.slice(0, 30)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 block">Expira en (días)</Label>
          <Input
            type="number"
            min="1"
            max="365"
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(parseInt(e.target.value) || 30)}
          />
        </div>
        <div>
          <Label className="mb-1.5 block">Máx. usos</Label>
          <Input
            type="number"
            min="1"
            max="100"
            value={maxUses}
            onChange={(e) => setMaxUses(parseInt(e.target.value) || 1)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit">
          <KeyRound className="mr-2 h-4 w-4" />
          Generar código
        </Button>
      </DialogFooter>
    </form>
  );
}
