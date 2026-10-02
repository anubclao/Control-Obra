"use client";

import { Search, Filter, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AuthorizedUserFilters, AuthorizedUserStatus } from "@/lib/admin-users";
import type { Role } from "@/types";

interface AuthorizedUsersFiltersProps {
  filters: AuthorizedUserFilters;
  onChange: (next: AuthorizedUserFilters) => void;
}

const ROLES: Role[] = [
  "ADMIN",
  "GERENTE",
  "DIRECTOR",
  "RESIDENTE",
  "CONTABILIDAD",
  "TESORERIA",
  "HSEQ",
  "CLIENTE",
  "USER",
];

const STATUSES: Array<{ value: AuthorizedUserStatus; label: string }> = [
  { value: "PENDING", label: "Pendientes" },
  { value: "ACTIVE", label: "Activos" },
  { value: "SUSPENDED", label: "Suspendidos" },
];

export function AuthorizedUsersFilters({
  filters,
  onChange,
}: AuthorizedUsersFiltersProps) {
  const hasActive =
    !!filters.search ||
    (filters.role && filters.role !== "ALL") ||
    (filters.status && filters.status !== "ALL");

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={filters.search ?? ""}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Buscar por nombre, email o rol…"
          className="pl-8"
        />
      </div>

      <div className="flex gap-2">
        <Select
          value={filters.role ?? "ALL"}
          onValueChange={(v) =>
            onChange({ ...filters, role: v as Role | "ALL" })
          }
        >
          <SelectTrigger className="w-[160px]">
            <Filter className="mr-2 h-3.5 w-3.5" />
            <SelectValue placeholder="Rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los roles</SelectItem>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status ?? "ALL"}
          onValueChange={(v) =>
            onChange({
              ...filters,
              status: v === "ALL" ? "ALL" : (v as AuthorizedUserStatus),
            })
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActive && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onChange({ search: "", role: "ALL", status: "ALL" })}
            title="Limpiar filtros"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
