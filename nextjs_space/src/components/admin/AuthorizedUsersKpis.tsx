"use client";

import { Users, Clock, CheckCircle2, Ban } from "lucide-react";
import type { AuthorizedUserKpis } from "@/lib/admin-users";

interface AuthorizedUsersKpisProps {
  kpis: AuthorizedUserKpis;
}

const KPIS = [
  {
    key: "active",
    label: "Usuarios activos",
    icon: CheckCircle2,
    color: "text-emerald-600",
  },
  {
    key: "pending",
    label: "Pendientes de autorizar",
    icon: Clock,
    color: "text-amber-600",
  },
  {
    key: "suspended",
    label: "Suspendidos",
    icon: Ban,
    color: "text-red-600",
  },
  {
    key: "total",
    label: "Total registrados",
    icon: Users,
    color: "text-blue-600",
  },
] as const;

export function AuthorizedUsersKpis({ kpis }: AuthorizedUsersKpisProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {KPIS.map(({ key, label, icon: Icon, color }) => (
        <div key={key} className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon className={`h-3.5 w-3.5 ${color}`} />
            {label}
          </div>
          <p className="mt-1 text-2xl font-semibold">{kpis[key]}</p>
        </div>
      ))}
    </div>
  );
}
