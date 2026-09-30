"use client";

import { useMemo, useState } from "react";
import {
  FileSpreadsheet,
  TrendingUp,
  Wallet,
  Receipt,
  Building2,
  Filter,
  PieChart,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjectsStore } from "@/lib/data-store";
import { useProvidersStore } from "@/lib/data-store";
import { usePaymentsStore } from "@/lib/data-store";
import { useCutsStore } from "@/lib/data-store";
import { useBudgetsStore } from "@/lib/data-store";
import { useEnsureLoaded } from "@/lib/use-ensure-loaded";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";

export default function ReportesFinancierosPage() {
  const { projects } = useProjectsStore();
  const { payments } = usePaymentsStore();
  const { cuts } = useCutsStore();
  const { getBudgetByProject } = useBudgetsStore();
  useEnsureLoaded("projects", "budgets", "cuts", "payments");
  const [projectFilter, setProjectFilter] = useState<string>("ALL");

  // Cálculo global
  const global = useMemo(() => {
    const totalBudget = projects.reduce((s, p) => {
      const b = getBudgetByProject(p.id);
      return s + (b?.totalValue ?? p.totalBudget);
    }, 0);
    const totalExecuted = projects.reduce((s, p) => {
      const b = getBudgetByProject(p.id);
      if (!b) return s + p.executedAmount;
      return s + b.layers.flatMap((l) => l.items).reduce((sum, it) => sum + it.executedAmount, 0);
    }, 0);
    const retention = totalExecuted * 0.1; // 10% simulado
    const taxes = totalExecuted * 0.19; // IVA 19% simulado
    return {
      totalBudget,
      totalExecuted,
      retention,
      taxes,
      percent: totalBudget > 0 ? (totalExecuted / totalBudget) * 100 : 0,
    };
  }, [projects, getBudgetByProject]);

  // Por proyecto
  const porProyecto = useMemo(() => {
    return projects
      .filter((p) => projectFilter === "ALL" || p.id === projectFilter)
      .map((p) => {
        const b = getBudgetByProject(p.id);
        const executed = b
          ? b.layers.flatMap((l) => l.items).reduce((s, it) => s + it.executedAmount, 0)
          : p.executedAmount;
        const budget = b?.totalValue ?? p.totalBudget;
        const projectCuts = cuts.filter((c) => c.projectId === p.id);
        const projectPayments = payments.filter((pay) => pay.projectId === p.id);
        const paidAmount = projectPayments
          .filter((pay) => pay.status === "PAID")
          .reduce((s, pay) => s + pay.amount, 0);
        return {
          project: p,
          budget,
          executed,
          paid: paidAmount,
          percent: budget > 0 ? (executed / budget) * 100 : 0,
          cuts: projectCuts.length,
          payments: projectPayments.length,
        };
      });
  }, [projects, projectFilter, getBudgetByProject, cuts, payments]);

  // Distribución por estado de pago
  const distribucionEstado = useMemo(() => {
    const groups: Record<string, { count: number; amount: number }> = {};
    payments
      .filter((p) => projectFilter === "ALL" || p.projectId === projectFilter)
      .forEach((p) => {
        if (!groups[p.status]) groups[p.status] = { count: 0, amount: 0 };
        groups[p.status].count++;
        groups[p.status].amount += p.amount;
      });
    return Object.entries(groups)
      .map(([status, data]) => ({ status, ...data }))
      .sort((a, b) => b.amount - a.amount);
  }, [payments, projectFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Reportes Financieros</h1>
          <p className="text-sm text-muted-foreground">
            Resumen ejecutivo y desglose por proyecto
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filtrar proyecto" />
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
        </div>
      </div>

      {/* KPIs globales */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total presupuestado
            </CardTitle>
            <Wallet className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(global.totalBudget)}</p>
            <p className="text-xs text-muted-foreground">Suma de PT activos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total ejecutado
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(global.totalExecuted)}</p>
            <p className="text-xs text-emerald-600">{formatPercent(global.percent)} del total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Retenciones
            </CardTitle>
            <Receipt className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(global.retention)}</p>
            <p className="text-xs text-muted-foreground">10% sobre ejecutado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Impuestos
            </CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-violet-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(global.taxes)}</p>
            <p className="text-xs text-muted-foreground">IVA 19% estimado</p>
          </CardContent>
        </Card>
      </div>

      {/* Distribución por estado de pago */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-4 w-4 text-muted-foreground" />
            Distribución de pagos por estado
          </CardTitle>
          <CardDescription>
            Cuánto dinero hay en cada fase del flujo de aprobación
          </CardDescription>
        </CardHeader>
        <CardContent>
          {distribucionEstado.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay pagos para mostrar</p>
          ) : (
            <div className="space-y-2">
              {distribucionEstado.map((row) => {
                const totalAmount = distribucionEstado.reduce((s, r) => s + r.amount, 0);
                const pct = totalAmount > 0 ? (row.amount / totalAmount) * 100 : 0;
                return (
                  <div key={row.status} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{row.status}</span>
                        <span className="text-xs text-muted-foreground">({row.count} solicitudes)</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold">{formatCurrency(row.amount)}</span>
                        <span className="ml-2 text-xs text-muted-foreground">({formatPercent(pct)})</span>
                      </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn(
                          "h-full",
                          row.status === "PAID" ? "bg-emerald-500" :
                          row.status === "APPROVED" ? "bg-emerald-300" :
                          row.status === "REJECTED" || row.status === "CANCELLED" ? "bg-red-400" :
                          "bg-amber-400"
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Desglose por proyecto */}
      <Card>
        <CardHeader>
          <CardTitle>Desglose por proyecto</CardTitle>
          <CardDescription>
            Ejecución presupuestal y pagos por proyecto
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/30 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2">Proyecto</th>
                  <th className="px-3 py-2 text-right">Presupuesto</th>
                  <th className="px-3 py-2 text-right">Ejecutado</th>
                  <th className="px-3 py-2 text-right">% Ejec.</th>
                  <th className="px-3 py-2 text-right">Pagado</th>
                  <th className="px-3 py-2 text-center">Cortes</th>
                  <th className="px-3 py-2 text-center">Pagos</th>
                </tr>
              </thead>
              <tbody>
                {porProyecto.map((row) => (
                  <tr key={row.project.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <p className="font-mono text-xs text-muted-foreground">{row.project.code}</p>
                      <p className="text-sm font-medium">{row.project.name}</p>
                    </td>
                    <td className="px-3 py-2 text-right">{formatCurrency(row.budget)}</td>
                    <td className="px-3 py-2 text-right text-emerald-600">
                      {formatCurrency(row.executed)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-xs font-medium">{formatPercent(row.percent)}</span>
                        <div className="h-1.5 w-12 overflow-hidden rounded-full bg-secondary">
                          <div
                            className={cn(
                              "h-full",
                              row.percent >= 90 ? "bg-emerald-500" : row.percent >= 30 ? "bg-primary" : "bg-amber-500"
                            )}
                            style={{ width: `${Math.min(row.percent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {formatCurrency(row.paid)}
                    </td>
                    <td className="px-3 py-2 text-center">{row.cuts}</td>
                    <td className="px-3 py-2 text-center">{row.payments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Top contratistas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Top contratistas por monto pagado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TopProvidersList projectFilter={projectFilter} />
        </CardContent>
      </Card>
    </div>
  );
}

function TopProvidersList({ projectFilter }: { projectFilter: string }) {
  const { payments } = usePaymentsStore();
  const { getProvider } = useProvidersStore();

  const top = useMemo(() => {
    const byProvider = new Map<string, { amount: number; count: number; name: string }>();
    payments
      .filter((p) => p.status === "PAID")
      .filter((p) => projectFilter === "ALL" || p.projectId === projectFilter)
      .forEach((p) => {
        if (!p.providerId) return;
        const c = getProvider(p.providerId);
        const existing = byProvider.get(p.providerId);
        if (existing) {
          existing.amount += p.amount;
          existing.count++;
        } else {
          byProvider.set(p.providerId, { amount: p.amount, count: 1, name: c?.name ?? "Desconocido" });
        }
      });
    return Array.from(byProvider.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [payments, projectFilter, getProvider]);

  if (top.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin pagos a contratistas en el filtro actual</p>;
  }

  const maxAmount = Math.max(...top.map((t) => t.amount));

  return (
    <div className="space-y-3">
      {top.map((row, idx) => {
        const pct = (row.amount / maxAmount) * 100;
        return (
          <div key={row.id} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">#{idx + 1}</Badge>
                <span className="font-medium">{row.name}</span>
                <span className="text-xs text-muted-foreground">({row.count} pagos)</span>
              </div>
              <span className="font-semibold">{formatCurrency(row.amount)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
