"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Calendar,
  ArrowRight,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  Banknote, Receipt} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  useExpensesStore,
  // EXPENSE_TYPE_LABELS,
  // EXPENSE_STATUS_LABELS,
  // EXPENSE_STATUS_VARIANTS,
  // categoryFor,
} from "@/lib/data-store";
import { useProvidersStore } from "@/lib/data-store";
import { useProjectsStore } from "@/lib/data-store";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Expense, ExpenseStatus, ExpenseType } from "@/types";

import { useConfirm } from "@/components/ui/confirm-dialog";
import { ModuleExplanationCard } from "@/components/ui/module-explanation-card";
export default function GastosPage() {
  const { expenses } = useExpensesStore();
  const { providers } = useProvidersStore();
  const { projects } = useProjectsStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ExpenseStatus>("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | ExpenseType>("ALL");
  const [createOpen, setCreateOpen] = useState(false);

  const providerById = useMemo(() => {
    const m = new Map<string, (typeof providers)[number]>();
    providers.forEach((p) => m.set(p.id, p));
    return m;
  }, [providers]);

  const projectById = useMemo(() => {
    const m = new Map<string, (typeof projects)[number]>();
    projects.forEach((p) => m.set(p.id, p));
    return m;
  }, [projects]);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      const provider = providerById.get(e.providerId);
      const project = projectById.get(e.projectId);
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        e.expenseNumber.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        (provider?.name.toLowerCase().includes(q) ?? false) ||
        (project?.code.toLowerCase().includes(q) ?? false);
      const matchStatus = statusFilter === "ALL" || e.status === statusFilter;
      const matchType = typeFilter === "ALL" || e.type === typeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [expenses, search, statusFilter, typeFilter, providerById, projectById]);

  const summary = useMemo(() => {
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    const pending = expenses.filter((e) => e.status === "PENDING_APPROVAL").length;
    const approved = expenses.filter((e) => e.status === "APPROVED").length;
    const paid = expenses.filter((e) => e.status === "PAID").length;
    const pendingAmount = expenses
      .filter((e) => e.status === "PENDING_APPROVAL")
      .reduce((s, e) => s + e.amount, 0);
    return { total, pending, approved, paid, pendingAmount };
  }, [expenses]);

  const grouped = useMemo(() => {
    const groups: Record<string, Expense[]> = {};
    for (const e of filtered) {
      const cat = e.type;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(e);
    }
    return groups;
  }, [filtered]);

  return (
    <div className="space-y-6">

      <ModuleExplanationCard
        icon={Receipt}
        variant="guide"
        title="Registro de Gastos"
        description="Gastos con sus soportes."
        steps={[
            { title: "Clasifica el gasto", description: "13 tipos documentales." },
            { title: "Adjunta soportes", description: "Facturas, cuentas de cobro." },
            { title: "Solicita aprobacion", description: "Cambia a PENDING_APPROVAL." },
          ]}
          warnings={[
            "Solo se eliminan DRAFT o REJECTED.",
          ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Registro de Gastos</h1>
          <p className="text-sm text-muted-foreground">
            Contratos, órdenes de servicio/compra, solicitudes y legalizaciones
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo gasto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear nuevo gasto</DialogTitle>
              <DialogDescription>
                Selecciona el tipo y completa los datos. El campo de estado es solo modificable
                por Super Administrador.
              </DialogDescription>
            </DialogHeader>
            <ExpenseForm onSuccess={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total registrado</p>
          <p className="mt-1 text-lg font-semibold">{formatCurrency(summary.total)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Pendientes</p>
          <p className="mt-1 flex items-center gap-1.5 text-2xl font-semibold text-amber-600">
            <Clock className="h-5 w-5" />
            {summary.pending}
          </p>
          <p className="text-xs text-muted-foreground">{formatCurrency(summary.pendingAmount)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Aprobados</p>
          <p className="mt-1 flex items-center gap-1.5 text-2xl font-semibold text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
            {summary.approved}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Pagados</p>
          <p className="mt-1 flex items-center gap-1.5 text-2xl font-semibold">
            <Banknote className="h-5 w-5 text-muted-foreground" />
            {summary.paid}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, descripción, proveedor o proyecto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
          <SelectTrigger className="w-full sm:w-[280px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los tipos</SelectItem>
            {(Object.entries({}) as [ExpenseType, string][]).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
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
            {(Object.entries({}) as [ExpenseStatus, string][]).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista agrupada por categoría */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No hay gastos</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {search || statusFilter !== "ALL" || typeFilter !== "ALL"
              ? "Intenta con otros filtros"
              : "Crea el primer gasto para empezar"}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, list]) => (
            <ExpenseGroup
              key={cat}
              category={cat}
              expenses={list}
              providerById={providerById}
              projectById={projectById}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const CATEGORY_TITLES: Record<string, string> = {
  contrato: "Contratos",
  orden_servicio: "Órdenes de Servicio",
  orden_compra: "Órdenes de Compra",
  laboral: "Contratos Laborales",
  recurso: "Solicitudes y Legalizaciones",
};

function ExpenseGroup({
  category,
  expenses,
  providerById,
  projectById,
}: {
  category: string;
  expenses: Expense[];
  providerById: Map<string, any>;
  projectById: Map<string, any>;
}) {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{CATEGORY_TITLES[category]}</CardTitle>
          <p className="text-sm font-semibold">{formatCurrency(total)}</p>
        </div>
        <CardDescription>
          {expenses.length} gasto{expenses.length === 1 ? "" : "s"}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {expenses.map((e) => {
            const provider = providerById.get(e.providerId);
            const project = projectById.get(e.projectId);
            const statusIcon =
              e.status === "APPROVED" || e.status === "PAID" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : e.status === "REJECTED" ? (
                <XCircle className="h-4 w-4 text-destructive" />
              ) : e.status === "PENDING_APPROVAL" ? (
                <AlertCircle className="h-4 w-4 text-amber-600" />
              ) : (
                <Clock className="h-4 w-4 text-muted-foreground" />
              );
            return (
              <Link
                key={e.id}
                href={`/tecnico/gastos/${e.id}`}
                className="flex items-center justify-between p-3 hover:bg-accent/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {statusIcon}
                    <p className="font-mono text-xs text-muted-foreground">{e.expenseNumber}</p>
                    <Badge variant={e.status === "PAID" ? "success" : e.status === "REJECTED" ? "destructive" : e.status === "APPROVED" ? "success" : "warning"}>
                      {e.status === "PENDING_APPROVAL" ? "Pendiente" : e.status === "PAID" ? "Pagado" : e.status === "REJECTED" ? "Rechazado" : e.status === "APPROVED" ? "Aprobado" : "Borrador"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm font-medium">{e.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.type} · {provider?.name ?? "—"} ·{" "}
                    {project?.code ?? "—"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(e.amount)}</p>
                    <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(e.date)}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
