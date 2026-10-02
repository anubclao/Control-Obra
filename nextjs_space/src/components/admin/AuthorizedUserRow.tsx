"use client";

import { Mail, Calendar, CheckCircle2, XCircle, Ban, RotateCcw, Trash2, Building2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { AuthorizedUser } from "@/types";

interface AuthorizedUserRowProps {
  user: AuthorizedUser;
  projectName?: string;
  onAuthorize: (userId: string) => void;
  onSuspend: (userId: string) => void;
  onReactivate: (userId: string) => void;
  onDelete: (userId: string) => void;
}

const STATUS_CONFIG = {
  PENDING: {
    label: "Pendiente",
    variant: "warning" as const,
    icon: Clock,
    color: "text-amber-600",
    bg: "bg-amber-100",
  },
  ACTIVE: {
    label: "Activo",
    variant: "success" as const,
    icon: CheckCircle2,
    color: "text-emerald-600",
    bg: "bg-emerald-100",
  },
  SUSPENDED: {
    label: "Suspendido",
    variant: "destructive" as const,
    icon: Ban,
    color: "text-red-600",
    bg: "bg-red-100",
  },
};

export function AuthorizedUserRow({
  user,
  projectName,
  onAuthorize,
  onSuspend,
  onReactivate,
  onDelete,
}: AuthorizedUserRowProps) {
  const cfg = STATUS_CONFIG[user.status];
  const StatusIcon = cfg.icon;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md ${cfg.bg}`}
        >
          <StatusIcon className={`h-5 w-5 ${cfg.color}`} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{user.name}</p>
            <Badge variant={cfg.variant}>{cfg.label}</Badge>
            <Badge variant="outline">{user.role}</Badge>
            <Badge variant="secondary">{user.area}</Badge>
            {projectName && (
              <Badge variant="outline" className="gap-1">
                <Building2 className="h-3 w-3" />
                {projectName}
              </Badge>
            )}
          </div>

          <p className="mt-1 text-sm">
            <Mail className="mr-1 inline h-3 w-3" />
            {user.email}
          </p>

          <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Creado {formatDate(user.createdAt)}
            </span>
            {user.authorizedAt && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                Activado {formatDate(user.authorizedAt)}
              </span>
            )}
            {user.suspendedAt && (
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-600" />
                Suspendido {formatDate(user.suspendedAt)}
              </span>
            )}
            {user.lastLoginAt && (
              <span className="flex items-center gap-1">
                Último acceso: {formatDate(user.lastLoginAt)}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-shrink-0 gap-1">
          {user.status === "PENDING" && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onAuthorize(user.id)}
              title="Activar usuario"
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              Activar
            </Button>
          )}
          {user.status === "ACTIVE" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSuspend(user.id)}
              title="Suspender usuario"
              className="text-amber-600 hover:text-amber-700"
            >
              <Ban className="mr-1 h-3.5 w-3.5" />
              Suspender
            </Button>
          )}
          {user.status === "SUSPENDED" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onReactivate(user.id)}
              title="Reactivar usuario"
              className="text-emerald-600 hover:text-emerald-700"
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Reactivar
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(user.id)}
            title="Eliminar usuario"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );
}
